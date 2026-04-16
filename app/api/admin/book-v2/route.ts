import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import { createBookInDB } from '@/lib/books-db';

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
});

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

// POST /api/admin/book-v2 - Create new book
export async function POST(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.book_v2.create', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      const book = await createBookInDB({
        sortOrder: payload.sortOrder,
        slug: payload.slug.trim(),
        title: payload.title.trim(),
        titleEn: cleanOptional(payload.titleEn),
        author: payload.author.trim(),
        authorEn: cleanOptional(payload.authorEn),
        coverUrl: cleanOptionalPath(payload.coverUrl),
        coverUrlEn: cleanOptionalPath(payload.coverUrlEn),
        coverBlurDataURL: cleanOptional(payload.coverBlurDataURL),
        coverBlurDataURLEn: cleanOptional(payload.coverBlurDataURLEn),
        additionalCovers: payload.additionalCovers
          ? {
              zh: payload.additionalCovers.zh?.filter(Boolean),
              en: payload.additionalCovers.en?.filter(Boolean),
            }
          : undefined,
        readDate: cleanOptional(payload.readDate),
        summary: cleanOptional(payload.summary),
        summaryEn: cleanOptional(payload.summaryEn),
        readingNotes: cleanOptional(payload.readingNotes),
        readingNotesEn: cleanOptional(payload.readingNotesEn),
        discussionPoints: payload.discussionPoints?.filter(Boolean),
        discussionPointsEn: payload.discussionPointsEn?.filter(Boolean),
        tags: payload.tags?.map((tag) => tag.trim()).filter(Boolean),
        links:
          payload.links && (cleanOptionalPath(payload.links.publisher) || cleanOptionalPath(payload.links.notes))
            ? {
                publisher: cleanOptionalPath(payload.links.publisher),
                notes: cleanOptionalPath(payload.links.notes),
              }
            : undefined,
      });

      revalidateBookRoutes();

      return NextResponse.json({ ok: true, book }, { status: 201 });
    } catch (error) {
      await logServerError('admin.book_v2.create_failed', error, { slug: payload.slug });
      throw error;
    }
  });
}
