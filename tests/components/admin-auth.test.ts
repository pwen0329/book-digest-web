import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { shouldUseSecureAdminCookie } from '@/lib/admin-auth';

describe('admin auth cookies', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not force secure cookies for localhost production starts', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const request = {
      headers: new Headers(),
      nextUrl: new URL('http://localhost:3000/admin'),
    } as never;

    expect(shouldUseSecureAdminCookie(request)).toBe(false);
  });

  it('uses secure cookies for https production requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const request = {
      headers: new Headers({ 'x-forwarded-proto': 'https' }),
      nextUrl: new URL('https://bookdigest.club/admin'),
    } as never;

    expect(shouldUseSecureAdminCookie(request)).toBe(true);
  });
});