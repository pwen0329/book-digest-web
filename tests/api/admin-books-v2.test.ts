import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/books-v2/route';

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

vi.mock('@/lib/books-db', () => ({
  getAllBooksFromDB: vi.fn(),
}));

vi.mock('@/lib/book-order', () => ({
  sortBooksDescending: vi.fn((books) => books),
}));

import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { getAllBooksFromDB } from '@/lib/books-db';
import type { Book } from '@/types/book';

describe('/api/admin/books-v2', () => {
  const mockBooks: Book[] = [
    {
      id: 1,
      slug: 'book-1',
      title: 'Book 1',
      author: 'Author 1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      slug: 'book-2',
      title: 'Book 2',
      author: 'Author 2',
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

      const request = new NextRequest('http://localhost/api/admin/books-v2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns all books when authorized', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(getAllBooksFromDB).mockResolvedValueOnce(mockBooks);

      const request = new NextRequest('http://localhost/api/admin/books-v2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toHaveLength(2);
      expect(data.books[0].slug).toBe('book-1');
    });

    it('returns empty array when no books exist', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(getAllBooksFromDB).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost/api/admin/books-v2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.books).toEqual([]);
    });
  });
});
