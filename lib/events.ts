import 'server-only';

import path from 'node:path';
import { statSync } from 'node:fs';
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
  isSupabaseConfigured,
  shouldForceLocalPersistentStores,
} from '@/lib/supabase-utils';
import { getVenueById } from '@/lib/venues';
import { getBookById } from '@/lib/books';
import { countActiveRegistrationsByEventId } from '@/lib/registration-store';
import { readJsonFile, resolveWorkspacePath, writeJsonFile } from '@/lib/json-store';

const TABLE_NAME = process.env.SUPABASE_EVENTS_TABLE || 'events';
const LOCAL_EVENTS_ROOT = '.local/playwright-admin-documents';
const FALLBACK_EVENTS_FILE = 'data/events.json';

function getEffectiveFallbackFile(fallbackFile: string): string {
  if (!shouldForceLocalPersistentStores()) {
    return fallbackFile;
  }
  return path.join(LOCAL_EVENTS_ROOT, path.basename(fallbackFile));
}

function ensureEffectiveFallbackSeed(fallbackFile: string): string {
  const effectiveFallbackFile = getEffectiveFallbackFile(fallbackFile);
  if (effectiveFallbackFile === fallbackFile) {
    return fallbackFile;
  }

  try {
    statSync(resolveWorkspacePath(effectiveFallbackFile));
    return effectiveFallbackFile;
  } catch {
    // Seed the local file from the fallback file
    const seedData = readJsonFile<Event[]>(fallbackFile);
    writeJsonFile(effectiveFallbackFile, seedData);
    return effectiveFallbackFile;
  }
}

// Read all events from file
function readEventsFromFile(): Event[] {
  const effectiveFallbackFile = ensureEffectiveFallbackSeed(FALLBACK_EVENTS_FILE);
  return readJsonFile<Event[]>(effectiveFallbackFile);
}

// Write all events to file
function writeEventsToFile(events: Event[]): void {
  const effectiveFallbackFile = ensureEffectiveFallbackSeed(FALLBACK_EVENTS_FILE);
  writeJsonFile(effectiveFallbackFile, events);
}

// Get next ID from file-backed events
function getNextIdFromFile(events: Event[]): number {
  if (events.length === 0) {
    return 1;
  }
  return Math.max(...events.map(e => e.id)) + 1;
}

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
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    let events = readEventsFromFile();

    // Apply filters
    if (options?.eventTypeCode) {
      events = events.filter(e => e.eventTypeCode === options.eventTypeCode);
    }
    if (options?.isPublished !== undefined) {
      events = events.filter(e => e.isPublished === options.isPublished);
    }
    if (options?.from) {
      events = events.filter(e => e.eventDate >= options.from!);
    }

    // Filter by venue location if specified
    if (options?.venueLocation) {
      const venueLocationFilter = options.venueLocation;
      events = await Promise.all(
        events.map(async (event) => {
          const venue = await getVenueById(event.venueId);
          return venue?.location === venueLocationFilter ? event : null;
        })
      ).then(results => results.filter((e): e is Event => e !== null));
    }

    // Sort by event date descending
    events.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

    // Fetch related data if requested
    const eventsWithRelations = await Promise.all(
      events.map(async (event) => {
        const venue = options?.includeVenue || options?.includeRegistrationStatus ? await getVenueById(event.venueId) : undefined;
        const book = options?.includeBook && event.bookId ? await getBookById(event.bookId) : undefined;
        return {
          ...event,
          venue: venue ?? undefined,
          book: book ?? undefined,
        };
      })
    );

    // Populate registration status if requested
    if (options?.includeRegistrationStatus) {
      await Promise.all(
        eventsWithRelations.map(event => populateRegistrationStatus(event))
      );
    }

    return eventsWithRelations;
  }

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
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const events = readEventsFromFile();
    const event = events.find(e => e.id === id);
    if (!event) return null;

    const venue = options?.includeVenue ? await getVenueById(event.venueId) : undefined;
    const book = options?.includeBook && event.bookId ? await getBookById(event.bookId) : undefined;

    return {
      ...event,
      venue: venue ?? undefined,
      book: book ?? undefined,
    };
  }

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
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const events = readEventsFromFile();
    const event = events.find(e => e.slug === slug);
    if (!event) return null;

    const venue = options?.includeVenue ? await getVenueById(event.venueId) : undefined;
    const book = options?.includeBook && event.bookId ? await getBookById(event.bookId) : undefined;

    return {
      ...event,
      venue: venue ?? undefined,
      book: book ?? undefined,
    };
  }

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
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const events = readEventsFromFile();
    const now = new Date().toISOString();
    const newEvent: Event = {
      ...event,
      id: getNextIdFromFile(events),
      createdAt: now,
      updatedAt: now,
    };
    writeEventsToFile([...events, newEvent]);
    return newEvent;
  }

  const row = eventToRow(event);
  const result = await insertRow<EventRow>(TABLE_NAME, row);
  return eventFromRow(result);
}

// Update event
export async function updateEvent(
  id: number,
  updates: Partial<Omit<Event, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Event> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const events = readEventsFromFile();
    const index = events.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error(`Event with id ${id} not found`);
    }
    const updatedEvent: Event = {
      ...events[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    events[index] = updatedEvent;
    writeEventsToFile(events);
    return updatedEvent;
  }

  const row = eventToRow(updates);
  const result = await updateRow<EventRow>(TABLE_NAME, `id=eq.${id}`, row);
  return eventFromRow(result);
}

// Delete event (will fail if registrations reference it due to FK constraint)
export async function deleteEvent(id: number): Promise<void> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const events = readEventsFromFile();
    const filtered = events.filter(e => e.id !== id);
    if (filtered.length === events.length) {
      throw new Error(`Event with id ${id} not found`);
    }
    writeEventsToFile(filtered);
    return;
  }

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
