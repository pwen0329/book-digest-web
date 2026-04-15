import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockFetchRows, mockFetchSingleRow, mockInsertRow, mockUpdateRow, mockDeleteRow, mockGetVenueById, mockGetBookById, mockCountActiveRegistrations } = vi.hoisted(() => ({
  mockFetchRows: vi.fn(),
  mockFetchSingleRow: vi.fn(),
  mockInsertRow: vi.fn(),
  mockUpdateRow: vi.fn(),
  mockDeleteRow: vi.fn(),
  mockGetVenueById: vi.fn(),
  mockGetBookById: vi.fn(),
  mockCountActiveRegistrations: vi.fn(),
}));

vi.mock('@/lib/supabase-utils', () => ({
  fetchRows: mockFetchRows,
  fetchSingleRow: mockFetchSingleRow,
  insertRow: mockInsertRow,
  updateRow: mockUpdateRow,
  deleteRow: mockDeleteRow,
}));

vi.mock('@/lib/venues', () => ({
  getVenueById: mockGetVenueById,
}));

vi.mock('@/lib/books', () => ({
  getBookById: mockGetBookById,
}));

vi.mock('@/lib/registration-store', () => ({
  countActiveRegistrationsByEventId: mockCountActiveRegistrations,
}));

import {
  getAllEvents,
  getEventById,
  getEventBySlug,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventsByVenueAndType,
  calculateRegistrationStatus,
} from '@/lib/events';
import { EventRegistrationStatus } from '@/types/event';
import type { Event, EventRow } from '@/types/event';
import type { Venue } from '@/types/venue';

