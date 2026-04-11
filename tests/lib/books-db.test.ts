import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockFetchRows, mockFetchSingleRow, mockInsertRow, mockUpdateRow, mockDeleteRow } = vi.hoisted(() => ({
  mockFetchRows: vi.fn(),
  mockFetchSingleRow: vi.fn(),
  mockInsertRow: vi.fn(),
  mockUpdateRow: vi.fn(),
  mockDeleteRow: vi.fn(),
}));

vi.mock('@/lib/supabase-utils', () => ({
  fetchRows: mockFetchRows,
  fetchSingleRow: mockFetchSingleRow,
  insertRow: mockInsertRow,
  updateRow: mockUpdateRow,
  deleteRow: mockDeleteRow,
}));

import {
  getAllBooksFromDB,
  getBookByIdFromDB,
  getBookBySlugFromDB,
  createBookInDB,
  updateBookInDB,
  deleteBookFromDB,
  bulkUpdateBooksInDB,
} from '@/lib/books-db';
import type { Book, BookRow } from '@/types/book';

describe('books-db', () => {
  const mockBookRow: BookRow = {
    id: 1,
    sort_order: 10,
    slug: 'test-book',
    title: 'Test Book',
    title_en: 'Test Book EN',
    author: 'Test Author',
    author_en: 'Test Author EN',
    cover_url: '/images/test.jpg',
    cover_url_en: '/images/test-en.jpg',
    cover_blur_data_url: 'data:image/jpeg;base64,test',
    cover_blur_data_url_en: 'data:image/jpeg;base64,test-en',
    additional_covers: { zh: ['/img1.jpg'], en: ['/img2.jpg'] },
    read_date: '2026-01-01',
    summary: 'Test summary',
    summary_en: 'Test summary EN',
    reading_notes: 'Test notes',
    reading_notes_en: 'Test notes EN',
    discussion_points: ['Point 1', 'Point 2'],
    discussion_points_en: ['Point 1 EN', 'Point 2 EN'],
    tags: ['fiction', 'drama'],
    links: { publisher: 'https://example.com', notes: 'https://notes.com' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllBooksFromDB', () => {
    it('fetches all books with default ordering', async () => {
      mockFetchRows.mockResolvedValueOnce([mockBookRow]);

      const books = await getAllBooksFromDB();

      expect(mockFetchRows).toHaveBeenCalledWith(
        'books',
        '*',
        'order=read_date.desc.nullslast,sort_order.asc.nullslast'
      );
      expect(books).toHaveLength(1);
      expect(books[0].id).toBe(1);
      expect(books[0].slug).toBe('test-book');
    });

    it('fetches all books with custom ordering', async () => {
      mockFetchRows.mockResolvedValueOnce([mockBookRow]);

      const books = await getAllBooksFromDB('title.asc');

      expect(mockFetchRows).toHaveBeenCalledWith('books', '*', 'order=title.asc');
      expect(books).toHaveLength(1);
    });

    it('returns empty array when no books exist', async () => {
      mockFetchRows.mockResolvedValueOnce([]);

      const books = await getAllBooksFromDB();

      expect(books).toEqual([]);
    });
  });

  describe('getBookByIdFromDB', () => {
    it('fetches book by ID', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(mockBookRow);

      const book = await getBookByIdFromDB(1);

      expect(mockFetchSingleRow).toHaveBeenCalledWith('books', '*', 'id=eq.1');
      expect(book?.id).toBe(1);
      expect(book?.slug).toBe('test-book');
    });

    it('returns null when book not found', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(null);

      const book = await getBookByIdFromDB(999);

      expect(book).toBeNull();
    });
  });

  describe('getBookBySlugFromDB', () => {
    it('fetches book by slug', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(mockBookRow);

      const book = await getBookBySlugFromDB('test-book');

      expect(mockFetchSingleRow).toHaveBeenCalledWith(
        'books',
        '*',
        'slug=eq.test-book'
      );
      expect(book?.slug).toBe('test-book');
    });

    it('URL encodes slug parameter', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(null);

      await getBookBySlugFromDB('test book with spaces');

      expect(mockFetchSingleRow).toHaveBeenCalledWith(
        'books',
        '*',
        'slug=eq.test%20book%20with%20spaces'
      );
    });

    it('returns null when book not found', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(null);

      const book = await getBookBySlugFromDB('non-existent');

      expect(book).toBeNull();
    });
  });

  describe('createBookInDB', () => {
    it('creates a new book', async () => {
      const newBook: Omit<Book, 'id' | 'createdAt' | 'updatedAt'> = {
        sortOrder: 20,
        slug: 'new-book',
        title: 'New Book',
        author: 'New Author',
      };

      mockInsertRow.mockResolvedValueOnce({
        ...mockBookRow,
        id: 2,
        slug: 'new-book',
      });

      const createdBook = await createBookInDB(newBook);

      expect(mockInsertRow).toHaveBeenCalledWith(
        'books',
        expect.objectContaining({
          slug: 'new-book',
          title: 'New Book',
          author: 'New Author',
        })
      );
      expect(createdBook.id).toBe(2);
      expect(createdBook.slug).toBe('new-book');
    });

    it('creates book with minimal fields', async () => {
      const minimalBook: Omit<Book, 'id' | 'createdAt' | 'updatedAt'> = {
        slug: 'minimal',
        title: 'Minimal Book',
        author: 'Minimal Author',
      };

      mockInsertRow.mockResolvedValueOnce(mockBookRow);

      await createBookInDB(minimalBook);

      expect(mockInsertRow).toHaveBeenCalled();
    });
  });

  describe('updateBookInDB', () => {
    it('updates an existing book', async () => {
      const updates = {
        title: 'Updated Title',
        author: 'Updated Author',
      };

      mockUpdateRow.mockResolvedValueOnce({
        ...mockBookRow,
        title: 'Updated Title',
        author: 'Updated Author',
      });

      const updatedBook = await updateBookInDB(1, updates);

      expect(mockUpdateRow).toHaveBeenCalledWith(
        'books',
        'id=eq.1',
        expect.objectContaining({
          title: 'Updated Title',
          author: 'Updated Author',
        })
      );
      expect(updatedBook.title).toBe('Updated Title');
      expect(updatedBook.author).toBe('Updated Author');
    });

    it('updates book with partial fields', async () => {
      mockUpdateRow.mockResolvedValueOnce(mockBookRow);

      await updateBookInDB(1, { sortOrder: 100 });

      expect(mockUpdateRow).toHaveBeenCalled();
    });
  });

  describe('deleteBookFromDB', () => {
    it('deletes a book by ID', async () => {
      mockDeleteRow.mockResolvedValueOnce(undefined);

      await deleteBookFromDB(1);

      expect(mockDeleteRow).toHaveBeenCalledWith('books', 'id=eq.1');
    });
  });

  describe('bulkUpdateBooksInDB', () => {
    it('updates multiple books', async () => {
      const books: Book[] = [
        {
          id: 1,
          slug: 'book-1',
          title: 'Book 1',
          author: 'Author 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
        {
          id: 2,
          slug: 'book-2',
          title: 'Book 2',
          author: 'Author 2',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ];

      mockUpdateRow.mockResolvedValue(mockBookRow);

      await bulkUpdateBooksInDB(books);

      expect(mockUpdateRow).toHaveBeenCalledTimes(2);
      expect(mockUpdateRow).toHaveBeenNthCalledWith(
        1,
        'books',
        'id=eq.1',
        expect.anything()
      );
      expect(mockUpdateRow).toHaveBeenNthCalledWith(
        2,
        'books',
        'id=eq.2',
        expect.anything()
      );
    });

    it('handles empty array', async () => {
      await bulkUpdateBooksInDB([]);

      expect(mockUpdateRow).not.toHaveBeenCalled();
    });
  });
});
