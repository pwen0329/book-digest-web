import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { rateLimit } from '@/lib/rate-limit';
import { getRetryAfterSeconds } from '@/lib/http-response';
import { listStoredRegistrations, serializeRegistrationsCsv, summarizeStoredRegistrations } from '@/lib/registration-store';
import { logServerError, runWithRequestTrace } from '@/lib/observability';

// Force dynamic rendering (API routes are not suitable for static generation)
export const dynamic = 'force-dynamic';

// GET /api/registrations?limit=50&eventId=1&status=confirmed&source=notion&search=alice&createdAfter=...&createdBefore=...&format=csv
export async function GET(req: NextRequest) {
  return runWithRequestTrace(req, 'registrations.list', async () => {
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

    const eventIdParam = req.nextUrl.searchParams.get('eventId');
    const eventId = eventIdParam && /^\d+$/.test(eventIdParam) ? parseInt(eventIdParam, 10) : undefined;

    // Legacy location support (deprecated)
    const locationParam = req.nextUrl.searchParams.get('location');
    const location = locationParam === 'TW' || locationParam === 'NL' || locationParam === 'EN' || locationParam === 'DETOX'
      ? locationParam
      : undefined;

    const statusParam = req.nextUrl.searchParams.get('status');
    const status = statusParam === 'pending' || statusParam === 'confirmed' || statusParam === 'cancelled'
      ? statusParam
      : undefined;

    const sourceParam = req.nextUrl.searchParams.get('source');
    const source = sourceParam === 'pending' || sourceParam === 'simulated' || sourceParam === 'tally' || sourceParam === 'notion'
      ? sourceParam
      : undefined;

    const search = req.nextUrl.searchParams.get('search') || undefined;
    const createdAfter = req.nextUrl.searchParams.get('createdAfter') || undefined;
    const createdBefore = req.nextUrl.searchParams.get('createdBefore') || undefined;
    const format = req.nextUrl.searchParams.get('format') || 'json';

    const [items, summary] = await Promise.all([
      listStoredRegistrations({ limit, eventId, location, status, source, search, createdAfter, createdBefore }),
      summarizeStoredRegistrations(),
    ]);

    if (format === 'csv') {
      return new NextResponse(serializeRegistrationsCsv(items), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="registrations-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      items,
      summary,
      viewerSource: 'registration-store',
      notionMirrorEnabled: process.env.SUBMIT_SAVE_TO_NOTION === '1' && Boolean(process.env.NOTION_DB_ID && process.env.NOTION_TOKEN),
    }, { status: 200 });
    } catch (err) {
      await logServerError('registrations.list_failed', err, { url: req.url });
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  });
}
