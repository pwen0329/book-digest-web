export type Book = {
  id: string | number;
  slug: string;
  title: string;
  titleEn?: string;
  author: string;
  coverUrl?: string;
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
