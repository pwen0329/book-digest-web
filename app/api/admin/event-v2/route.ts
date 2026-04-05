import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import { createEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  slug: z.string().min(1).max(200),
  eventTypeCode: z.string().min(1).max(50),
  venueId: z.number().int().positive(),
  bookId: z.number().int().positive().optional().nullable(),
  title: z.string().min(1).max(1000),
  titleEn: z.string().min(1).max(1000).optional().nullable(),
  description: z.string().min(1).max(8000).optional().nullable(),
  descriptionEn: z.string().min(1).max(8000).optional().nullable(),
  eventDate: z.string().datetime(),
  registrationOpensAt: z.string().datetime(),
  registrationClosesAt: z.string().datetime(),
  coverUrl: z.string().min(1).max(500).optional().nullable(),
  coverUrlEn: z.string().min(1).max(500).optional().nullable(),
  isPublished: z.boolean().default(true),
});

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

// POST /api/admin/event-v2 - Create new event
export async function POST(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.event_v2.create', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    try {
      const event = await createEvent({
        slug: payload.slug.trim(),
        eventTypeCode: payload.eventTypeCode,
        venueId: payload.venueId,
        bookId: payload.bookId || undefined,
        title: payload.title,
        titleEn: payload.titleEn || undefined,
        description: payload.description || undefined,
        descriptionEn: payload.descriptionEn || undefined,
        eventDate: payload.eventDate,
        registrationOpensAt: payload.registrationOpensAt,
        registrationClosesAt: payload.registrationClosesAt,
        coverUrl: payload.coverUrl || undefined,
        coverUrlEn: payload.coverUrlEn || undefined,
        isPublished: payload.isPublished,
      });

      revalidateEventRoutes();

      return NextResponse.json({ ok: true, event }, { status: 201 });
    } catch (error) {
      await logServerError('admin.event_v2.create_failed', error, { slug: payload.slug });
      throw error;
    }
  });
}
