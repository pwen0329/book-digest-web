import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import type { Event } from '@/types/event';
import { getEventById, updateEvent, deleteEvent } from '@/lib/events';
import { getEventTypeByCode } from '@/lib/event-types';

export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  slug: z.string().min(1).max(200),
  eventTypeCode: z.string().min(1).max(50),
  // Inline venue fields
  venueName: z.string().max(500).optional().nullable().transform(val => val === '' ? null : val),
  venueNameEn: z.string().max(500).optional().nullable().transform(val => val === '' ? null : val),
  venueCapacity: z.number().int().positive(),
  venueAddress: z.string().max(1000).optional().nullable().transform(val => val === '' ? null : val),
  venueLocation: z.enum(['TW', 'NL', 'ONLINE']),
  // Payment fields
  paymentAmount: z.number().int().min(0),
  paymentCurrency: z.enum(['TWD', 'EUR', 'USD']),
  // Intro template
  introTemplateName: z.string().min(1).max(200),
  bookId: z.number().int().positive().optional().nullable(),
  title: z.string().min(1).max(1000),
  titleEn: z.string().min(1).max(1000).optional().nullable(),
  description: z.string().min(1).max(8000).optional().nullable(),
  descriptionEn: z.string().min(1).max(8000).optional().nullable(),
  eventDate: z.string().datetime({ offset: true }),
  registrationOpensAt: z.string().datetime({ offset: true }),
  registrationClosesAt: z.string().datetime({ offset: true }),
  coverUrl: z.string().max(500).optional().nullable().transform(val => val === '' ? null : val),
  coverUrlEn: z.string().max(500).optional().nullable().transform(val => val === '' ? null : val),
  isPublished: z.boolean(),
}).partial();

function revalidateEventRoutes() {
  revalidatePath('/zh/events');
  revalidatePath('/en/events');
  revalidatePath('/zh/signup');
  revalidatePath('/en/signup');
  revalidatePath('/zh/engclub');
  revalidatePath('/en/engclub');
  revalidatePath('/zh/detox');
  revalidatePath('/en/detox');
}

// GET /api/admin/event-v2/[id] - Get single event by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return runWithRequestTrace(request, 'admin.event_v2.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const event = await getEventById(id, { includeBook: true, includeIntroTemplate: true });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event }, { status: 200 });
  });
}

// PUT /api/admin/event-v2/[id] - Update event
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return runWithRequestTrace(request, 'admin.event_v2.put', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    let payload: z.infer<typeof eventSchema>;

    try {
      payload = await parseJsonRequest(request, eventSchema, { maxBytes: 100_000 });
    } catch (error) {
      if (error instanceof JsonRequestError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    // Validate online venue constraints
    if (payload.venueLocation === 'ONLINE') {
      const eventType = await getEventTypeByCode(payload.eventTypeCode || '');
      if (payload.eventTypeCode && !eventType?.onlinePossible) {
        return NextResponse.json(
          { error: `Event type ${payload.eventTypeCode} does not support online venues` },
          { status: 400 }
        );
      }
    }

    try {
      const updates: Partial<Event> = {};
      if (payload.slug !== undefined) updates.slug = payload.slug.trim();
      if (payload.eventTypeCode !== undefined) updates.eventTypeCode = payload.eventTypeCode;
      if (payload.venueName !== undefined) updates.venueName = payload.venueName || undefined;
      if (payload.venueNameEn !== undefined) updates.venueNameEn = payload.venueNameEn || undefined;
      if (payload.venueCapacity !== undefined) updates.venueCapacity = payload.venueCapacity;
      if (payload.venueAddress !== undefined) updates.venueAddress = payload.venueAddress || undefined;
      if (payload.venueLocation !== undefined) updates.venueLocation = payload.venueLocation;
      if (payload.paymentAmount !== undefined) updates.paymentAmount = payload.paymentAmount;
      if (payload.paymentCurrency !== undefined) updates.paymentCurrency = payload.paymentCurrency;
      if (payload.introTemplateName !== undefined) updates.introTemplateName = payload.introTemplateName;
      if (payload.bookId !== undefined) updates.bookId = payload.bookId || undefined;
      if (payload.title !== undefined) updates.title = payload.title;
      if (payload.titleEn !== undefined) updates.titleEn = payload.titleEn || undefined;
      if (payload.description !== undefined) updates.description = payload.description || undefined;
      if (payload.descriptionEn !== undefined) updates.descriptionEn = payload.descriptionEn || undefined;
      if (payload.eventDate !== undefined) updates.eventDate = payload.eventDate;
      if (payload.registrationOpensAt !== undefined) updates.registrationOpensAt = payload.registrationOpensAt;
      if (payload.registrationClosesAt !== undefined) updates.registrationClosesAt = payload.registrationClosesAt;
      if (payload.coverUrl !== undefined) updates.coverUrl = payload.coverUrl || undefined;
      if (payload.coverUrlEn !== undefined) updates.coverUrlEn = payload.coverUrlEn || undefined;
      if (payload.isPublished !== undefined) updates.isPublished = payload.isPublished;

      const event = await updateEvent(id, updates);

      revalidateEventRoutes();

      return NextResponse.json({ ok: true, event }, { status: 200 });
    } catch (error) {
      await logServerError('admin.event_v2.update_failed', error, { id });
      throw error;
    }
  });
}

// DELETE /api/admin/event-v2/[id] - Delete event
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return runWithRequestTrace(request, 'admin.event_v2.delete', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    try {
      await deleteEvent(id);

      revalidateEventRoutes();

      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
      await logServerError('admin.event_v2.delete_failed', error, { id });
      // Foreign key constraint errors will bubble up
      throw error;
    }
  });
}
