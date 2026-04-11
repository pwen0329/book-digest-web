import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/events/route';

vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

vi.mock('@/lib/events', () => ({
  getAllEvents: vi.fn(),
}));

import { getAllEvents } from '@/lib/events';
import type { Event } from '@/types/event';

describe('/api/events (public)', () => {
  const mockEvents: Event[] = [
    {
      id: 1,
      slug: 'event-1',
      eventTypeCode: 'MANDARIN_BOOK_CLUB',
      venueId: 1,
      title: 'Event 1',
      eventDate: '2026-06-01T18:00:00Z',
      registrationOpensAt: '2026-04-01T00:00:00Z',
      registrationClosesAt: '2026-05-30T23:59:59Z',
      isPublished: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns only published events', async () => {
      vi.mocked(getAllEvents).mockResolvedValueOnce(mockEvents);

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toHaveLength(1);
      expect(getAllEvents).toHaveBeenCalledWith({
        venueLocation: undefined,
        isPublished: true, // Always true for public endpoint
        includeVenue: true,
        includeBook: true,
      });
    });

    it('filters by venue location when provided', async () => {
      vi.mocked(getAllEvents).mockResolvedValueOnce(mockEvents);

      const request = new NextRequest('http://localhost/api/events?venueLocation=TW');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getAllEvents).toHaveBeenCalledWith({
        venueLocation: 'TW',
        isPublished: true,
        includeVenue: true,
        includeBook: true,
      });
    });

    it('returns 400 for invalid venue location', async () => {
      const request = new NextRequest('http://localhost/api/events?venueLocation=INVALID');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid venueLocation');
    });

    it('accepts valid venue locations: TW, NL, ONLINE', async () => {
      vi.mocked(getAllEvents).mockResolvedValue(mockEvents);

      for (const location of ['TW', 'NL', 'ONLINE']) {
        const request = new NextRequest(`http://localhost/api/events?venueLocation=${location}`);
        const response = await GET(request);

        expect(response.status).toBe(200);
      }
    });

    it('returns empty array when no published events exist', async () => {
      vi.mocked(getAllEvents).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost/api/events');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toEqual([]);
    });

    it('always enforces isPublished=true regardless of URL params', async () => {
      vi.mocked(getAllEvents).mockResolvedValueOnce(mockEvents);

      // Try to set isPublished=false in URL (should be ignored)
      const request = new NextRequest('http://localhost/api/events?isPublished=false');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getAllEvents).toHaveBeenCalledWith({
        venueLocation: undefined,
        isPublished: true, // Always true, never false
        includeVenue: true,
        includeBook: true,
      });
    });
  });
});
