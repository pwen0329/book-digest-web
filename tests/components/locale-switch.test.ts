import { describe, expect, it } from 'vitest';
import { buildLocalizedPath } from '@/lib/locale-switch';

describe('buildLocalizedPath', () => {
  it('preserves nested routes, query strings, and hashes', () => {
    const params = new URLSearchParams('location=TW&step=2');

    expect(buildLocalizedPath('/en/signup', 'zh', params, '#details')).toBe('/zh/signup?location=TW&step=2#details');
  });

  it('switches root locale paths correctly', () => {
    expect(buildLocalizedPath('/en', 'zh')).toBe('/zh');
    expect(buildLocalizedPath('/zh', 'en')).toBe('/en');
  });

  it('handles locale-free paths safely', () => {
    expect(buildLocalizedPath('/about', 'zh')).toBe('/zh/about');
  });

  it('preserves venue location in events paths', () => {
    expect(buildLocalizedPath('/en/events/TW', 'zh')).toBe('/zh/events/TW');
    expect(buildLocalizedPath('/en/events/NL', 'zh')).toBe('/zh/events/NL');
    expect(buildLocalizedPath('/en/events/ONLINE', 'zh')).toBe('/zh/events/ONLINE');
  });

  it('switches locale for event registration pages', () => {
    const params = new URLSearchParams('ref=instagram');
    expect(buildLocalizedPath('/en/signup/tw-2026-03', 'zh', params)).toBe('/zh/signup/tw-2026-03?ref=instagram');
  });
});