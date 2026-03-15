import { describe, expect, it } from 'vitest';
import { getBookSortOrder, getNextBookSortOrder, normalizeBookSortOrder, sortBooksDescending } from '@/lib/book-order';

describe('book order helpers', () => {
  it('sorts books by descending sortOrder', () => {
    const sorted = sortBooksDescending([
      { id: 'b', slug: 'b', title: 'B', author: 'Author', sortOrder: 2 },
      { id: 'a', slug: 'a', title: 'A', author: 'Author', sortOrder: 3 },
      { id: 'c', slug: 'c', title: 'C', author: 'Author', sortOrder: 1 },
    ]);

    expect(sorted.map((book) => book.id)).toEqual(['a', 'b', 'c']);
  });

  it('normalizes a visible list into descending sortOrder values', () => {
    const normalized = normalizeBookSortOrder([
      { id: 'first', slug: 'first', title: 'First', author: 'Author' },
      { id: 'second', slug: 'second', title: 'Second', author: 'Author' },
      { id: 'third', slug: 'third', title: 'Third', author: 'Author' },
    ]);

    expect(normalized.map((book) => book.sortOrder)).toEqual([3, 2, 1]);
  });

  it('assigns the next draft book to the highest sort order', () => {
    expect(getNextBookSortOrder([
      { id: 'a', slug: 'a', title: 'A', author: 'Author', sortOrder: 4 },
      { id: 'b', slug: 'b', title: 'B', author: 'Author', sortOrder: 8 },
    ])).toBe(9);
  });

  it('falls back to numbered cover assets when an explicit sortOrder is missing', () => {
    expect(getBookSortOrder({
      id: 'duck',
      slug: 'duck',
      title: 'Duck',
      author: 'Author',
      coverUrl: '/images/books_zh/60_家鴨與野鴨的投幣式置物櫃.webp',
    })).toBe(60);
  });
});