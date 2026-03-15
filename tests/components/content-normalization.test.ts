import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { Book } from '@/types/book';
import type { EventContentMap } from '@/types/event-content';
import { normalizeBooksDocument } from '@/lib/books';
import { normalizeEventsContentMap } from '@/lib/events-content';

describe('persistent content normalization', () => {
  it('falls back to seeded books when the persistent books document is invalid or empty', () => {
    const fallbackBooks: Book[] = [
      {
        id: 'seed-book',
        slug: 'seed-book',
        title: 'Seed Book',
        author: 'Seed Author',
      },
    ];

    expect(normalizeBooksDocument({ bad: true }, fallbackBooks)).toEqual(fallbackBooks);
    expect(normalizeBooksDocument([], fallbackBooks)).toEqual(fallbackBooks);
  });

  it('merges malformed persistent events with the seeded fallback shape', () => {
    const fallbackEvents: EventContentMap = {
      TW: {
        posterSrc: '/tw.webp',
        posterAlt: { zh: '台灣', en: 'Taiwan' },
        title: { zh: '台灣讀書會', en: 'Taiwan Club' },
        description: { zh: '說明', en: 'Description' },
        signupPath: '/signup?location=TW',
        imagePosition: 'left',
        attendanceMode: 'offline',
        locationName: { zh: '台北', en: 'Taipei' },
      },
      NL: {
        posterSrc: '/nl.webp',
        posterAlt: { zh: '荷蘭', en: 'Netherlands' },
        title: { zh: '荷蘭讀書會', en: 'Netherlands Club' },
        description: { zh: '說明', en: 'Description' },
        signupPath: '/signup?location=NL',
        imagePosition: 'left',
        attendanceMode: 'offline',
        locationName: { zh: '荷蘭', en: 'Netherlands' },
      },
      EN: {
        posterSrc: '/en.webp',
        posterAlt: { zh: '英文', en: 'English' },
        title: { zh: '英文讀書會', en: 'English Club' },
        description: { zh: '說明', en: 'Description' },
        signupPath: '/engclub',
        imagePosition: 'right',
        attendanceMode: 'online',
        locationName: { zh: '線上', en: 'Online' },
      },
      DETOX: {
        posterSrc: '/detox.webp',
        posterAlt: { zh: '排毒', en: 'Detox' },
        title: { zh: '數位排毒', en: 'Detox' },
        description: { zh: '說明', en: 'Description' },
        signupPath: '/detox',
        imagePosition: 'right',
        attendanceMode: 'offline',
        locationName: { zh: '實體', en: 'In-person' },
      },
    };

    const normalized = normalizeEventsContentMap(
      {
        EN: {
          posterSrc: '/broken-en.webp',
          title: { en: 'Only English title' },
          description: { zh: '只有中文描述' },
          signupPath: '/engclub',
          imagePosition: 'right',
          attendanceMode: 'online',
          locationName: { en: 'Online only' },
        },
      },
      fallbackEvents
    );

    expect(normalized.TW).toEqual(fallbackEvents.TW);
    expect(normalized.EN.title.zh).toBe(fallbackEvents.EN.title.zh);
    expect(normalized.EN.title.en).toBe('Only English title');
    expect(normalized.EN.description.zh).toBe('只有中文描述');
    expect(normalized.EN.description.en).toBe(fallbackEvents.EN.description.en);
    expect(normalized.DETOX).toEqual(fallbackEvents.DETOX);
  });
});