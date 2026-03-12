import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { readJsonFile, writeJsonFile } from '@/lib/json-store';
import type { Book } from '@/types/book';

export const dynamic = 'force-dynamic';

const optionalString = z.string().max(50000).optional().nullable();
const urlOrPath = z.string().min(1).max(500).refine((value) => value.startsWith('/') || /^https?:\/\//.test(value), {
  message: 'Expected an absolute URL or a site-relative path.',
});

const optionalUrlOrPath = z.union([urlOrPath, z.literal(''), z.null()]).optional();

const bookSchema = z.object({
  id: z.union([z.string().min(1), z.number()]),
  slug: z.string().min(1).max(160),
  title: z.string().min(1).max(200),
  titleEn: optionalString,
  author: z.string().min(1).max(200),
  authorEn: optionalString,
  coverUrl: optionalUrlOrPath,
  coverUrlEn: optionalUrlOrPath,
  coverUrls: z.array(urlOrPath).optional(),
  coverUrlsEn: z.array(urlOrPath).optional(),
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

const requestSchema = z.object({
  books: z.array(bookSchema).min(1),
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

function normalizeBooks(books: z.infer<typeof bookSchema>[]): Book[] {
  return books.map((book) => ({
    id: book.id,
    slug: book.slug.trim(),
    title: book.title.trim(),
    titleEn: cleanOptional(book.titleEn),
    author: book.author.trim(),
    authorEn: cleanOptional(book.authorEn),
    coverUrl: cleanOptionalPath(book.coverUrl),
    coverUrlEn: cleanOptionalPath(book.coverUrlEn),
    coverUrls: book.coverUrls?.filter(Boolean),
    coverUrlsEn: book.coverUrlsEn?.filter(Boolean),
    readDate: cleanOptional(book.readDate),
    summary: cleanOptional(book.summary),
    summaryEn: cleanOptional(book.summaryEn),
    readingNotes: cleanOptional(book.readingNotes),
    readingNotesEn: cleanOptional(book.readingNotesEn),
    discussionPoints: book.discussionPoints?.filter(Boolean),
    discussionPointsEn: book.discussionPointsEn?.filter(Boolean),
    tags: book.tags?.map((tag) => tag.trim()).filter(Boolean),
    links: book.links && (cleanOptionalPath(book.links.publisher) || cleanOptionalPath(book.links.notes))
      ? {
          publisher: cleanOptionalPath(book.links.publisher),
          notes: cleanOptionalPath(book.links.notes),
        }
      : undefined,
  }));
}

function revalidateBookRoutes(books: Book[]) {
  revalidatePath('/');
  revalidatePath('/zh');
  revalidatePath('/en');
  revalidatePath('/zh/books');
  revalidatePath('/en/books');
  revalidatePath('/sitemap.xml');

  for (const book of books) {
    revalidatePath(`/zh/books/${book.slug}`);
    revalidatePath(`/en/books/${book.slug}`);
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ books: readJsonFile<Book[]>('data/books.json') }, { status: 200 });
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsedBody: z.infer<typeof requestSchema>;

  try {
    parsedBody = requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid payload.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const normalizedBooks = normalizeBooks(parsedBody.books);
  const uniqueSlugs = new Set(normalizedBooks.map((book) => book.slug));
  if (uniqueSlugs.size !== normalizedBooks.length) {
    return NextResponse.json({ error: 'Book slugs must be unique.' }, { status: 400 });
  }

  writeJsonFile('data/books.json', normalizedBooks);
  revalidateBookRoutes(normalizedBooks);

  return NextResponse.json({ ok: true, books: normalizedBooks }, { status: 200 });
}