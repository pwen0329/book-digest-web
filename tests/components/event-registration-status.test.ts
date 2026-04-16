import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

// Mock Supabase utils - use vi.hoisted to avoid initialization issues
const { mockFetchRows } = vi.hoisted(() => ({
  mockFetchRows: vi.fn(),
}));

vi.mock('@/lib/supabase-utils', () => ({
  isSupabaseConfigured: () => true,
  fetchRows: mockFetchRows,
  fetchSingleRow: vi.fn(),
  insertRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
}));

vi.mock('@/lib/venues', () => ({
  getVenueById: vi.fn((id: number) => {
    const venues: Record<number, any> = {
      1: { id: 1, name: 'Test Venue TW', nameEn: 'Test Venue TW', location: 'TW', address: 'Test Address', maxCapacity: 20, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
      2: { id: 2, name: 'Test Venue NL', nameEn: 'Test Venue NL', location: 'NL', address: 'Test Address', maxCapacity: 15, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
    };
    return Promise.resolve(venues[id] || null);
  }),
}));

vi.mock('@/lib/books', () => ({
  getBookById: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/lib/registration-store', () => ({
  countActiveRegistrationsByEventId: vi.fn((eventId: number) => {
    // Mock registration counts for different scenarios
    const counts: Record<number, number> = {
      1: 0,  // No registrations
      2: 10, // Some registrations
      3: 20, // Full capacity (venue maxCapacity = 20)
      4: 15, // Full capacity for NL venue (maxCapacity = 15)
    };
    return Promise.resolve(counts[eventId] || 0);
  }),
}));

import { getAllEvents } from '@/lib/events';
import { EventRegistrationStatus } from '@/types/event';
import type { Event, EventRow } from '@/types/event';
import type { Venue } from '@/types/venue';

describe('Event Registration Status', () => {
  // Use dates relative to current time to avoid test failures due to time
  const getFutureDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  };

  const getPastDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns UPCOMING when registration has not opened yet', async () => {
    mockFetchRows.mockResolvedValueOnce([
      {
        id: 1,
        slug: 'test-upcoming',
        event_type_code: 'MANDARIN_BOOK_CLUB',
        venue_id: 1,
        title: 'Upcoming Event',
        event_date: getFutureDate(15),
        registration_opens_at: getFutureDate(5), // Opens 5 days from now
        registration_closes_at: getFutureDate(14),
        is_published: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as EventRow,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.UPCOMING);
  });

  it('returns CLOSED when registration has closed', async () => {
    mockFetchRows.mockResolvedValueOnce([
      {
        id: 1,
        slug: 'test-closed',
        event_type_code: 'MANDARIN_BOOK_CLUB',
        venue_id: 1,
        title: 'Closed Event',
        event_date: getFutureDate(15),
        registration_opens_at: getPastDate(30),
        registration_closes_at: getPastDate(1), // Closed 1 day ago
        is_published: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as EventRow,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.CLOSED);
  });

  it('returns FULL when registration is open but venue is at capacity', async () => {
    mockFetchRows.mockResolvedValueOnce([
      {
        id: 3, // This ID has 20 registrations (full capacity)
        slug: 'test-full',
        event_type_code: 'MANDARIN_BOOK_CLUB',
        venue_id: 1, // Venue with maxCapacity = 20
        title: 'Full Event',
        event_date: getFutureDate(15),
        registration_opens_at: getPastDate(30),
        registration_closes_at: getFutureDate(14),
        is_published: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as EventRow,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.FULL);
  });

  it('returns OPEN when registration is open and venue has available capacity', async () => {
    mockFetchRows.mockResolvedValueOnce([
      {
        id: 2, // This ID has 10 registrations (below capacity)
        slug: 'test-open',
        event_type_code: 'MANDARIN_BOOK_CLUB',
        venue_id: 1, // Venue with maxCapacity = 20
        title: 'Open Event',
        event_date: getFutureDate(15),
        registration_opens_at: getPastDate(30),
        registration_closes_at: getFutureDate(14),
        is_published: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as EventRow,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.OPEN);
  });

  it('returns UNKNOWN when venue data is missing', async () => {
    mockFetchRows.mockResolvedValueOnce([
      {
        id: 1,
        slug: 'test-unknown',
        event_type_code: 'MANDARIN_BOOK_CLUB',
        venue_id: 999, // Non-existent venue ID
        title: 'Unknown Venue Event',
        event_date: getFutureDate(15),
        registration_opens_at: getPastDate(30),
        registration_closes_at: getFutureDate(14),
        is_published: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as EventRow,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.UNKNOWN);
  });

  it('checks time constraints before capacity constraints', async () => {
    mockFetchRows.mockResolvedValueOnce([
      {
        id: 3, // This ID would return FULL if capacity was checked
        slug: 'test-upcoming-full',
        event_type_code: 'MANDARIN_BOOK_CLUB',
        venue_id: 1,
        title: 'Upcoming but Full Event',
        event_date: getFutureDate(15),
        registration_opens_at: getFutureDate(5), // Opens 5 days from now
        registration_closes_at: getFutureDate(14),
        is_published: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as EventRow,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    // Should be UPCOMING (time constraint takes precedence over capacity)
    // Even though this event has 20 registrations (full capacity), it's UPCOMING not FULL
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.UPCOMING);
  });

  it('includes venue data when includeRegistrationStatus is true', async () => {
    mockFetchRows.mockResolvedValueOnce([
      {
        id: 1,
        slug: 'test-venue-included',
        event_type_code: 'MANDARIN_BOOK_CLUB',
        venue_id: 1,
        title: 'Event with Venue',
        event_date: getFutureDate(15),
        registration_opens_at: getPastDate(30),
        registration_closes_at: getFutureDate(14),
        is_published: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as EventRow,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events[0].venue).toBeDefined();
    expect(events[0].venue?.id).toBe(1);
    expect(events[0].venue?.maxCapacity).toBe(20);
  });

  it('does not populate registrationStatus when includeRegistrationStatus is false', async () => {
    mockFetchRows.mockResolvedValueOnce([
      {
        id: 1,
        slug: 'test-no-status',
        event_type_code: 'MANDARIN_BOOK_CLUB',
        venue_id: 1,
        title: 'Event without Status',
        event_date: getFutureDate(15),
        registration_opens_at: getPastDate(30),
        registration_closes_at: getFutureDate(14),
        is_published: true,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      } as EventRow,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: false });

    expect(events[0].registrationStatus).toBeUndefined();
  });
});
