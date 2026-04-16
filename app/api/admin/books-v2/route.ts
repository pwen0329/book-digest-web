import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { runWithRequestTrace } from '@/lib/observability';
import { getAllBooksFromDB } from '@/lib/books-db';
import { sortBooksDescending } from '@/lib/book-order';

export const dynamic = 'force-dynamic';

// GET /api/admin/books-v2 - Get all books from database
export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.books_v2.get_all', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const books = await getAllBooksFromDB();
    return NextResponse.json({ books: sortBooksDescending(books) }, { status: 200 });
  });
}
