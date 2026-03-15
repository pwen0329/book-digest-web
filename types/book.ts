export type Book = {
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
