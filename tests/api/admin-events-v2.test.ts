import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/events-v2/route';

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

vi.mock('@/lib/events', () => ({
  getAllEvents: vi.fn(),
}));

import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { getAllEvents } from '@/lib/events';
import type { Event } from '@/types/event';

describe('/api/admin/events-v2', () => {
  const mockEvents: Event[] = [
    {
      id: 1,
      slug: 'event-1',
      eventTypeCode: 'MANDARIN_BOOK_CLUB',
      venueName: 'Test Venue 1',
      venueCapacity: 30,
      venueLocation: 'TW',
      paymentAmount: 0,
      paymentCurrency: 'TWD',
      title: 'Event 1',
      eventDate: '2026-06-01T18:00:00Z',
      registrationOpensAt: '2026-04-01T00:00:00Z',
      registrationClosesAt: '2026-05-30T23:59:59Z',
      isPublished: true,
      introTemplateName: 'default_paid',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      slug: 'event-2',
      eventTypeCode: 'ENGLISH_CLUB',
      venueName: 'Test Venue 2',
      venueCapacity: 25,
      venueLocation: 'NL',
      paymentAmount: 5,
      paymentCurrency: 'EUR',
      title: 'Event 2',
      eventDate: '2026-07-01T18:00:00Z',
      registrationOpensAt: '2026-05-01T00:00:00Z',
      registrationClosesAt: '2026-06-30T23:59:59Z',
      isPublished: false,
      introTemplateName: 'default_paid',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when not authorized', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(false);

      const request = new NextRequest('http://localhost/api/admin/events-v2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns all events when authorized', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(getAllEvents).mockResolvedValueOnce(mockEvents);

      const request = new NextRequest('http://localhost/api/admin/events-v2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toHaveLength(2);
      expect(getAllEvents).toHaveBeenCalledWith({
        eventTypeCode: undefined,
        isPublished: undefined,
        includeBook: true,
      });
    });

    it('filters by event type code when provided', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(getAllEvents).mockResolvedValueOnce([mockEvents[0]]);

      const request = new NextRequest(
        'http://localhost/api/admin/events-v2?eventTypeCode=MANDARIN_BOOK_CLUB'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(getAllEvents).toHaveBeenCalledWith({
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        isPublished: undefined,
        includeBook: true,
      });
    });

    it('filters by isPublished when provided', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(getAllEvents).mockResolvedValueOnce([mockEvents[0]]);

      const request = new NextRequest(
        'http://localhost/api/admin/events-v2?isPublished=true'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(getAllEvents).toHaveBeenCalledWith({
        eventTypeCode: undefined,
        isPublished: true,
        includeBook: true,
      });
    });

    it('combines multiple filters', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(getAllEvents).mockResolvedValueOnce([mockEvents[0]]);

      const request = new NextRequest(
        'http://localhost/api/admin/events-v2?eventTypeCode=MANDARIN_BOOK_CLUB&isPublished=true'
      );
      const response = await GET(request);

      expect(getAllEvents).toHaveBeenCalledWith({
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        isPublished: true,
        includeBook: true,
      });
    });

    it('returns empty array when no events match', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(getAllEvents).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost/api/admin/events-v2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.events).toEqual([]);
    });
  });
});
