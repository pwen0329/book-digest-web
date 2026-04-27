// Event type - scheduled reading club sessions

import type { Book } from './book';
import type { SignupIntroTemplate } from './signup-intro';

export type VenueLocation = 'TW' | 'NL' | 'ONLINE';

export const EventRegistrationStatus = {
  UPCOMING: 'upcoming',
  OPEN: 'open',
  CLOSED: 'closed',
  FULL: 'full',
  UNKNOWN: 'unknown',
} as const;

export type EventRegistrationStatus = typeof EventRegistrationStatus[keyof typeof EventRegistrationStatus];

export type PaymentCurrency = 'TWD' | 'EUR' | 'USD';

export type Event = {
  id: number;
  slug: string;
  eventTypeCode: string;

  // Inline venue fields (replacing separate venue table)
  venueName?: string; // Optional - may be null until 1 week before event
  venueNameEn?: string; // Optional
  venueCapacity: number; // Required - used for registration status calculation
  venueAddress?: string; // Optional
  venueLocation: VenueLocation; // Required - TW, NL, or ONLINE

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

  // Payment (required fields with defaults)
  paymentAmount: number; // Default 0 (free event)
  paymentCurrency: PaymentCurrency; // Default 'TWD'

  // Signup intro template (required field - defaults to 'default_paid')
  introTemplateName: string;
  introTemplate?: SignupIntroTemplate; // Joined data when needed

  createdAt: string;
  updatedAt: string;
};

// Database column names (snake_case) for Supabase queries
export type EventRow = {
  id: number;
  slug: string;
  event_type_code: string;

  // Inline venue fields
  venue_name: string | null;
  venue_name_en: string | null;
  venue_capacity: number;
  venue_address: string | null;
  venue_location: string;

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
  payment_amount: number;
  payment_currency: string;
  intro_template_name: string; // NOT NULL - defaults to 'default_paid'
  created_at: string;
  updated_at: string;
};

// Convert database row to application type
export function eventFromRow(row: EventRow, book?: Book, introTemplate?: SignupIntroTemplate): Event {
  return {
    id: row.id,
    slug: row.slug,
    eventTypeCode: row.event_type_code,
    venueName: row.venue_name ?? undefined,
    venueNameEn: row.venue_name_en ?? undefined,
    venueCapacity: row.venue_capacity,
    venueAddress: row.venue_address ?? undefined,
    venueLocation: row.venue_location as VenueLocation,
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
    paymentAmount: row.payment_amount,
    paymentCurrency: row.payment_currency as PaymentCurrency,
    introTemplateName: row.intro_template_name,
    introTemplate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Convert application type to database row (for inserts/updates)
export function eventToRow(event: Partial<Event>): Partial<EventRow> {
  const row: Partial<EventRow> = {};
  if (event.slug !== undefined) row.slug = event.slug;
  if (event.eventTypeCode !== undefined) row.event_type_code = event.eventTypeCode;
  if (event.venueName !== undefined) row.venue_name = event.venueName ?? null;
  if (event.venueNameEn !== undefined) row.venue_name_en = event.venueNameEn ?? null;
  if (event.venueCapacity !== undefined) row.venue_capacity = event.venueCapacity;
  if (event.venueAddress !== undefined) row.venue_address = event.venueAddress ?? null;
  if (event.venueLocation !== undefined) row.venue_location = event.venueLocation;
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
  if (event.paymentAmount !== undefined) row.payment_amount = event.paymentAmount;
  if (event.paymentCurrency !== undefined) row.payment_currency = event.paymentCurrency;
  if (event.introTemplateName !== undefined) row.intro_template_name = event.introTemplateName;
  return row;
}
