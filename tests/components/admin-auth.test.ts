import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { shouldUseSecureAdminCookie, isAuthorizedAdminRequest, validateAdminPassword } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

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
      nextUrl: new URL('https://bookdigest.dev/admin'),
    } as never;

    expect(shouldUseSecureAdminCookie(request)).toBe(true);
  });
});

describe('validateAdminPassword', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', 'test-admin-password');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true for correct password', () => {
    expect(validateAdminPassword('test-admin-password')).toBe(true);
  });

  it('returns false for incorrect password', () => {
    expect(validateAdminPassword('wrong-password')).toBe(false);
  });

  it('returns false when no admin password configured', () => {
    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(validateAdminPassword('any-password')).toBe(false);
  });
});

describe('isAuthorizedAdminRequest - Bearer token auth', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', 'test-admin-password');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true for valid Bearer token', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/test', {
      headers: { Authorization: 'Bearer test-admin-password' },
    });

    expect(await isAuthorizedAdminRequest(req)).toBe(true);
  });

  it('returns false for invalid Bearer token', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/test', {
      headers: { Authorization: 'Bearer wrong-password' },
    });

    expect(await isAuthorizedAdminRequest(req)).toBe(false);
  });

  it('returns false for malformed Bearer token', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/test', {
      headers: { Authorization: 'Bearertest-admin-password' }, // Missing space
    });

    expect(await isAuthorizedAdminRequest(req)).toBe(false);
  });

  it('returns false for non-Bearer authorization', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/test', {
      headers: { Authorization: 'Basic dGVzdDp0ZXN0' },
    });

    expect(await isAuthorizedAdminRequest(req)).toBe(false);
  });

  it('returns false when no authorization header', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/test');

    expect(await isAuthorizedAdminRequest(req)).toBe(false);
  });

  it('returns false when admin password not configured', async () => {
    vi.stubEnv('ADMIN_PASSWORD', '');

    const req = new NextRequest('http://localhost:3000/api/admin/test', {
      headers: { Authorization: 'Bearer test-admin-password' },
    });

    expect(await isAuthorizedAdminRequest(req)).toBe(false);
  });
});