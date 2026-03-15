import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { loadAdminDocumentMock } = vi.hoisted(() => ({
  loadAdminDocumentMock: vi.fn(),
}));

vi.mock('@/lib/admin-content-store', () => ({
  loadAdminDocument: loadAdminDocumentMock,
}));

import { getBooks } from '@/lib/books';
import { getEventsContent } from '@/lib/events-content';

describe('persistent content bundled fallbacks', () => {
  afterEach(() => {
    loadAdminDocumentMock.mockReset();
  });

  it('keeps homepage and books data available when the remote books document is empty', async () => {
    loadAdminDocumentMock.mockResolvedValueOnce([]);

    const books = await getBooks();

    expect(books.length).toBeGreaterThan(0);
    expect(books[0]).toHaveProperty('slug');
    expect(books[0]).toHaveProperty('title');
  });

  it('keeps events data available when the remote events document is malformed', async () => {
    loadAdminDocumentMock.mockResolvedValueOnce({ EN: { title: { en: 'Broken partial payload' } } });

    const events = await getEventsContent();

    expect(events.TW.title.zh.length).toBeGreaterThan(0);
    expect(events.EN.title.en.length).toBeGreaterThan(0);
    expect(events.DETOX.description.zh.length).toBeGreaterThan(0);
  });
});