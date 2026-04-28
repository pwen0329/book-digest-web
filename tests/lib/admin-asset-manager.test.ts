import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Book } from '@/types/book';
import type { Event } from '@/types/event';

vi.mock('@/lib/env', () => ({
  SUPABASE_CONFIG: {
    STORAGE_BUCKET: 'test-bucket',
    TABLES: {},
  },
}));

vi.mock('@/lib/supabase-utils', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

vi.mock('@/lib/books-db');
vi.mock('@/lib/events');

const { buildManagedAssetReport, pruneOrphanedManagedAssets, cleanupRemovedAdminAssets } = await import('@/lib/admin-asset-manager');
const { getAllBooksFromDB } = await import('@/lib/books-db');
const { getAllEvents } = await import('@/lib/events');

describe('admin-asset-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('buildManagedAssetReport', () => {
    it('should generate report with no assets', async () => {
      vi.mocked(getAllBooksFromDB).mockResolvedValue([]);
      vi.mocked(getAllEvents).mockResolvedValue([]);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      const report = await buildManagedAssetReport(168);

      expect(report.referencedCount).toBe(0);
      expect(report.storedCount).toBe(0);
      expect(report.orphanedCount).toBe(0);
      expect(report.missingReferencedCount).toBe(0);
      expect(report.gracePeriodHours).toBe(168);
    });

    it('should detect orphaned assets', async () => {
      vi.mocked(getAllBooksFromDB).mockResolvedValue([]);
      vi.mocked(getAllEvents).mockResolvedValue([]);

      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call for books scope
          return {
            ok: true,
            json: async () => [
              {
                name: 'orphaned-image.webp',
                updated_at: '2026-01-01T00:00:00Z',
              },
            ],
          } as Response;
        }
        // Second call for events scope
        return {
          ok: true,
          json: async () => [],
        } as Response;
      });

      const report = await buildManagedAssetReport(168);

      expect(report.storedCount).toBe(1);
      expect(report.orphanedCount).toBe(1);
      expect(report.orphaned[0].fileName).toBe('orphaned-image.webp');
      expect(report.orphaned[0].storage).toBe('supabase');
    });

    it('should detect missing referenced assets', async () => {
      const books: Book[] = [{
        id: 1,
        slug: 'test-book',
        title: 'Test Book',
        titleEn: undefined,
        author: 'Author',
        authorEn: undefined,
        coverUrl: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/missing-cover.webp',
        coverUrlEn: undefined,
        summary: undefined,
        summaryEn: undefined,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }];

      vi.mocked(getAllBooksFromDB).mockResolvedValue(books);
      vi.mocked(getAllEvents).mockResolvedValue([]);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      const report = await buildManagedAssetReport(168);

      expect(report.referencedCount).toBe(1);
      expect(report.storedCount).toBe(0);
      expect(report.missingReferencedCount).toBe(1);
      expect(report.missingReferenced[0].fileName).toBe('missing-cover.webp');
      expect(report.missingReferenced[0].scope).toBe('books');
    });

    it('should match stored and referenced assets', async () => {
      const books: Book[] = [{
        id: 1,
        slug: 'test-book',
        title: 'Test Book',
        titleEn: undefined,
        author: 'Author',
        authorEn: undefined,
        coverUrl: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/test-cover.webp',
        coverUrlEn: undefined,
        summary: undefined,
        summaryEn: undefined,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }];

      vi.mocked(getAllBooksFromDB).mockResolvedValue(books);
      vi.mocked(getAllEvents).mockResolvedValue([]);

      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call for books scope
          return {
            ok: true,
            json: async () => [
              {
                name: 'test-cover.webp',
                updated_at: '2026-01-01T00:00:00Z',
              },
            ],
          } as Response;
        }
        // Second call for events scope
        return {
          ok: true,
          json: async () => [],
        } as Response;
      });

      const report = await buildManagedAssetReport(168);

      expect(report.referencedCount).toBe(1);
      expect(report.storedCount).toBe(1);
      expect(report.orphanedCount).toBe(0);
      expect(report.missingReferencedCount).toBe(0);
    });

    it('should handle event cover URLs', async () => {
      const events: Event[] = [{
        id: 1,
        slug: 'test-event',
        title: 'Test Event',
        titleEn: undefined,
        eventTypeCode: 'book-club',
        eventDate: '2026-06-01T19:00:00',
        registrationOpensAt: '2026-05-01T00:00:00',
        registrationClosesAt: '2026-05-30T23:59:59',
        venueCapacity: 20,
        paymentAmount: 100,
        paymentCurrency: 'TWD',
        introTemplateName: 'default',
        coverUrl: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/events/event-cover.webp',
        coverUrlEn: undefined,
        description: undefined,
        descriptionEn: undefined,
        bookId: undefined,
        venueName: undefined,
        venueNameEn: undefined,
        venueAddress: undefined,
        venueLocation: 'TW',
        isPublished: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }];

      vi.mocked(getAllBooksFromDB).mockResolvedValue([]);
      vi.mocked(getAllEvents).mockResolvedValue(events);

      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call for books scope
          return {
            ok: true,
            json: async () => [],
          } as Response;
        }
        // Second call for events scope
        return {
          ok: true,
          json: async () => [
            {
              name: 'event-cover.webp',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
        } as Response;
      });

      const report = await buildManagedAssetReport(168);

      expect(report.referencedCount).toBe(1);
      expect(report.storedCount).toBe(1);
      expect(report.orphanedCount).toBe(0);
    });

    it('should handle additional book covers', async () => {
      const books: Book[] = [{
        id: 1,
        slug: 'test-book',
        title: 'Test Book',
        titleEn: undefined,
        author: 'Author',
        authorEn: undefined,
        coverUrl: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/main-cover.webp',
        coverUrlEn: undefined,
        summary: undefined,
        summaryEn: undefined,
        additionalCovers: {
          zh: ['https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/additional-1.webp'],
          en: ['https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/additional-2.webp'],
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }];

      vi.mocked(getAllBooksFromDB).mockResolvedValue(books);
      vi.mocked(getAllEvents).mockResolvedValue([]);
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      const report = await buildManagedAssetReport(168);

      expect(report.referencedCount).toBe(3);
    });
  });

  describe('pruneOrphanedManagedAssets', () => {
    beforeEach(() => {
      vi.mocked(getAllBooksFromDB).mockResolvedValue([]);
      vi.mocked(getAllEvents).mockResolvedValue([]);
    });

    it('should skip assets within grace period', async () => {
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++;
        if (callCount === 1 || callCount === 2) {
          // First two calls for listing stored assets (books + events)
          return {
            ok: true,
            json: async () => [
              {
                name: 'recent-image.webp',
                updated_at: recentDate,
              },
            ],
          } as Response;
        }
        // Third call would be delete, but should not happen
        return { ok: true, json: async () => [] } as Response;
      });

      const result = await pruneOrphanedManagedAssets(24);

      expect(result.deleted.length).toBe(0);
      expect(result.skipped.length).toBe(2);
    });

    it('should delete assets outside grace period', async () => {
      const oldDate = new Date(Date.now() - 200 * 60 * 60 * 1000).toISOString();

      let fetchCallCount = 0;
      vi.mocked(global.fetch).mockImplementation(async (url) => {
        fetchCallCount++;
        if (fetchCallCount === 1 || fetchCallCount === 2) {
          // First two calls for listing stored assets
          return {
            ok: true,
            json: async () => [{
              name: 'old-image.webp',
              updated_at: oldDate,
            }],
          } as Response;
        }
        // Subsequent calls are for deleting
        return { ok: true } as Response;
      });

      const result = await pruneOrphanedManagedAssets(168);

      expect(result.deleted.length).toBe(2);
      expect(result.skipped.length).toBe(0);
    });

    it('should skip assets without modifiedAt', async () => {
      let callCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        callCount++;
        if (callCount === 1 || callCount === 2) {
          // First two calls for listing stored assets
          return {
            ok: true,
            json: async () => [
              {
                name: 'no-date-image.webp',
              },
            ],
          } as Response;
        }
        return { ok: true, json: async () => [] } as Response;
      });

      const result = await pruneOrphanedManagedAssets(168);

      expect(result.deleted.length).toBe(0);
      expect(result.skipped.length).toBe(2);
    });
  });

  describe('cleanupRemovedAdminAssets', () => {
    it('should delete assets removed from books', async () => {
      const previousBooks: Book[] = [{
        id: 1,
        slug: 'test-book',
        title: 'Test Book',
        titleEn: undefined,
        author: 'Author',
        authorEn: undefined,
        coverUrl: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/old-cover.webp',
        coverUrlEn: undefined,
        summary: undefined,
        summaryEn: undefined,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }];

      const nextBooks: Book[] = [{
        ...previousBooks[0],
        coverUrl: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/new-cover.webp',
      }];

      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await cleanupRemovedAdminAssets({
        previousBooks,
        nextBooks,
        previousEvents: [],
        nextEvents: [],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('old-cover.webp'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should delete assets removed from events', async () => {
      const previousEvents: Event[] = [{
        id: 1,
        slug: 'test-event',
        title: 'Test Event',
        titleEn: undefined,
        eventTypeCode: 'book-club',
        eventDate: '2026-06-01T19:00:00',
        registrationOpensAt: '2026-05-01T00:00:00',
        registrationClosesAt: '2026-05-30T23:59:59',
        venueCapacity: 20,
        paymentAmount: 100,
        paymentCurrency: 'TWD',
        introTemplateName: 'default',
        coverUrl: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/events/old-event.webp',
        coverUrlEn: undefined,
        description: undefined,
        descriptionEn: undefined,
        bookId: undefined,
        venueName: undefined,
        venueNameEn: undefined,
        venueAddress: undefined,
        venueLocation: 'TW',
        isPublished: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }];

      const nextEvents: Event[] = [{
        ...previousEvents[0],
        coverUrl: undefined,
      }];

      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await cleanupRemovedAdminAssets({
        previousBooks: [],
        nextBooks: [],
        previousEvents,
        nextEvents,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('old-event.webp'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should not delete assets that are still referenced', async () => {
      const books: Book[] = [{
        id: 1,
        slug: 'test-book',
        title: 'Test Book',
        titleEn: undefined,
        author: 'Author',
        authorEn: undefined,
        coverUrl: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/kept-cover.webp',
        coverUrlEn: undefined,
        summary: undefined,
        summaryEn: undefined,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }];

      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await cleanupRemovedAdminAssets({
        previousBooks: books,
        nextBooks: books,
        previousEvents: [],
        nextEvents: [],
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
