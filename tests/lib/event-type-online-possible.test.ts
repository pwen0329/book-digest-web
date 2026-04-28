import { describe, it, expect } from 'vitest';
import { eventTypeFromRow } from '@/types/event-type';
import type { EventTypeRow } from '@/types/event-type';

describe('EventType with online_possible field', () => {
  it('should convert online_possible from row to onlinePossible', () => {
    const row: EventTypeRow = {
      code: 'ENGLISH_BOOK_CLUB',
      name_en: 'English Book Club',
      name_zh: '英文讀書會',
      online_possible: true,
    };

    const eventType = eventTypeFromRow(row);

    expect(eventType.code).toBe('ENGLISH_BOOK_CLUB');
    expect(eventType.nameEn).toBe('English Book Club');
    expect(eventType.nameZh).toBe('英文讀書會');
    expect(eventType.onlinePossible).toBe(true);
  });

  it('should handle online_possible false', () => {
    const row: EventTypeRow = {
      code: 'DETOX',
      name_en: 'Detox',
      name_zh: '數位排毒',
      online_possible: false,
    };

    const eventType = eventTypeFromRow(row);

    expect(eventType.code).toBe('DETOX');
    expect(eventType.onlinePossible).toBe(false);
  });

  it('should convert all event types correctly', () => {
    const rows: EventTypeRow[] = [
      { code: 'MANDARIN_BOOK_CLUB', name_en: 'Mandarin Book Club', name_zh: '中文讀書會', online_possible: false },
      { code: 'ENGLISH_BOOK_CLUB', name_en: 'English Book Club', name_zh: '英文讀書會', online_possible: true },
      { code: 'DETOX', name_en: 'Detox', name_zh: '數位排毒', online_possible: false },
      { code: 'FAMILY_READING_CLUB', name_en: 'Family Reading Club', name_zh: '親子讀書會', online_possible: false },
    ];

    const eventTypes = rows.map(eventTypeFromRow);

    expect(eventTypes).toHaveLength(4);
    expect(eventTypes[0].onlinePossible).toBe(false);
    expect(eventTypes[1].onlinePossible).toBe(true);
    expect(eventTypes[2].onlinePossible).toBe(false);
    expect(eventTypes[3].onlinePossible).toBe(false);
  });
});
