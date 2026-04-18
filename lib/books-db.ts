import 'server-only';

import type { Book, BookRow } from '@/types/book';
import { bookFromRow, bookToRow } from '@/types/book';
import {
  fetchRows,
  fetchSingleRow,
  insertRow,
  updateRow,
  deleteRow,
} from '@/lib/supabase-utils';
import { SUPABASE_CONFIG } from '@/lib/env';

const TABLE_NAME = SUPABASE_CONFIG.TABLES.BOOKS;

// Get all books from database
export async function getAllBooksFromDB(orderBy: string = 'read_date.desc.nullslast,sort_order.asc.nullslast'): Promise<Book[]> {
  const rows = await fetchRows<BookRow>(TABLE_NAME, '*', `order=${orderBy}`);
  return rows.map(bookFromRow);
}

// Get book by ID from database
export async function getBookByIdFromDB(id: number): Promise<Book | null> {
  const row = await fetchSingleRow<BookRow>(TABLE_NAME, '*', `id=eq.${id}`);
  return row ? bookFromRow(row) : null;
}

// Get book by slug from database
export async function getBookBySlugFromDB(slug: string): Promise<Book | null> {
  const row = await fetchSingleRow<BookRow>(TABLE_NAME, '*', `slug=eq.${encodeURIComponent(slug)}`);
  return row ? bookFromRow(row) : null;
}

// Create book in database
export async function createBookInDB(
  book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Book> {
  const row = bookToRow(book);
  const result = await insertRow<BookRow>(TABLE_NAME, row);
  return bookFromRow(result);
}

// Update book in database
export async function updateBookInDB(
  id: number,
  updates: Partial<Omit<Book, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Book> {
  const row = bookToRow(updates);
  const result = await updateRow<BookRow>(TABLE_NAME, `id=eq.${id}`, row);
  return bookFromRow(result);
}

// Delete book from database
export async function deleteBookFromDB(id: number): Promise<void> {
  await deleteRow(TABLE_NAME, `id=eq.${id}`);
}

// Bulk update books (for admin dashboard)
export async function bulkUpdateBooksInDB(books: Book[]): Promise<void> {
  // Note: Supabase REST API doesn't have native bulk update
  // We'll update one by one for now
  // TODO: Consider using Supabase client or RPC for better performance
  for (const book of books) {
    await updateBookInDB(book.id, book);
  }
}
