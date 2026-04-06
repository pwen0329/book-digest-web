import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { getAllEvents } from '@/lib/events';
import { EventRegistrationStatus } from '@/types/event';
import type { Event } from '@/types/event';
import type { Venue } from '@/types/venue';

// Mock dependencies
vi.mock('@/lib/supabase-utils', () => ({
  isSupabaseConfigured: () => false,
  shouldForceLocalPersistentStores: () => false,
}));

vi.mock('@/lib/venues', () => ({
  getVenueById: vi.fn((id: number) => {
    const venues: Record<number, Venue> = {
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

vi.mock('@/lib/json-store', () => ({
  readJsonFile: vi.fn(() => []),
  writeJsonFile: vi.fn(),
  resolveWorkspacePath: vi.fn((path: string) => path),
}));

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
    const { readJsonFile } = await import('@/lib/json-store');
    vi.mocked(readJsonFile).mockReturnValue([
      {
        id: 1,
        slug: 'test-upcoming',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 1,
        title: 'Upcoming Event',
        eventDate: getFutureDate(15),
        registrationOpensAt: getFutureDate(5), // Opens 5 days from now
        registrationClosesAt: getFutureDate(14),
        isPublished: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      } as Event,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.UPCOMING);
  });

  it('returns CLOSED when registration has closed', async () => {
    const { readJsonFile } = await import('@/lib/json-store');
    vi.mocked(readJsonFile).mockReturnValue([
      {
        id: 1,
        slug: 'test-closed',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 1,
        title: 'Closed Event',
        eventDate: getFutureDate(15),
        registrationOpensAt: getPastDate(30),
        registrationClosesAt: getPastDate(1), // Closed 1 day ago
        isPublished: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      } as Event,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.CLOSED);
  });

  it('returns FULL when registration is open but venue is at capacity', async () => {
    const { readJsonFile } = await import('@/lib/json-store');
    vi.mocked(readJsonFile).mockReturnValue([
      {
        id: 3, // This ID has 20 registrations (full capacity)
        slug: 'test-full',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 1, // Venue with maxCapacity = 20
        title: 'Full Event',
        eventDate: getFutureDate(15),
        registrationOpensAt: getPastDate(30),
        registrationClosesAt: getFutureDate(14),
        isPublished: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      } as Event,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.FULL);
  });

  it('returns OPEN when registration is open and venue has available capacity', async () => {
    const { readJsonFile } = await import('@/lib/json-store');
    vi.mocked(readJsonFile).mockReturnValue([
      {
        id: 2, // This ID has 10 registrations (below capacity)
        slug: 'test-open',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 1, // Venue with maxCapacity = 20
        title: 'Open Event',
        eventDate: getFutureDate(15),
        registrationOpensAt: getPastDate(30),
        registrationClosesAt: getFutureDate(14),
        isPublished: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      } as Event,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.OPEN);
  });

  it('returns UNKNOWN when venue data is missing', async () => {
    const { readJsonFile } = await import('@/lib/json-store');
    vi.mocked(readJsonFile).mockReturnValue([
      {
        id: 1,
        slug: 'test-unknown',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 999, // Non-existent venue ID
        title: 'Unknown Venue Event',
        eventDate: getFutureDate(15),
        registrationOpensAt: getPastDate(30),
        registrationClosesAt: getFutureDate(14),
        isPublished: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      } as Event,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events).toHaveLength(1);
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.UNKNOWN);
  });

  it('checks time constraints before capacity constraints', async () => {
    const { readJsonFile } = await import('@/lib/json-store');
    vi.mocked(readJsonFile).mockReturnValue([
      {
        id: 3, // This ID would return FULL if capacity was checked
        slug: 'test-upcoming-full',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 1,
        title: 'Upcoming but Full Event',
        eventDate: getFutureDate(15),
        registrationOpensAt: getFutureDate(5), // Opens 5 days from now
        registrationClosesAt: getFutureDate(14),
        isPublished: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      } as Event,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    // Should be UPCOMING (time constraint takes precedence over capacity)
    // Even though this event has 20 registrations (full capacity), it's UPCOMING not FULL
    expect(events[0].registrationStatus).toBe(EventRegistrationStatus.UPCOMING);
  });

  it('includes venue data when includeRegistrationStatus is true', async () => {
    const { readJsonFile } = await import('@/lib/json-store');
    vi.mocked(readJsonFile).mockReturnValue([
      {
        id: 1,
        slug: 'test-venue-included',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 1,
        title: 'Event with Venue',
        eventDate: getFutureDate(15),
        registrationOpensAt: getPastDate(30),
        registrationClosesAt: getFutureDate(14),
        isPublished: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      } as Event,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: true });

    expect(events[0].venue).toBeDefined();
    expect(events[0].venue?.id).toBe(1);
    expect(events[0].venue?.maxCapacity).toBe(20);
  });

  it('does not populate registrationStatus when includeRegistrationStatus is false', async () => {
    const { readJsonFile } = await import('@/lib/json-store');
    vi.mocked(readJsonFile).mockReturnValue([
      {
        id: 1,
        slug: 'test-no-status',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 1,
        title: 'Event without Status',
        eventDate: getFutureDate(15),
        registrationOpensAt: getPastDate(30),
        registrationClosesAt: getFutureDate(14),
        isPublished: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      } as Event,
    ]);

    const events = await getAllEvents({ includeRegistrationStatus: false });

    expect(events[0].registrationStatus).toBeUndefined();
  });
});
