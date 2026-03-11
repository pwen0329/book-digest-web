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
});