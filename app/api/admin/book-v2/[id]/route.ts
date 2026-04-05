import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import type { Book } from '@/types/book';
import {
  getBookByIdFromDB,
  updateBookInDB,
  deleteBookFromDB,
} from '@/lib/books-db';

export const dynamic = 'force-dynamic';

const optionalString = z.string().max(50000).optional().nullable();
const optionalDataUrl = z.union([z.string().max(20_000).regex(/^data:image\//), z.literal(''), z.null()]).optional();
const urlOrPath = z.string().min(1).max(500).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), {
  message: 'Expected an absolute URL or a site-relative path.',
});

const optionalUrlOrPath = z.union([urlOrPath, z.literal(''), z.null()]).optional();

const bookSchema = z.object({
  sortOrder: z.number().int().nonnegative().optional(),
  slug: z.string().min(1).max(160),
  title: z.string().min(1).max(200),
  titleEn: optionalString,
  author: z.string().min(1).max(200),
  authorEn: optionalString,
  coverUrl: optionalUrlOrPath,
  coverUrlEn: optionalUrlOrPath,
  coverBlurDataURL: optionalDataUrl,
  coverBlurDataURLEn: optionalDataUrl,
  additionalCovers: z.object({
    zh: z.array(urlOrPath).optional(),
    en: z.array(urlOrPath).optional(),
  }).optional(),
  readDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]).optional(),
  summary: optionalString,
  summaryEn: optionalString,
  readingNotes: optionalString,
  readingNotesEn: optionalString,
  discussionPoints: z.array(z.string().min(1).max(4000)).optional(),
  discussionPointsEn: z.array(z.string().min(1).max(4000)).optional(),
  tags: z.array(z.string().min(1).max(60)).optional(),
  links: z.object({
    publisher: optionalUrlOrPath,
    notes: optionalUrlOrPath,
  }).optional(),
}).partial();

function cleanOptional(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function cleanOptionalPath(value?: string | null): string | undefined {
  return cleanOptional(value);
}

function revalidateBookRoutes() {
  revalidatePath('/');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/zh/books');
  revalidatePath('/en/books');
  revalidatePath('/sitemap.xml');
}

// GET /api/admin/book-v2/[id] - Get single book by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return runWithRequestTrace(request, 'admin.book_v2.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    const book = await getBookByIdFromDB(id);
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ book }, { status: 200 });
  });
}

// PUT /api/admin/book-v2/[id] - Update book
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return runWithRequestTrace(request, 'admin.book_v2.update', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    let payload: z.infer<typeof bookSchema>;

    try {
      payload = await parseJsonRequest(request, bookSchema, { maxBytes: 200_000 });
    } catch (error) {
      if (error instanceof JsonRequestError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    try {
      const updates: Partial<Book> = {};
      if (payload.sortOrder !== undefined) updates.sortOrder = payload.sortOrder;
      if (payload.slug !== undefined) updates.slug = payload.slug.trim();
      if (payload.title !== undefined) updates.title = payload.title.trim();
      if (payload.titleEn !== undefined) updates.titleEn = cleanOptional(payload.titleEn);
      if (payload.author !== undefined) updates.author = payload.author.trim();
      if (payload.authorEn !== undefined) updates.authorEn = cleanOptional(payload.authorEn);
      if (payload.coverUrl !== undefined) updates.coverUrl = cleanOptionalPath(payload.coverUrl);
      if (payload.coverUrlEn !== undefined) updates.coverUrlEn = cleanOptionalPath(payload.coverUrlEn);
      if (payload.coverBlurDataURL !== undefined) updates.coverBlurDataURL = cleanOptional(payload.coverBlurDataURL);
      if (payload.coverBlurDataURLEn !== undefined) updates.coverBlurDataURLEn = cleanOptional(payload.coverBlurDataURLEn);
      if (payload.additionalCovers !== undefined) {
        updates.additionalCovers = {
          zh: payload.additionalCovers.zh?.filter(Boolean),
          en: payload.additionalCovers.en?.filter(Boolean),
        };
      }
      if (payload.readDate !== undefined) updates.readDate = cleanOptional(payload.readDate);
      if (payload.summary !== undefined) updates.summary = cleanOptional(payload.summary);
      if (payload.summaryEn !== undefined) updates.summaryEn = cleanOptional(payload.summaryEn);
      if (payload.readingNotes !== undefined) updates.readingNotes = cleanOptional(payload.readingNotes);
      if (payload.readingNotesEn !== undefined) updates.readingNotesEn = cleanOptional(payload.readingNotesEn);
      if (payload.discussionPoints !== undefined) updates.discussionPoints = payload.discussionPoints?.filter(Boolean);
      if (payload.discussionPointsEn !== undefined) updates.discussionPointsEn = payload.discussionPointsEn?.filter(Boolean);
      if (payload.tags !== undefined) updates.tags = payload.tags?.map((tag) => tag.trim()).filter(Boolean);
      if (payload.links !== undefined) {
        updates.links =
          payload.links && (cleanOptionalPath(payload.links.publisher) || cleanOptionalPath(payload.links.notes))
            ? {
                publisher: cleanOptionalPath(payload.links.publisher),
                notes: cleanOptionalPath(payload.links.notes),
              }
            : undefined;
      }

      const book = await updateBookInDB(id, updates);

      revalidateBookRoutes();

      return NextResponse.json({ ok: true, book }, { status: 200 });
    } catch (error) {
      await logServerError('admin.book_v2.update_failed', error, { id });
      throw error;
    }
  });
}

// DELETE /api/admin/book-v2/[id] - Delete book
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return runWithRequestTrace(request, 'admin.book_v2.delete', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    try {
      await deleteBookFromDB(id);

      revalidateBookRoutes();

      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
      await logServerError('admin.book_v2.delete_failed', error, { id });
      // Foreign key constraint errors will bubble up
      throw error;
    }
  });
}
