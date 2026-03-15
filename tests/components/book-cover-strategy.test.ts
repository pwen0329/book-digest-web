import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getCanonicalBookCoverHints } from '@/lib/book-cover-strategy';

describe('book cover strategy', () => {
  it('builds canonical zh and en cover hints from the book order and titles', () => {
    const hints = getCanonicalBookCoverHints({
      id: 'book-61',
      sortOrder: 61,
      slug: 'new-book-61',
      title: '新的 書 / 封面',
      titleEn: 'New Book Cover',
      author: '作者',
      authorEn: 'Author',
    });

    expect(hints.zh).toBe('/images/books_zh/61_新的書封面.webp');
    expect(hints.en).toBe('/images/books_en/61_NewBookCover.webp');
  });
});