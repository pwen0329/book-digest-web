import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/book-v2/route';

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

vi.mock('@/lib/books-db', () => ({
  createBookInDB: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { parseJsonRequest, JsonRequestError } from '@/lib/request-json';
import { createBookInDB } from '@/lib/books-db';
import { revalidatePath } from 'next/cache';
import type { Book } from '@/types/book';

describe('/api/admin/book-v2 POST', () => {
  const mockCreatedBook: Book = {
    id: 1,
    slug: 'test-book',
    title: 'Test Book',
    author: 'Test Author',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('returns 401 when not authorized', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(false);

      const request = new NextRequest('http://localhost/api/admin/book-v2', {
        method: 'POST',
        body: JSON.stringify({ slug: 'test', title: 'Test', author: 'Author' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('creates a new book with valid payload', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockResolvedValueOnce({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Test Author',
      });
      vi.mocked(createBookInDB).mockResolvedValueOnce(mockCreatedBook);

      const request = new NextRequest('http://localhost/api/admin/book-v2', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'test-book',
          title: 'Test Book',
          author: 'Test Author',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.ok).toBe(true);
      expect(data.book.slug).toBe('test-book');
      expect(createBookInDB).toHaveBeenCalled();
    });

    it('revalidates book routes after creation', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockResolvedValueOnce({
        slug: 'test-book',
        title: 'Test Book',
        author: 'Test Author',
      });
      vi.mocked(createBookInDB).mockResolvedValueOnce(mockCreatedBook);

      const request = new NextRequest('http://localhost/api/admin/book-v2', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'test-book',
          title: 'Test Book',
          author: 'Test Author',
        }),
      });
      await POST(request);

      expect(revalidatePath).toHaveBeenCalledWith('/');
      expect(revalidatePath).toHaveBeenCalledWith('/zh');
      expect(revalidatePath).toHaveBeenCalledWith('/en');
      expect(revalidatePath).toHaveBeenCalledWith('/zh/books');
      expect(revalidatePath).toHaveBeenCalledWith('/en/books');
      expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
    });

    it('returns 400 for invalid JSON', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockRejectedValueOnce(
        new Error('Invalid JSON')
      );

      const request = new NextRequest('http://localhost/api/admin/book-v2', {
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
        new JsonRequestError('Missing required field: title', 400)
      );

      const request = new NextRequest('http://localhost/api/admin/book-v2', {
        method: 'POST',
        body: JSON.stringify({ slug: 'test' }), // Missing title and author
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required field');
    });

    it('creates book with optional fields', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(parseJsonRequest).mockResolvedValueOnce({
        slug: 'test-book',
        title: 'Test Book',
        titleEn: 'Test Book EN',
        author: 'Test Author',
        authorEn: 'Test Author EN',
        coverUrl: '/images/test.jpg',
        summary: 'Test summary',
        readDate: '2026-01-01',
        tags: ['fiction', 'drama'],
      });
      vi.mocked(createBookInDB).mockResolvedValueOnce(mockCreatedBook);

      const request = new NextRequest('http://localhost/api/admin/book-v2', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'test-book',
          title: 'Test Book',
          titleEn: 'Test Book EN',
          author: 'Test Author',
          authorEn: 'Test Author EN',
          coverUrl: '/images/test.jpg',
          summary: 'Test summary',
          readDate: '2026-01-01',
          tags: ['fiction', 'drama'],
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(createBookInDB).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'test-book',
          title: 'Test Book',
          titleEn: 'Test Book EN',
          tags: ['fiction', 'drama'],
        })
      );
    });
  });
});
