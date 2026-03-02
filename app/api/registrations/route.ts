import { NextRequest, NextResponse } from 'next/server';
import { listRegistrations } from '@/lib/notion';
import { rateLimit } from '@/lib/rate-limit';

// Force dynamic rendering (API routes are not suitable for static generation)
export const dynamic = 'force-dynamic';

// GET /api/registrations?limit=10
export async function GET(req: NextRequest) {
  try {
    // Admin-only: require secret token in Authorization header
    const secret = process.env.ADMIN_API_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const { allowed, retryAfterMs } = await rateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
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

    const dbId = process.env.NOTION_DB_ID;
    const token = process.env.NOTION_TOKEN;
    if (!dbId || !token) {
      return NextResponse.json({ items: [], simulated: true }, { status: 200 });
    }
    const items = await listRegistrations(dbId, limit);
    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error('List registrations error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
