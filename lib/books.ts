import 'server-only';

import { loadAdminDocument } from '@/lib/admin-content-store';
import { getBookByIdFromDB } from '@/lib/books-db';
import { logServerEvent } from '@/lib/observability';
import { sortBooksDescending } from '@/lib/book-order';
import booksFallbackData from '@/data/books.json';
import type { Book } from '@/types/book';
import { unstable_cache } from 'next/cache';

const BOOKS_FILE = 'data/books.json';
const BOOKS_FALLBACK = booksFallbackData as Book[];

type BooksStore = {
  books: Book[];
  booksBySlug: Map<string, Book>;
  booksByTag: Map<string, Book[]>;
  orderedBooks: Book[];
};

async function loadBooks(): Promise<Book[]> {
  const books = await loadAdminDocument<Book[]>({
    key: 'books',
    fallbackFile: BOOKS_FILE,
  });

  const normalizedBooks = normalizeBooksDocument(books, BOOKS_FALLBACK);

  return sortBooksDescending(normalizedBooks);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length ? normalized : undefined;
}

function normalizeLinks(value: unknown): Book['links'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const publisher = normalizeOptionalString((value as { publisher?: unknown }).publisher);
  const notes = normalizeOptionalString((value as { notes?: unknown }).notes);

  if (!publisher && !notes) {
    return undefined;
  }

  return { publisher, notes };
}

function normalizeBookRecord(value: unknown): Book | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' || typeof record.id === 'number' ? record.id : null;
  const slug = normalizeOptionalString(record.slug);
  const title = normalizeOptionalString(record.title);
  const author = normalizeOptionalString(record.author);

  if (id === null || !slug || !title || !author) {
    return null;
  }

  return {
    id,
    sortOrder: typeof record.sortOrder === 'number' && Number.isFinite(record.sortOrder) ? record.sortOrder : undefined,
    slug,
    title,
    titleEn: normalizeOptionalString(record.titleEn),
    author,
    authorEn: normalizeOptionalString(record.authorEn),
    coverUrl: normalizeOptionalString(record.coverUrl),
    coverUrlEn: normalizeOptionalString(record.coverUrlEn),
    coverBlurDataURL: normalizeOptionalString(record.coverBlurDataURL),
    coverBlurDataURLEn: normalizeOptionalString(record.coverBlurDataURLEn),
    coverUrls: normalizeStringArray(record.coverUrls),
    coverUrlsEn: normalizeStringArray(record.coverUrlsEn),
    readDate: normalizeOptionalString(record.readDate),
    summary: normalizeOptionalString(record.summary),
    summaryEn: normalizeOptionalString(record.summaryEn),
    readingNotes: normalizeOptionalString(record.readingNotes),
    readingNotesEn: normalizeOptionalString(record.readingNotesEn),
    discussionPoints: normalizeStringArray(record.discussionPoints),
    discussionPointsEn: normalizeStringArray(record.discussionPointsEn),
    tags: normalizeStringArray(record.tags),
    links: normalizeLinks(record.links),
  };
}

export function normalizeBooksDocument(value: unknown, fallbackBooks: Book[]): Book[] {
  if (!Array.isArray(value)) {
    logServerEvent('warn', 'books.document_invalid_shape', { fallbackCount: fallbackBooks.length, receivedType: typeof value });
    return fallbackBooks;
  }

  const normalized = value
    .map((entry) => normalizeBookRecord(entry))
    .filter((entry): entry is Book => Boolean(entry));

  if (!normalized.length && fallbackBooks.length) {
    logServerEvent('warn', 'books.document_empty_fallback_used', { fallbackCount: fallbackBooks.length, receivedCount: value.length });
    return fallbackBooks;
  }

  return normalized;
}

async function getBooksStore(): Promise<BooksStore> {
  const books = await loadBooks();

  const booksBySlug = new Map<string, Book>(books.map((book) => [book.slug, book]));

  const booksByTag = new Map<string, Book[]>();
  books.forEach((book) => {
    book.tags?.forEach((tag) => {
      if (!booksByTag.has(tag)) booksByTag.set(tag, []);
      booksByTag.get(tag)!.push(book);
    });
  });

  return {
    books,
    booksBySlug,
    booksByTag,
    orderedBooks: [...books],
  };
}

export async function getBooks(): Promise<Book[]> {
  return (await getBooksStore()).books;
}

export async function getBookBySlug(slug: string): Promise<Book | undefined> {
  return (await getBooksStore()).booksBySlug.get(slug);
}

// Get book by ID from database
export async function getBookById(id: number): Promise<Book | null> {
  return getBookByIdFromDB(id);
}

export async function getBooksByTag(tag: string): Promise<Book[]> {
  return (await getBooksStore()).booksByTag.get(tag) || [];
}

export async function getAllTags(): Promise<string[]> {
  return Array.from((await getBooksStore()).booksByTag.keys());
}

export async function getRecentBooks(limit: number = 40): Promise<Book[]> {
  return (await getBooksStore()).orderedBooks.slice(0, limit);
}

export async function getTopBooksByNumber(limit: number = 30): Promise<Book[]> {
  return (await getBooksStore()).orderedBooks.slice(0, limit);
}

export const getCachedBookStats = unstable_cache(
  async () => {
    const { books, booksByTag, orderedBooks } = await getBooksStore();
    return {
      totalBooks: books.length,
      totalTags: booksByTag.size,
      latestBook: orderedBooks[0],
      oldestBook: orderedBooks[orderedBooks.length - 1],
    };
  },
  ['book-stats'],
  { revalidate: 3600 }
);

export function getLocalizedBook(book: Book, locale: string) {
  return {
    ...book,
    displayTitle: locale === 'en' && book.titleEn ? book.titleEn : book.title,
    displayAuthor: locale === 'en' && book.authorEn ? book.authorEn : book.author,
    displaySummary: locale === 'en' && book.summaryEn ? book.summaryEn : book.summary,
    displayCoverUrl: locale === 'en' && book.coverUrlEn ? book.coverUrlEn : book.coverUrl,
    displayCoverBlurDataURL: locale === 'en' && book.coverBlurDataURLEn ? book.coverBlurDataURLEn : book.coverBlurDataURL,
    displayCoverUrls: locale === 'en' && book.coverUrlsEn ? book.coverUrlsEn : book.coverUrls,
  };
}

export function getLocalizedTitle(book: Book, locale: string): string {
  if (locale === 'en' && book.titleEn) return book.titleEn;
  return book.title;
}

export function getLocalizedAuthor(book: Book, locale: string): string {
  if (locale === 'en' && book.authorEn) return book.authorEn;
  return book.author;
}
