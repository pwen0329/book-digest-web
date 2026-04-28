import 'server-only';

import type { Event, EventRow } from '@/types/event';
import { EventRegistrationStatus } from '@/types/event';
import type { VenueLocation } from '@/types/event';
import { eventFromRow, eventToRow } from '@/types/event';
import {
  fetchRows,
  fetchSingleRow,
  insertRow,
  updateRow,
  deleteRow,
} from '@/lib/supabase-utils';
import { getBookById } from '@/lib/books';
import { getIntroTemplateByName } from '@/lib/signup-intro-templates';
import { countActiveRegistrationsByEventId } from '@/lib/registration-store';
import { SUPABASE_CONFIG } from '@/lib/env';

const TABLE_NAME = SUPABASE_CONFIG.TABLES.EVENTS;

/**
 * Calculate event registration status considering both time and venue capacity.
 * This is the authoritative function for determining registration availability.
 *
 * @param event - Event with inline venue capacity
 * @param currentRegistrations - Number of active registrations for this event
 * @param now - Current time (defaults to now)
 * @returns Registration status
 */
export async function calculateRegistrationStatus(
  event: Event,
  currentRegistrations: number,
  now: string = new Date().toISOString()
): Promise<EventRegistrationStatus> {
  // Check if venue capacity is invalid
  if (!event.venueCapacity || event.venueCapacity <= 0) {
    return EventRegistrationStatus.UNKNOWN;
  }

  // Check if registration hasn't opened yet
  if (now < event.registrationOpensAt) {
    return EventRegistrationStatus.UPCOMING;
  }

  // Check if registration has closed
  if (now > event.registrationClosesAt) {
    return EventRegistrationStatus.CLOSED;
  }

  // Now we're in the open time window - check venue capacity
  if (currentRegistrations >= event.venueCapacity) {
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
  includeBook?: boolean;
  includeIntroTemplate?: boolean;
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

  if (options?.venueLocation) {
    filters.push(`venue_location=eq.${options.venueLocation}`);
  }

  if (options?.from) {
    filters.push(`event_date=gte.${options.from}`);
  }

  filters.push('order=event_date.desc');

  const filterString = filters.join('&');
  const rows = await fetchRows<EventRow>(TABLE_NAME, '*', filterString);

  // Fetch related data
  const events = await Promise.all(
    rows.map(async (row) => {
      const book =
        options?.includeBook && row.book_id ? await getBookById(row.book_id) : undefined;
      const introTemplate =
        options?.includeIntroTemplate ? await getIntroTemplateByName(row.intro_template_name) : undefined;
      return eventFromRow(row, book ?? undefined, introTemplate ?? undefined);
    })
  );

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
  options?: { includeBook?: boolean; includeIntroTemplate?: boolean }
): Promise<Event | null> {
  const row = await fetchSingleRow<EventRow>(TABLE_NAME, '*', `id=eq.${id}`);
  if (!row) return null;

  const book = options?.includeBook && row.book_id ? await getBookById(row.book_id) : undefined;
  const introTemplate =
    options?.includeIntroTemplate ? await getIntroTemplateByName(row.intro_template_name) : undefined;

  return eventFromRow(row, book ?? undefined, introTemplate ?? undefined);
}

// Get event by slug
export async function getEventBySlug(
  slug: string,
  options?: { includeBook?: boolean; includeIntroTemplate?: boolean }
): Promise<Event | null> {
  const row = await fetchSingleRow<EventRow>(
    TABLE_NAME,
    '*',
    `slug=eq.${encodeURIComponent(slug)}`
  );
  if (!row) return null;

  const book = options?.includeBook && row.book_id ? await getBookById(row.book_id) : undefined;
  const introTemplate =
    options?.includeIntroTemplate ? await getIntroTemplateByName(row.intro_template_name) : undefined;

  const event = eventFromRow(row, book ?? undefined, introTemplate ?? undefined);

  // Always populate registration status for signup pages
  await populateRegistrationStatus(event);

  return event;
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
    includeBook: true,
    includeRegistrationStatus: true,
    from: fromDate,
  });

  // Sort by date ascending (closest to now first)
  return events.sort((a, b) =>
    new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );
}
