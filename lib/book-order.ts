import type { Book } from '@/types/book';

const COVER_NUMBER_PATTERN = /\/images\/books_(?:zh|en)\/(\d+)_/;

function extractCoverNumber(value?: string): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(COVER_NUMBER_PATTERN);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getBookSortOrder(book: Book): number {
  if (typeof book.sortOrder === 'number' && Number.isInteger(book.sortOrder) && book.sortOrder > 0) {
    return book.sortOrder;
  }

  return extractCoverNumber(book.coverUrl) ?? extractCoverNumber(book.coverUrlEn) ?? 0;
}

export function sortBooksDescending(books: Book[]): Book[] {
  return [...books].sort((left, right) => {
    const leftOrder = getBookSortOrder(left);
    const rightOrder = getBookSortOrder(right);

    if (rightOrder !== leftOrder) {
      return rightOrder - leftOrder;
    }

    return String(left.id).localeCompare(String(right.id));
  });
}

export function normalizeBookSortOrder(books: Book[]): Book[] {
  const highestOrder = Math.max(books.length, ...books.map((book) => getBookSortOrder(book)));
  return books.map((book, index) => ({
    ...book,
    sortOrder: highestOrder - index,
  }));
}

export function getNextBookSortOrder(books: Book[]): number {
  return books.reduce((maxValue, book) => Math.max(maxValue, getBookSortOrder(book)), 0) + 1;
}