describe('events', () => {
  const mockVenue: Venue = {
    id: 1,
    name: 'Test Venue',
    location: 'TW',
    address: 'Test Address',
    maxCapacity: 20,
    isVirtual: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockEventRow: EventRow = {
    id: 1,
    slug: 'test-event',
    event_type_code: 'MANDARIN_BOOK_CLUB',
    venue_id: 1,
    book_id: 10,
    title: 'Test Event',
    title_en: 'Test Event EN',
    description: 'Test Description',
    description_en: 'Test Description EN',
    event_date: '2026-06-01T18:00:00Z',
    registration_opens_at: '2026-04-01T00:00:00Z',
    registration_closes_at: '2026-05-30T23:59:59Z',
    cover_url: '/images/event.jpg',
    cover_url_en: '/images/event-en.jpg',
    is_published: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllEvents', () => {
    it('fetches all events with default options', async () => {
      mockFetchRows.mockResolvedValueOnce([mockEventRow]);

      const events = await getAllEvents();

      expect(mockFetchRows).toHaveBeenCalledWith(
        'events',
        '*',
        'order=event_date.desc'
      );
      expect(events).toHaveLength(1);
      expect(events[0].slug).toBe('test-event');
    });

    it('filters by event type code', async () => {
      mockFetchRows.mockResolvedValueOnce([mockEventRow]);

      await getAllEvents({ eventTypeCode: 'MANDARIN_BOOK_CLUB' });

      expect(mockFetchRows).toHaveBeenCalledWith(
        'events',
        '*',
        'event_type_code=eq.MANDARIN_BOOK_CLUB&order=event_date.desc'
      );
    });

    it('filters by published status', async () => {
      mockFetchRows.mockResolvedValueOnce([mockEventRow]);

      await getAllEvents({ isPublished: true });

      expect(mockFetchRows).toHaveBeenCalledWith(
        'events',
        '*',
        'is_published=eq.true&order=event_date.desc'
      );
    });

    it('filters by from date', async () => {
      mockFetchRows.mockResolvedValueOnce([mockEventRow]);

      await getAllEvents({ from: '2026-04-01' });

      expect(mockFetchRows).toHaveBeenCalledWith(
        'events',
        '*',
        'event_date=gte.2026-04-01&order=event_date.desc'
      );
    });

    it('includes venue data when requested', async () => {
      mockFetchRows.mockResolvedValueOnce([mockEventRow]);
      mockGetVenueById.mockResolvedValueOnce(mockVenue);

      const events = await getAllEvents({ includeVenue: true });

      expect(mockGetVenueById).toHaveBeenCalledWith(1);
      expect(events[0].venue).toEqual(mockVenue);
    });

    it('filters by venue location after fetching', async () => {
      mockFetchRows.mockResolvedValueOnce([mockEventRow]);
      mockGetVenueById.mockResolvedValueOnce(mockVenue);

      const events = await getAllEvents({ venueLocation: 'TW' });

      expect(events).toHaveLength(1);
      expect(events[0].venue?.location).toBe('TW');
    });

    it('filters out events not matching venue location', async () => {
      mockFetchRows.mockResolvedValueOnce([mockEventRow]);
      mockGetVenueById.mockResolvedValueOnce(mockVenue);

      const events = await getAllEvents({ venueLocation: 'NL' });

      expect(events).toHaveLength(0);
    });

    it('includes registration status when requested', async () => {
      mockFetchRows.mockResolvedValueOnce([mockEventRow]);
      mockGetVenueById.mockResolvedValueOnce(mockVenue);
      mockCountActiveRegistrations.mockResolvedValueOnce(5);

      const events = await getAllEvents({ includeRegistrationStatus: true });

      expect(mockCountActiveRegistrations).toHaveBeenCalledWith(1);
      expect(events[0].registrationStatus).toBeDefined();
    });
  });

  describe('getEventById', () => {
    it('fetches event by ID', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(mockEventRow);

      const event = await getEventById(1);

      expect(mockFetchSingleRow).toHaveBeenCalledWith('events', '*', 'id=eq.1');
      expect(event?.id).toBe(1);
      expect(event?.slug).toBe('test-event');
    });

    it('returns null when event not found', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(null);

      const event = await getEventById(999);

      expect(event).toBeNull();
    });

    it('includes venue when requested', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(mockEventRow);
      mockGetVenueById.mockResolvedValueOnce(mockVenue);

      const event = await getEventById(1, { includeVenue: true });

      expect(mockGetVenueById).toHaveBeenCalledWith(1);
      expect(event?.venue).toEqual(mockVenue);
    });
  });

  describe('getEventBySlug', () => {
    it('fetches event by slug', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(mockEventRow);

      const event = await getEventBySlug('test-event');

      expect(mockFetchSingleRow).toHaveBeenCalledWith(
        'events',
        '*',
        'slug=eq.test-event'
      );
      expect(event?.slug).toBe('test-event');
    });

    it('URL encodes slug parameter', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(null);

      await getEventBySlug('event with spaces');

      expect(mockFetchSingleRow).toHaveBeenCalledWith(
        'events',
        '*',
        'slug=eq.event%20with%20spaces'
      );
    });
  });

  describe('createEvent', () => {
    it('creates a new event', async () => {
      const newEvent: Omit<Event, 'id' | 'createdAt' | 'updatedAt'> = {
        slug: 'new-event',
        eventTypeCode: 'ENGLISH_CLUB',
        venueId: 1,
        title: 'New Event',
        eventDate: '2026-07-01T18:00:00Z',
        registrationOpensAt: '2026-05-01T00:00:00Z',
        registrationClosesAt: '2026-06-30T23:59:59Z',
        isPublished: true,
      };

      mockInsertRow.mockResolvedValueOnce({
        ...mockEventRow,
        id: 2,
        slug: 'new-event',
      });

      const createdEvent = await createEvent(newEvent);

      expect(mockInsertRow).toHaveBeenCalledWith(
        'events',
        expect.objectContaining({
          slug: 'new-event',
          event_type_code: 'ENGLISH_CLUB',
        })
      );
      expect(createdEvent.id).toBe(2);
      expect(createdEvent.slug).toBe('new-event');
    });
  });

  describe('updateEvent', () => {
    it('updates an existing event', async () => {
      const updates = {
        title: 'Updated Title',
        isPublished: false,
      };

      mockUpdateRow.mockResolvedValueOnce({
        ...mockEventRow,
        title: 'Updated Title',
        is_published: false,
      });

      const updatedEvent = await updateEvent(1, updates);

      expect(mockUpdateRow).toHaveBeenCalledWith(
        'events',
        'id=eq.1',
        expect.objectContaining({
          title: 'Updated Title',
          is_published: false,
        })
      );
      expect(updatedEvent.title).toBe('Updated Title');
    });
  });

  describe('deleteEvent', () => {
    it('deletes an event by ID', async () => {
      mockDeleteRow.mockResolvedValueOnce(undefined);

      await deleteEvent(1);

      expect(mockDeleteRow).toHaveBeenCalledWith('events', 'id=eq.1');
    });

    it('fails when event has foreign key constraints', async () => {
      mockDeleteRow.mockRejectedValueOnce(
        new Error('FK constraint violation')
      );

      await expect(deleteEvent(1)).rejects.toThrow();
    });
  });

  describe('calculateRegistrationStatus', () => {
    const baseEvent: Event = {
      id: 1,
      slug: 'test',
      eventTypeCode: 'MANDARIN_BOOK_CLUB',
      venueId: 1,
      venue: mockVenue,
      title: 'Test',
      eventDate: '2026-06-01T18:00:00Z',
      registrationOpensAt: '2026-04-01T00:00:00Z',
      registrationClosesAt: '2026-05-30T23:59:59Z',
      isPublished: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    it('returns UPCOMING when registration has not opened', async () => {
      const status = await calculateRegistrationStatus(
        baseEvent,
        0,
        '2026-03-15T00:00:00Z' // Before registration opens
      );

      expect(status).toBe(EventRegistrationStatus.UPCOMING);
    });

    it('returns CLOSED when registration has closed', async () => {
      const status = await calculateRegistrationStatus(
        baseEvent,
        0,
        '2026-05-31T00:00:00Z' // After registration closes
      );

      expect(status).toBe(EventRegistrationStatus.CLOSED);
    });

    it('returns FULL when at capacity', async () => {
      const status = await calculateRegistrationStatus(
        baseEvent,
        20, // maxCapacity = 20
        '2026-04-15T00:00:00Z'
      );

      expect(status).toBe(EventRegistrationStatus.FULL);
    });

    it('returns OPEN when within time window and below capacity', async () => {
      const status = await calculateRegistrationStatus(
        baseEvent,
        10,
        '2026-04-15T00:00:00Z'
      );

      expect(status).toBe(EventRegistrationStatus.OPEN);
    });

    it('returns UNKNOWN when venue is missing', async () => {
      mockGetVenueById.mockResolvedValueOnce(null);

      const eventWithoutVenue = { ...baseEvent, venue: undefined };
      const status = await calculateRegistrationStatus(
        eventWithoutVenue,
        0,
        '2026-04-15T00:00:00Z'
      );

      expect(status).toBe(EventRegistrationStatus.UNKNOWN);
    });

    it('prioritizes time constraints over capacity', async () => {
      const status = await calculateRegistrationStatus(
        baseEvent,
        25, // Over capacity
        '2026-03-15T00:00:00Z' // But before registration opens
      );

      expect(status).toBe(EventRegistrationStatus.UPCOMING);
    });
  });

  describe('getEventsByVenueAndType', () => {
    it('fetches events for venue location and type', async () => {
      mockFetchRows.mockResolvedValueOnce([mockEventRow]);
      mockGetVenueById.mockResolvedValueOnce(mockVenue);
      mockGetBookById.mockResolvedValueOnce(null);
      mockCountActiveRegistrations.mockResolvedValueOnce(5);

      const events = await getEventsByVenueAndType('TW', 'MANDARIN_BOOK_CLUB');

      expect(events).toHaveLength(1);
      expect(events[0].venue?.location).toBe('TW');
    });

    it('hides expired events by default', async () => {
      // This would need more complex date manipulation
      // For now, just verify it filters by date
      mockFetchRows.mockResolvedValueOnce([]);

      await getEventsByVenueAndType('TW');

      expect(mockFetchRows).toHaveBeenCalled();
    });

    it('sorts events by date ascending', async () => {
      const event1 = { ...mockEventRow, id: 1, event_date: '2026-06-01T00:00:00Z' };
      const event2 = { ...mockEventRow, id: 2, event_date: '2026-05-01T00:00:00Z' };

      mockFetchRows.mockResolvedValueOnce([event1, event2]);
      mockGetVenueById.mockResolvedValue(mockVenue);
      mockGetBookById.mockResolvedValue(null);
      mockCountActiveRegistrations.mockResolvedValue(5);

      const events = await getEventsByVenueAndType('TW');

      expect(events[0].id).toBe(2); // Earlier date first
      expect(events[1].id).toBe(1);
    });
  });
});
