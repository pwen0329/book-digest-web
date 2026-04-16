import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/event-v2/route';

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
  logServerError: vi.fn(),
}));

vi.mock('@/lib/request-json', () => ({
  parseJsonRequest: vi.fn(),
  JsonRequestError: class JsonRequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('@/lib/events', () => ({
  createEvent: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { parseJsonRequest, JsonRequestError } from '@/lib/request-json';
import { createEvent } from '@/lib/events';
import { revalidatePath } from 'next/cache';
import type { Event } from '@/types/event';

describe('/api/admin/event-v2 POST', () => {
  const mockCreatedEvent: Event = {
    id: 1,
    slug: 'test-event',
    eventTypeCode: 'MANDARIN_BOOK_CLUB',
    venueId: 1,
    title: 'Test Event',
    eventDate: '2026-06-01T18:00:00Z',
    registrationOpensAt: '2026-04-01T00:00:00Z',
    registrationClosesAt: '2026-05-30T23:59:59Z',
    isPublished: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('returns 401 when not authorized', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(false);

      const request = new NextRequest('http://localhost/api/admin/event-v2', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'test',
          eventTypeCode: 'MANDARIN_BOOK_CLUB',
          venueId: 1,
          title: 'Test',
          eventDate: '2026-06-01T18:00:00Z',
          registrationOpensAt: '2026-04-01T00:00:00Z',
          registrationClosesAt: '2026-05-30T23:59:59Z',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('creates a new event with valid payload', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockResolvedValueOnce({
        slug: 'test-event',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 1,
        title: 'Test Event',
        eventDate: '2026-06-01T18:00:00Z',
        registrationOpensAt: '2026-04-01T00:00:00Z',
        registrationClosesAt: '2026-05-30T23:59:59Z',
        isPublished: true,
      });
      vi.mocked(createEvent).mockResolvedValueOnce(mockCreatedEvent);

      const request = new NextRequest('http://localhost/api/admin/event-v2', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'test-event',
          eventTypeCode: 'MANDARIN_BOOK_CLUB',
          venueId: 1,
          title: 'Test Event',
          eventDate: '2026-06-01T18:00:00Z',
          registrationOpensAt: '2026-04-01T00:00:00Z',
          registrationClosesAt: '2026-05-30T23:59:59Z',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.ok).toBe(true);
      expect(data.event.slug).toBe('test-event');
      expect(createEvent).toHaveBeenCalled();
    });

    it('revalidates event routes after creation', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockResolvedValueOnce({
        slug: 'test-event',
        eventTypeCode: 'MANDARIN_BOOK_CLUB',
        venueId: 1,
        title: 'Test Event',
        eventDate: '2026-06-01T18:00:00Z',
        registrationOpensAt: '2026-04-01T00:00:00Z',
        registrationClosesAt: '2026-05-30T23:59:59Z',
      });
      vi.mocked(createEvent).mockResolvedValueOnce(mockCreatedEvent);

      const request = new NextRequest('http://localhost/api/admin/event-v2', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'test-event',
          eventTypeCode: 'MANDARIN_BOOK_CLUB',
          venueId: 1,
          title: 'Test Event',
          eventDate: '2026-06-01T18:00:00Z',
          registrationOpensAt: '2026-04-01T00:00:00Z',
          registrationClosesAt: '2026-05-30T23:59:59Z',
        }),
      });
      await POST(request);

      expect(revalidatePath).toHaveBeenCalledWith('/zh/events');
      expect(revalidatePath).toHaveBeenCalledWith('/en/events');
      expect(revalidatePath).toHaveBeenCalledWith('/zh/signup');
      expect(revalidatePath).toHaveBeenCalledWith('/en/signup');
      expect(revalidatePath).toHaveBeenCalledWith('/zh/engclub');
      expect(revalidatePath).toHaveBeenCalledWith('/en/engclub');
      expect(revalidatePath).toHaveBeenCalledWith('/zh/detox');
      expect(revalidatePath).toHaveBeenCalledWith('/en/detox');
    });

    it('returns 400 for invalid JSON', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockRejectedValueOnce(
        new Error('Invalid JSON')
      );

      const request = new NextRequest('http://localhost/api/admin/event-v2', {
        method: 'POST',
        body: 'invalid json',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON payload.');
    });

    it('returns 400 for JsonRequestError', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockRejectedValueOnce(
        new JsonRequestError('Missing required field: venueId', 400)
      );

      const request = new NextRequest('http://localhost/api/admin/event-v2', {
        method: 'POST',
        body: JSON.stringify({ slug: 'test' }), // Missing required fields
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required field');
    });

    it('creates event with optional fields', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockResolvedValueOnce({
        slug: 'test-event',
        eventTypeCode: 'ENGLISH_CLUB',
        venueId: 2,
        bookId: 5,
        title: 'Test Event',
        titleEn: 'Test Event EN',
        description: 'Test description',
        descriptionEn: 'Test description EN',
        eventDate: '2026-06-01T18:00:00Z',
        registrationOpensAt: '2026-04-01T00:00:00Z',
        registrationClosesAt: '2026-05-30T23:59:59Z',
        coverUrl: '/images/event.jpg',
        coverUrlEn: '/images/event-en.jpg',
        isPublished: false,
      });
      vi.mocked(createEvent).mockResolvedValueOnce(mockCreatedEvent);

      const request = new NextRequest('http://localhost/api/admin/event-v2', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'test-event',
          eventTypeCode: 'ENGLISH_CLUB',
          venueId: 2,
          bookId: 5,
          title: 'Test Event',
          titleEn: 'Test Event EN',
          description: 'Test description',
          eventDate: '2026-06-01T18:00:00Z',
          registrationOpensAt: '2026-04-01T00:00:00Z',
          registrationClosesAt: '2026-05-30T23:59:59Z',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'test-event',
          eventTypeCode: 'ENGLISH_CLUB',
          venueId: 2,
          bookId: 5,
        })
      );
    });

    it('handles datetime validation', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockRejectedValueOnce(
        new JsonRequestError('Invalid datetime format', 400)
      );

      const request = new NextRequest('http://localhost/api/admin/event-v2', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'test-event',
          eventTypeCode: 'MANDARIN_BOOK_CLUB',
          venueId: 1,
          title: 'Test Event',
          eventDate: 'invalid-date', // Invalid format
          registrationOpensAt: '2026-04-01T00:00:00Z',
          registrationClosesAt: '2026-05-30T23:59:59Z',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
