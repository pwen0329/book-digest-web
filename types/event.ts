// Event type - scheduled reading club sessions

import type { Book } from './book';
import type { Venue } from './venue';

export const EventRegistrationStatus = {
  UPCOMING: 'upcoming',
  OPEN: 'open',
  CLOSED: 'closed',
  FULL: 'full',
  UNKNOWN: 'unknown',
} as const;

export type EventRegistrationStatus = typeof EventRegistrationStatus[keyof typeof EventRegistrationStatus];

export type Event = {
  id: number;
  slug: string;
  eventTypeCode: string;
  venueId: number;
  venue?: Venue; // Joined data

  // Bilingual content
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;

  // Scheduling (all timestamps in UTC, displayed in local time on frontend)
  eventDate: string; // ISO timestamp
  registrationOpensAt: string;
  registrationClosesAt: string;

  // Related book (optional)
  bookId?: number;
  book?: Book; // Joined data

  // Cover images
  coverUrl?: string;
  coverUrlEn?: string;

  // Status
  isPublished: boolean;
  registrationStatus?: EventRegistrationStatus; // Computed status considering time and capacity

  createdAt: string;
  updatedAt: string;
};

// Database column names (snake_case) for Supabase queries
export type EventRow = {
  id: number;
  slug: string;
  event_type_code: string;
  venue_id: number;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  event_date: string;
  registration_opens_at: string;
  registration_closes_at: string;
  book_id: number | null;
  cover_url: string | null;
  cover_url_en: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

// Convert database row to application type
export function eventFromRow(row: EventRow, venue?: Venue, book?: Book): Event {
  return {
    id: row.id,
    slug: row.slug,
    eventTypeCode: row.event_type_code,
    venueId: row.venue_id,
    venue,
    title: row.title,
    titleEn: row.title_en ?? undefined,
    description: row.description ?? undefined,
    descriptionEn: row.description_en ?? undefined,
    eventDate: row.event_date,
    registrationOpensAt: row.registration_opens_at,
    registrationClosesAt: row.registration_closes_at,
    bookId: row.book_id ?? undefined,
    book,
    coverUrl: row.cover_url ?? undefined,
    coverUrlEn: row.cover_url_en ?? undefined,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Convert application type to database row (for inserts/updates)
export function eventToRow(event: Partial<Event>): Partial<EventRow> {
  const row: Partial<EventRow> = {};
  if (event.slug !== undefined) row.slug = event.slug;
  if (event.eventTypeCode !== undefined) row.event_type_code = event.eventTypeCode;
  if (event.venueId !== undefined) row.venue_id = event.venueId;
  if (event.title !== undefined) row.title = event.title;
  if (event.titleEn !== undefined) row.title_en = event.titleEn ?? null;
  if (event.description !== undefined) row.description = event.description ?? null;
  if (event.descriptionEn !== undefined) row.description_en = event.descriptionEn ?? null;
  if (event.eventDate !== undefined) row.event_date = event.eventDate;
  if (event.registrationOpensAt !== undefined)
    row.registration_opens_at = event.registrationOpensAt;
  if (event.registrationClosesAt !== undefined)
    row.registration_closes_at = event.registrationClosesAt;
  if (event.bookId !== undefined) row.book_id = event.bookId ?? null;
  if (event.coverUrl !== undefined) row.cover_url = event.coverUrl ?? null;
  if (event.coverUrlEn !== undefined) row.cover_url_en = event.coverUrlEn ?? null;
  if (event.isPublished !== undefined) row.is_published = event.isPublished;
  return row;
}
