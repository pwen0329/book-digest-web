import type { Book } from '@/types/book';

export function sortBooksDescending(books: Book[]): Book[] {
  return [...books].sort((left, right) => {
    const leftOrder = typeof left.sortOrder === 'number' ? left.sortOrder : 0;
    const rightOrder = typeof right.sortOrder === 'number' ? right.sortOrder : 0;

    if (rightOrder !== leftOrder) {
      return rightOrder - leftOrder;
    }

    return String(left.id).localeCompare(String(right.id));
  });
}

export function normalizeBookSortOrder(books: Book[]): Book[] {
  return books.map((book, index) => ({
    ...book,
    sortOrder: books.length - index,
  }));
}

export function getNextBookSortOrder(books: Book[]): number {
  return books.reduce((maxValue, book) => Math.max(maxValue, typeof book.sortOrder === 'number' ? book.sortOrder : 0), 0) + 1;
}