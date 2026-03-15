import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { AdminDocumentConflictError, loadAdminDocument, loadAdminDocumentRecord, saveAdminDocumentRecord } from '@/lib/admin-content-store';
import { cleanupRemovedAdminAssets } from '@/lib/admin-asset-manager';
import { logServerError, logServerWarning } from '@/lib/observability';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import type { EventContentId, EventContentMap } from '@/types/event-content';
import type { Book } from '@/types/book';

export const dynamic = 'force-dynamic';

const localizedTextSchema = z.object({
  zh: z.string().min(1).max(8000),
  en: z.string().min(1).max(8000),
});

const optionalDataUrl = z.union([z.string().max(20_000).regex(/^data:image\//), z.literal(''), z.null()]).optional();

const eventRecordSchema = z.object({
  posterSrc: z.string().min(1).max(500),
  posterBlurDataURL: optionalDataUrl,
  posterAlt: localizedTextSchema,
  title: localizedTextSchema,
  description: localizedTextSchema,
  signupPath: z.string().min(1).max(200),
  imagePosition: z.enum(['left', 'right']),
  attendanceMode: z.enum(['offline', 'online']),
  locationName: localizedTextSchema,
  addressCountry: z.string().min(2).max(4).optional(),
  comingSoon: z.boolean().optional(),
  comingSoonBody: localizedTextSchema.optional(),
});

const requestSchema = z.object({
  events: z.object({
    TW: eventRecordSchema,
    NL: eventRecordSchema,
    EN: eventRecordSchema,
    DETOX: eventRecordSchema,
  }),
  expectedUpdatedAt: z.string().datetime().nullable().optional(),
});

function revalidateEventRoutes() {
  const paths = [
    '/zh/events',
    '/en/events',
    '/zh/signup',
    '/en/signup',
    '/zh/engclub',
    '/en/engclub',
    '/zh/detox',
    '/en/detox',
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const record = await loadAdminDocumentRecord<EventContentMap>({ key: 'events', fallbackFile: 'data/events-content.json' });
  return NextResponse.json({ events: record.value, updatedAt: record.updatedAt }, { status: 200 });
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: z.infer<typeof requestSchema>;

  try {
    payload = await parseJsonRequest(request, requestSchema, { maxBytes: 250_000 });
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const nextEvents = payload.events as EventContentMap;
  const previousEvents = await loadAdminDocument<EventContentMap>({ key: 'events', fallbackFile: 'data/events-content.json' });
  const currentBooks = await loadAdminDocument<Book[]>({ key: 'books', fallbackFile: 'data/books.json' });

  for (const eventId of Object.keys(nextEvents) as EventContentId[]) {
    if (nextEvents[eventId].comingSoon && !nextEvents[eventId].comingSoonBody) {
      return NextResponse.json({ error: `${eventId} requires a coming-soon message.` }, { status: 400 });
    }
  }

  let savedRecord;
  try {
    savedRecord = await saveAdminDocumentRecord(
      { key: 'events', fallbackFile: 'data/events-content.json' },
      nextEvents,
      payload.expectedUpdatedAt
    );
  } catch (error) {
    if (error instanceof AdminDocumentConflictError) {
      await logServerWarning('admin.events.save_conflict', { expectedUpdatedAt: payload.expectedUpdatedAt });
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    await logServerError('admin.events.save_failed', error, { eventIds: Object.keys(nextEvents) });
    throw error;
  }
  await cleanupRemovedAdminAssets({ previousBooks: currentBooks, nextBooks: currentBooks, previousEvents, nextEvents: savedRecord.value });
  revalidateEventRoutes();

  return NextResponse.json({ ok: true, events: savedRecord.value, updatedAt: savedRecord.updatedAt }, { status: 200 });
}