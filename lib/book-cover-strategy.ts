import type { Book, DraftBook } from '@/types/book';
import { getBookSortOrder } from '@/lib/book-order';

function sanitizeCoverSegment(value?: string): string {
  return (value || '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .trim() || 'untitled';
}

export function buildCanonicalBookCoverPath(language: 'zh' | 'en', book: Book | DraftBook): string {
  const order = String(getBookSortOrder(book)).padStart(1, '0');
  const title = language === 'zh' ? book.title : book.titleEn || book.title;
  const folder = language === 'zh' ? 'books_zh' : 'books_en';
  return `/images/${folder}/${order}_${sanitizeCoverSegment(title)}.webp`;
}

export function getCanonicalBookCoverHints(book: Book | DraftBook): { zh: string; en: string } {
  return {
    zh: buildCanonicalBookCoverPath('zh', book),
    en: buildCanonicalBookCoverPath('en', book),
  };
}