import 'server-only';

import type { Event, EventRow } from '@/types/event';
import { EventRegistrationStatus } from '@/types/event';
import type { VenueLocation } from '@/types/venue';
import { eventFromRow, eventToRow } from '@/types/event';
import {
  fetchRows,
  fetchSingleRow,
  insertRow,
  updateRow,
  deleteRow,
} from '@/lib/supabase-utils';
import { getVenueById } from '@/lib/venues';
import { getBookById } from '@/lib/books';
import { countActiveRegistrationsByEventId } from '@/lib/registration-store';

const TABLE_NAME = process.env.SUPABASE_EVENTS_TABLE || 'events';

/**
 * Calculate event registration status considering both time and venue capacity.
 * This is the authoritative function for determining registration availability.
 *
 * @param event - Event with venue data
 * @param currentRegistrations - Number of active registrations for this event
 * @param now - Current time (defaults to now)
 * @returns Registration status
 */
export async function calculateRegistrationStatus(
  event: Event,
  currentRegistrations: number,
  now: string = new Date().toISOString()
): Promise<EventRegistrationStatus> {
  // Check if registration hasn't opened yet
  if (now < event.registrationOpensAt) {
    return EventRegistrationStatus.UPCOMING;
  }

  // Check if registration has closed
  if (now > event.registrationClosesAt) {
    return EventRegistrationStatus.CLOSED;
  }

  // Now we're in the open time window - check venue capacity
  let venue = event.venue;
  if (!venue) {
    venue = await getVenueById(event.venueId);
    if (!venue) {
      return EventRegistrationStatus.UNKNOWN;
    }
  }

  // Check venue capacity
  if (currentRegistrations >= venue.maxCapacity) {
    return EventRegistrationStatus.FULL;
  }

  return EventRegistrationStatus.OPEN;
}

/**
 * Populate registration status for an event.
 * Modifies the event object in place.
 */
async function populateRegistrationStatus(
  event: Event,
  now: string = new Date().toISOString()
): Promise<void> {
  const currentRegistrations = await countActiveRegistrationsByEventId(event.id);
  event.registrationStatus = await calculateRegistrationStatus(event, currentRegistrations, now);
}

// Get all events (with optional filtering and joins)
export async function getAllEvents(options?: {
  eventTypeCode?: string;
  venueLocation?: VenueLocation;
  includeVenue?: boolean;
  includeBook?: boolean;
  includeRegistrationStatus?: boolean;
  isPublished?: boolean;
  from?: string; // ISO date string - filter events on or after this date
}): Promise<Event[]> {
  const filters: string[] = [];

  if (options?.eventTypeCode) {
    filters.push(`event_type_code=eq.${options.eventTypeCode}`);
  }

  if (options?.isPublished !== undefined) {
    filters.push(`is_published=eq.${options.isPublished}`);
  }

  if (options?.from) {
    filters.push(`event_date=gte.${options.from}`);
  }

  filters.push('order=event_date.desc');

  const filterString = filters.join('&');
  const rows = await fetchRows<EventRow>(TABLE_NAME, '*', filterString);

  // Fetch related data and filter by venue location if requested
  let events = await Promise.all(
    rows.map(async (row) => {
      const venue = options?.includeVenue || options?.includeRegistrationStatus || options?.venueLocation ? await getVenueById(row.venue_id) : undefined;
      const book =
        options?.includeBook && row.book_id ? await getBookById(row.book_id) : undefined;
      return eventFromRow(row, venue ?? undefined, book ?? undefined);
    })
  );

  // Filter by venue location if specified
  if (options?.venueLocation) {
    events = events.filter(e => e.venue?.location === options.venueLocation);
  }

  // Populate registration status if requested
  if (options?.includeRegistrationStatus) {
    await Promise.all(
      events.map(event => populateRegistrationStatus(event))
    );
  }

  return events;
}

// Get event by ID
export async function getEventById(
  id: number,
  options?: { includeVenue?: boolean; includeBook?: boolean }
): Promise<Event | null> {
  const row = await fetchSingleRow<EventRow>(TABLE_NAME, '*', `id=eq.${id}`);
  if (!row) return null;

  const venue = options?.includeVenue ? await getVenueById(row.venue_id) : undefined;
  const book = options?.includeBook && row.book_id ? await getBookById(row.book_id) : undefined;

  return eventFromRow(row, venue ?? undefined, book ?? undefined);
}

// Get event by slug
export async function getEventBySlug(
  slug: string,
  options?: { includeVenue?: boolean; includeBook?: boolean }
): Promise<Event | null> {
  const row = await fetchSingleRow<EventRow>(
    TABLE_NAME,
    '*',
    `slug=eq.${encodeURIComponent(slug)}`
  );
  if (!row) return null;

  const venue = options?.includeVenue ? await getVenueById(row.venue_id) : undefined;
  const book = options?.includeBook && row.book_id ? await getBookById(row.book_id) : undefined;

  return eventFromRow(row, venue ?? undefined, book ?? undefined);
}

// Create event
export async function createEvent(
  event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Event> {
  const row = eventToRow(event);
  const result = await insertRow<EventRow>(TABLE_NAME, row);
  return eventFromRow(result);
}

// Update event
export async function updateEvent(
  id: number,
  updates: Partial<Omit<Event, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Event> {
  const row = eventToRow(updates);
  const result = await updateRow<EventRow>(TABLE_NAME, `id=eq.${id}`, row);
  return eventFromRow(result);
}

// Delete event (will fail if registrations reference it due to FK constraint)
export async function deleteEvent(id: number): Promise<void> {
  await deleteRow(TABLE_NAME, `id=eq.${id}`);
}

// Get events for specific venue, optionally filtered by event type, hiding expired events by default
export async function getEventsByVenueAndType(
  venueLocation: VenueLocation,
  eventTypeCode?: string,
  hideExpired: boolean = true
): Promise<Event[]> {
  // Calculate "yesterday" to filter out events that ended (event date + 1 day)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const fromDate = hideExpired ? yesterday.toISOString().split('T')[0] : undefined;

  const events = await getAllEvents({
    venueLocation,
    eventTypeCode,
    isPublished: true,
    includeVenue: true,
    includeBook: true,
    includeRegistrationStatus: true,
    from: fromDate,
  });

  // Sort by date ascending (closest to now first)
  return events.sort((a, b) =>
    new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );
}
