import 'server-only';

import path from 'node:path';
import { statSync } from 'node:fs';
import type { Book, BookRow } from '@/types/book';
import { bookFromRow, bookToRow } from '@/types/book';
import {
  fetchRows,
  fetchSingleRow,
  insertRow,
  updateRow,
  deleteRow,
  isSupabaseConfigured,
  shouldForceLocalPersistentStores,
} from '@/lib/supabase-utils';
import { readJsonFile, resolveWorkspacePath, writeJsonFile } from '@/lib/json-store';

const TABLE_NAME = process.env.SUPABASE_BOOKS_TABLE || 'books';
const LOCAL_BOOKS_ROOT = '.local/playwright-admin-documents';
const FALLBACK_BOOKS_FILE = 'data/books-v2.json';

function getEffectiveFallbackFile(fallbackFile: string): string {
  if (!shouldForceLocalPersistentStores()) {
    return fallbackFile;
  }
  return path.join(LOCAL_BOOKS_ROOT, path.basename(fallbackFile));
}

function ensureEffectiveFallbackSeed(fallbackFile: string): string {
  const effectiveFallbackFile = getEffectiveFallbackFile(fallbackFile);
  if (effectiveFallbackFile === fallbackFile) {
    return fallbackFile;
  }

  try {
    statSync(resolveWorkspacePath(effectiveFallbackFile));
    return effectiveFallbackFile;
  } catch {
    // Seed the local file from the fallback file
    const seedData = readJsonFile<Book[]>(fallbackFile);
    writeJsonFile(effectiveFallbackFile, seedData);
    return effectiveFallbackFile;
  }
}

// Read all books from file
function readBooksFromFile(): Book[] {
  const effectiveFallbackFile = ensureEffectiveFallbackSeed(FALLBACK_BOOKS_FILE);
  return readJsonFile<Book[]>(effectiveFallbackFile);
}

// Write all books to file
function writeBooksToFile(books: Book[]): void {
  const effectiveFallbackFile = ensureEffectiveFallbackSeed(FALLBACK_BOOKS_FILE);
  writeJsonFile(effectiveFallbackFile, books);
}

// Get next ID from file-backed books
function getNextIdFromFile(books: Book[]): number {
  if (books.length === 0) {
    return 1;
  }
  return Math.max(...books.map(b => b.id)) + 1;
}

// Get all books from database
export async function getAllBooksFromDB(orderBy: string = 'read_date.desc.nullslast,sort_order.asc.nullslast'): Promise<Book[]> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    return readBooksFromFile();
  }

  const rows = await fetchRows<BookRow>(TABLE_NAME, '*', `order=${orderBy}`);
  return rows.map(bookFromRow);
}

// Get book by ID from database
export async function getBookByIdFromDB(id: number): Promise<Book | null> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const books = readBooksFromFile();
    return books.find(b => b.id === id) || null;
  }

  const row = await fetchSingleRow<BookRow>(TABLE_NAME, '*', `id=eq.${id}`);
  return row ? bookFromRow(row) : null;
}

// Get book by slug from database
export async function getBookBySlugFromDB(slug: string): Promise<Book | null> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const books = readBooksFromFile();
    return books.find(b => b.slug === slug) || null;
  }

  const row = await fetchSingleRow<BookRow>(TABLE_NAME, '*', `slug=eq.${encodeURIComponent(slug)}`);
  return row ? bookFromRow(row) : null;
}

// Create book in database
export async function createBookInDB(
  book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Book> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const books = readBooksFromFile();
    const now = new Date().toISOString();
    const newBook: Book = {
      ...book,
      id: getNextIdFromFile(books),
      createdAt: now,
      updatedAt: now,
    };
    writeBooksToFile([...books, newBook]);
    return newBook;
  }

  const row = bookToRow(book);
  const result = await insertRow<BookRow>(TABLE_NAME, row);
  return bookFromRow(result);
}

// Update book in database
export async function updateBookInDB(
  id: number,
  updates: Partial<Omit<Book, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Book> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const books = readBooksFromFile();
    const index = books.findIndex(b => b.id === id);
    if (index === -1) {
      throw new Error(`Book with id ${id} not found`);
    }
    const updatedBook: Book = {
      ...books[index],
      ...updates,
      id, // Preserve ID
      createdAt: books[index].createdAt, // Preserve createdAt
      updatedAt: new Date().toISOString(),
    };
    books[index] = updatedBook;
    writeBooksToFile(books);
    return updatedBook;
  }

  const row = bookToRow(updates);
  const result = await updateRow<BookRow>(TABLE_NAME, `id=eq.${id}`, row);
  return bookFromRow(result);
}

// Delete book from database
export async function deleteBookFromDB(id: number): Promise<void> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const books = readBooksFromFile();
    const filtered = books.filter(b => b.id !== id);
    if (filtered.length === books.length) {
      throw new Error(`Book with id ${id} not found`);
    }
    writeBooksToFile(filtered);
    return;
  }

  await deleteRow(TABLE_NAME, `id=eq.${id}`);
}

// Bulk update books (for admin dashboard)
export async function bulkUpdateBooksInDB(books: Book[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback - just overwrite the entire file
    writeBooksToFile(books);
    return;
  }

  // Note: Supabase REST API doesn't have native bulk update
  // We'll update one by one for now
  // TODO: Consider using Supabase client or RPC for better performance
  for (const book of books) {
    await updateBookInDB(book.id, book);
  }
}
