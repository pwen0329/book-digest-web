import { getAllBooksFromDB } from '@/lib/books-db';
import BookManager from '@/components/admin/BookManager';

export default async function BooksPage() {
  const books = await getAllBooksFromDB();
  return <BookManager initialBooks={books} />;
}
