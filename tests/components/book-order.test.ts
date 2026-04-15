import { describe, expect, it } from 'vitest';
import { getBookSortOrder, getNextBookSortOrder, normalizeBookSortOrder, sortBooksDescending } from '@/lib/book-order';
import type { Book } from '@/types/book';

describe('book order helpers', () => {
  const mockBook = (overrides: Partial<Book>): Book => ({
    id: 1,
    slug: 'test',
    title: 'Test',
    author: 'Author',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });

  it('sorts books by descending sortOrder', () => {
    const sorted = sortBooksDescending([
      mockBook({ id: 2, slug: 'b', title: 'B', sortOrder: 2 }),
      mockBook({ id: 1, slug: 'a', title: 'A', sortOrder: 3 }),
      mockBook({ id: 3, slug: 'c', title: 'C', sortOrder: 1 }),
    ]);

    expect(sorted.map((book) => book.id)).toEqual([1, 2, 3]);
  });

  it('normalizes a visible list into descending sortOrder values', () => {
    const normalized = normalizeBookSortOrder([
      mockBook({ id: 1, slug: 'first', title: 'First' }),
      mockBook({ id: 2, slug: 'second', title: 'Second' }),
      mockBook({ id: 3, slug: 'third', title: 'Third' }),
    ]);

    expect(normalized.map((book) => book.sortOrder)).toEqual([3, 2, 1]);
  });

  it('assigns the next draft book to the highest sort order', () => {
    expect(getNextBookSortOrder([
      mockBook({ id: 1, slug: 'a', title: 'A', sortOrder: 4 }),
      mockBook({ id: 2, slug: 'b', title: 'B', sortOrder: 8 }),
    ])).toBe(9);
  });

  it('falls back to numbered cover assets when an explicit sortOrder is missing', () => {
    expect(getBookSortOrder(mockBook({
      id: 999,
      slug: 'duck',
      title: 'Duck',
      coverUrl: '/images/books_zh/60_家鴨與野鴨的投幣式置物櫃.webp',
    }))).toBe(60);
  });
});