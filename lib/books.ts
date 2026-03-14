import 'server-only';

import { loadAdminDocument } from '@/lib/admin-content-store';
import type { Book } from '@/types/book';
import { unstable_cache } from 'next/cache';

type BooksStore = {
  books: Book[];
  booksBySlug: Map<string, Book>;
  booksByTag: Map<string, Book[]>;
  orderedBooks: Book[];
};

let booksStore: BooksStore | null = null;
let booksSignature = '';

async function loadBooks(): Promise<Book[]> {
  return loadAdminDocument<Book[]>({
    key: 'books',
    fallbackFile: 'data/books.json',
  });
}

async function getBooksStore(): Promise<BooksStore> {
  const books = await loadBooks();
  const nextSignature = JSON.stringify(
    books.map((book) => [book.id, book.slug, book.title, book.titleEn, book.coverUrl, book.coverUrlEn, book.readDate])
  );

  if (booksStore && booksSignature === nextSignature) {
    return booksStore;
  }

  booksSignature = nextSignature;

  const booksBySlug = new Map<string, Book>(books.map((book) => [book.slug, book]));

  const booksByTag = new Map<string, Book[]>();
  books.forEach((book) => {
    book.tags?.forEach((tag) => {
      if (!booksByTag.has(tag)) booksByTag.set(tag, []);
      booksByTag.get(tag)!.push(book);
    });
  });

  booksStore = {
    books,
    booksBySlug,
    booksByTag,
    orderedBooks: [...books],
  };

  return booksStore;
}

export async function getBooks(): Promise<Book[]> {
  return (await getBooksStore()).books;
}

export async function getBookBySlug(slug: string): Promise<Book | undefined> {
  return (await getBooksStore()).booksBySlug.get(slug);
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
