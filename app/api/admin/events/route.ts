import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { readJsonFile, writeJsonFile } from '@/lib/json-store';
import type { EventContentId, EventContentMap } from '@/types/event-content';

export const dynamic = 'force-dynamic';

const localizedTextSchema = z.object({
  zh: z.string().min(1).max(8000),
  en: z.string().min(1).max(8000),
});

const eventRecordSchema = z.object({
  posterSrc: z.string().min(1).max(500),
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

  return NextResponse.json({ events: readJsonFile<EventContentMap>('data/events-content.json') }, { status: 200 });
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || 'Invalid payload.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const nextEvents = payload.events as EventContentMap;

  for (const eventId of Object.keys(nextEvents) as EventContentId[]) {
    if (nextEvents[eventId].comingSoon && !nextEvents[eventId].comingSoonBody) {
      return NextResponse.json({ error: `${eventId} requires a coming-soon message.` }, { status: 400 });
    }
  }

  writeJsonFile('data/events-content.json', nextEvents);
  revalidateEventRoutes();

  return NextResponse.json({ ok: true, events: nextEvents }, { status: 200 });
}