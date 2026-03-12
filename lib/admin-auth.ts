import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_SESSION_COOKIE = 'book_digest_admin_session';

function compareSecrets(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getAdminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_API_SECRET || null;
}

function getSessionSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET || null;
}

function getExpectedSessionValue(): string | null {
  const password = getAdminPassword();
  const sessionSecret = getSessionSecret();

  if (!password || !sessionSecret) {
    return null;
  }

  return createHash('sha256').update(`${sessionSecret}:${password}`).digest('hex');
}

export function isAdminConfigured(): boolean {
  return Boolean(getAdminPassword() && getSessionSecret());
}

export function validateAdminPassword(password: string): boolean {
  const configuredPassword = getAdminPassword();
  if (!configuredPassword) {
    return false;
  }

  return compareSecrets(configuredPassword, password);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = getExpectedSessionValue();
  if (!expected) {
    return false;
  }

  const cookieStore = await cookies();
  const current = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!current) {
    return false;
  }

  return compareSecrets(expected, current);
}

export async function createAdminSession(): Promise<void> {
  const expected = getExpectedSessionValue();
  if (!expected) {
    throw new Error('Admin authentication is not configured.');
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, expected, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12,
    path: '/',
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function isAuthorizedAdminRequest(request: NextRequest): Promise<boolean> {
  const configuredPassword = getAdminPassword();
  if (!configuredPassword) {
    return false;
  }

  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return compareSecrets(configuredPassword, authorization.slice('Bearer '.length));
  }

  return isAdminAuthenticated();
}