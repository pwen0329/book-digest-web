import 'server-only';

import { getAllBooksFromDB, getBookByIdFromDB } from '@/lib/books-db';
import { sortBooksDescending } from '@/lib/book-order';
import type { Book } from '@/types/book';

type BooksStore = {
  books: Book[];
  booksBySlug: Map<string, Book>;
  booksByTag: Map<string, Book[]>;
  orderedBooks: Book[];
};

async function loadBooks(): Promise<Book[]> {
  const books = await getAllBooksFromDB();
  return sortBooksDescending(books);
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

export function getLocalizedBook(book: Book, locale: string) {
  return {
    ...book,
    displayTitle: locale === 'en' && book.titleEn ? book.titleEn : book.title,
    displayAuthor: locale === 'en' && book.authorEn ? book.authorEn : book.author,
    displaySummary: locale === 'en' && book.summaryEn ? book.summaryEn : book.summary,
    displayCoverUrl: locale === 'en' && book.coverUrlEn ? book.coverUrlEn : book.coverUrl,
    displayCoverBlurDataURL: locale === 'en' && book.coverBlurDataURLEn ? book.coverBlurDataURLEn : book.coverBlurDataURL,
    displayCoverUrls: locale === 'en' && book.additionalCovers?.en ? book.additionalCovers.en : book.additionalCovers?.zh,
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
