import type { Book } from '@/types/book';
import { unstable_cache } from 'next/cache';
import booksData from '@/data/books.json';

// ============================================
// Performance optimization: Static import + Pre-built indexes
// ============================================

// Use static import instead of dynamic loading (loaded at compile time)
const books: Book[] = booksData as Book[];

// Pre-build slug index for O(1) lookup complexity
const booksBySlug = new Map<string, Book>(books.map(b => [b.slug, b]));

// Pre-build tag index
const booksByTag = new Map<string, Book[]>();
books.forEach(book => {
  book.tags?.forEach(tag => {
    if (!booksByTag.has(tag)) booksByTag.set(tag, []);
    booksByTag.get(tag)!.push(book);
  });
});

// Pre-sorted books list by date (avoid re-sorting on each request)
const sortedBooksByDate = [...books].sort((a, b) => {
  if (!a.readDate && !b.readDate) return 0;
  if (!a.readDate) return 1;
  if (!b.readDate) return -1;
  return new Date(b.readDate).getTime() - new Date(a.readDate).getTime();
});

// Pre-sorted books list by cover number (largest first)
const sortedBooksByNumber = [...books]
  .map(b => ({
    ...b,
    coverNumber: b.coverUrl ? parseInt(b.coverUrl.match(/\/(\d+)_/)?.[1] || '0', 10) : 0,
  }))
  .sort((a, b) => b.coverNumber - a.coverNumber);

// ============================================
// Public API
// ============================================

// Async version (for backward compatibility)
export async function getBooks(): Promise<Book[]> {
  return books;
}

// Sync version (for server components)
export function getBooksSync(): Book[] {
  return books;
}

// Fast lookup using index - O(1) complexity
export function getBookBySlugSync(slug: string): Book | undefined {
  return booksBySlug.get(slug);
}

// Async version (for backward compatibility)
export async function getBookBySlug(slug: string): Promise<Book | undefined> {
  return booksBySlug.get(slug);
}

// Get books by tag - O(1) complexity
export function getBooksByTag(tag: string): Book[] {
  return booksByTag.get(tag) || [];
}

// Get all tags
export function getAllTags(): string[] {
  return Array.from(booksByTag.keys());
}

// Get recent books using pre-sorted list
export async function getRecentBooks(limit: number = 40): Promise<Book[]> {
  return sortedBooksByDate.slice(0, limit);
}

// Sync version
export function getRecentBooksSync(limit: number = 40): Book[] {
  return sortedBooksByDate.slice(0, limit);
}

// Get top books by cover number (largest numbers first)
export function getTopBooksByNumberSync(limit: number = 30): Book[] {
  return sortedBooksByNumber.slice(0, limit);
}

// ============================================
// Server-side cache (for data that needs revalidation)
// ============================================

// Cache book stats (revalidate every 1 hour)
export const getCachedBookStats = unstable_cache(
  async () => {
    return {
      totalBooks: books.length,
      totalTags: booksByTag.size,
      latestBook: sortedBooksByDate[0],
      oldestBook: sortedBooksByDate[sortedBooksByDate.length - 1],
    };
  },
  ['book-stats'],
  { revalidate: 3600 } // Revalidate every 1 hour
);

// Helper to get localized book data
export function getLocalizedBook(book: Book, locale: string) {
  return {
    ...book,
    displayTitle: locale === 'en' && book.titleEn ? book.titleEn : book.title,
    displayAuthor: locale === 'en' && book.authorEn ? book.authorEn : book.author,
    displaySummary: locale === 'en' && book.summaryEn ? book.summaryEn : book.summary,
    displayCoverUrl: locale === 'en' && book.coverUrlEn ? book.coverUrlEn : book.coverUrl,
  };
}

// Helper to get localized title
export function getLocalizedTitle(book: Book, locale: string): string {
  if (locale === 'en' && book.titleEn) return book.titleEn;
  return book.title;
}

export function getLocalizedAuthor(book: Book, locale: string): string {
  if (locale === 'en' && book.authorEn) return book.authorEn;
  return book.author;
}
