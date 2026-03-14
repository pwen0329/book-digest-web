import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';
import { getRetryAfterSeconds } from '@/lib/http-response';
import { listStoredRegistrations } from '@/lib/registration-store';

// Force dynamic rendering (API routes are not suitable for static generation)
export const dynamic = 'force-dynamic';

// GET /api/registrations?limit=10
export async function GET(req: NextRequest) {
  try {
    if (!(await isAuthorizedAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const { allowed, retryAfterMs } = await rateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': getRetryAfterSeconds(retryAfterMs) } }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawLimit = searchParams.get('limit');
    let limit = 10;
    if (rawLimit !== null) {
      if (!/^\d+$/.test(rawLimit)) {
        return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
      }
      limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return NextResponse.json({ error: 'Invalid limit' }, { status: 400 });
      }
    }

    const locationParam = req.nextUrl.searchParams.get('location');
    const location = locationParam === 'TW' || locationParam === 'NL' || locationParam === 'EN' || locationParam === 'DETOX'
      ? locationParam
      : undefined;

    const items = await listStoredRegistrations(limit, location);
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error('List registrations error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
