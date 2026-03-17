import { describe, expect, it } from 'vitest';

import { adminDocumentVersionSchema } from '@/lib/admin-document-version';

describe('admin document version schema', () => {
  it('accepts ISO timestamps emitted by Date.toISOString', () => {
    const parsed = adminDocumentVersionSchema.safeParse('2026-03-17T05:12:34.123Z');
    expect(parsed.success).toBe(true);
  });

  it('accepts Supabase timestamptz strings with microseconds and timezone offsets', () => {
    const parsed = adminDocumentVersionSchema.safeParse('2026-03-17T05:12:34.123456+00:00');
    expect(parsed.success).toBe(true);
  });

  it('accepts null and undefined for first-write flows', () => {
    expect(adminDocumentVersionSchema.safeParse(null).success).toBe(true);
    expect(adminDocumentVersionSchema.safeParse(undefined).success).toBe(true);
  });

  it('rejects non-datetime strings', () => {
    const parsed = adminDocumentVersionSchema.safeParse('not-a-date');
    expect(parsed.success).toBe(false);
  });
});