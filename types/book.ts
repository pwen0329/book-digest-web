// Book type - matches relational database schema
export type Book = {
  id: number;
  slug: string;
  sortOrder?: number;

  // Core fields
  title: string;
  author: string;
  readDate?: string; // ISO date

  // English translations
  titleEn?: string;
  authorEn?: string;

  // Content
  summary?: string;
  summaryEn?: string;
  readingNotes?: string;
  readingNotesEn?: string;

  // Arrays
  discussionPoints?: string[];
  discussionPointsEn?: string[];
  tags?: string[];

  // Cover images
  coverUrl?: string;
  coverUrlEn?: string;
  coverBlurDataURL?: string;
  coverBlurDataURLEn?: string;

  // Links (JSONB in DB)
  links?: {
    publisher?: string;
    notes?: string;
  };

  // Additional covers (JSONB in DB)
  additionalCovers?: {
    zh?: string[];
    en?: string[];
  };

  createdAt: string;
  updatedAt: string;
};

// Database column names (snake_case) for Supabase queries
export type BookRow = {
  id: number;
  slug: string;
  sort_order: number | null;
  title: string;
  author: string;
  read_date: string | null;
  title_en: string | null;
  author_en: string | null;
  summary: string | null;
  summary_en: string | null;
  reading_notes: string | null;
  reading_notes_en: string | null;
  discussion_points: string[] | null;
  discussion_points_en: string[] | null;
  tags: string[] | null;
  cover_url: string | null;
  cover_url_en: string | null;
  cover_blur_data_url: string | null;
  cover_blur_data_url_en: string | null;
  links: any | null; // JSONB
  additional_covers: any | null; // JSONB
  created_at: string;
  updated_at: string;
};

// Convert database row to application type
export function bookFromRow(row: BookRow): Book {
  return {
    id: row.id,
    slug: row.slug,
    sortOrder: row.sort_order ?? undefined,
    title: row.title,
    author: row.author,
    readDate: row.read_date ?? undefined,
    titleEn: row.title_en ?? undefined,
    authorEn: row.author_en ?? undefined,
    summary: row.summary ?? undefined,
    summaryEn: row.summary_en ?? undefined,
    readingNotes: row.reading_notes ?? undefined,
    readingNotesEn: row.reading_notes_en ?? undefined,
    discussionPoints: row.discussion_points ?? undefined,
    discussionPointsEn: row.discussion_points_en ?? undefined,
    tags: row.tags ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    coverUrlEn: row.cover_url_en ?? undefined,
    coverBlurDataURL: row.cover_blur_data_url ?? undefined,
    coverBlurDataURLEn: row.cover_blur_data_url_en ?? undefined,
    links: row.links ?? undefined,
    additionalCovers: row.additional_covers ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Convert application type to database row (for inserts/updates)
export function bookToRow(book: Partial<Book>): Partial<BookRow> {
  const row: Partial<BookRow> = {};
  if (book.slug !== undefined) row.slug = book.slug;
  if (book.sortOrder !== undefined) row.sort_order = book.sortOrder ?? null;
  if (book.title !== undefined) row.title = book.title;
  if (book.author !== undefined) row.author = book.author;
  if (book.readDate !== undefined) row.read_date = book.readDate ?? null;
  if (book.titleEn !== undefined) row.title_en = book.titleEn ?? null;
  if (book.authorEn !== undefined) row.author_en = book.authorEn ?? null;
  if (book.summary !== undefined) row.summary = book.summary ?? null;
  if (book.summaryEn !== undefined) row.summary_en = book.summaryEn ?? null;
  if (book.readingNotes !== undefined) row.reading_notes = book.readingNotes ?? null;
  if (book.readingNotesEn !== undefined) row.reading_notes_en = book.readingNotesEn ?? null;
  if (book.discussionPoints !== undefined) row.discussion_points = book.discussionPoints ?? null;
  if (book.discussionPointsEn !== undefined) row.discussion_points_en = book.discussionPointsEn ?? null;
  if (book.tags !== undefined) row.tags = book.tags ?? null;
  if (book.coverUrl !== undefined) row.cover_url = book.coverUrl ?? null;
  if (book.coverUrlEn !== undefined) row.cover_url_en = book.coverUrlEn ?? null;
  if (book.coverBlurDataURL !== undefined) row.cover_blur_data_url = book.coverBlurDataURL ?? null;
  if (book.coverBlurDataURLEn !== undefined) row.cover_blur_data_url_en = book.coverBlurDataURLEn ?? null;
  if (book.links !== undefined) row.links = book.links ?? null;
  if (book.additionalCovers !== undefined) row.additional_covers = book.additionalCovers ?? null;
  return row;
}

// Legacy type for backward compatibility during migration
export type LegacyBook = {
  id: string | number;
  sortOrder?: number;
  slug: string;
  title: string;
  titleEn?: string;
  author: string;
  authorEn?: string;
  coverUrl?: string;
  coverUrlEn?: string;
  coverBlurDataURL?: string;
  coverBlurDataURLEn?: string;
  coverUrls?: string[];
  coverUrlsEn?: string[];
  readDate?: string;
  summary?: string;
  summaryEn?: string;
  readingNotes?: string;
  readingNotesEn?: string;
  discussionPoints?: string[];
  discussionPointsEn?: string[];
  tags?: string[];
  links?: {
    publisher?: string;
    notes?: string;
  };
};

// Draft book type (for admin UI - before saved to database)
export type DraftBook = Omit<Book, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: number; // undefined means draft, number means persisted
  createdAt?: string;
  updatedAt?: string;
};

