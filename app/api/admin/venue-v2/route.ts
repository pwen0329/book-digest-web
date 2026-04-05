import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import { createVenue } from '@/lib/venues';

export const dynamic = 'force-dynamic';

const venueSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.enum(['TW', 'NL', 'ONLINE']),
  address: z.string().max(500).optional().nullable(),
  maxCapacity: z.number().int().positive(),
  isVirtual: z.boolean().default(false),
});

function revalidateVenueRoutes() {
  revalidatePath('/zh/events');
  revalidatePath('/en/events');
  revalidatePath('/zh/signup');
  revalidatePath('/en/signup');
}

// POST /api/admin/venue-v2 - Create new venue
export async function POST(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.venue_v2.create', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: z.infer<typeof venueSchema>;

    try {
      payload = await parseJsonRequest(request, venueSchema, { maxBytes: 10_000 });
    } catch (error) {
      if (error instanceof JsonRequestError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    try {
      const venue = await createVenue({
        name: payload.name.trim(),
        location: payload.location,
        address: payload.address?.trim() || undefined,
        maxCapacity: payload.maxCapacity,
        isVirtual: payload.isVirtual,
      });

      revalidateVenueRoutes();

      return NextResponse.json({ ok: true, venue }, { status: 201 });
    } catch (error) {
      await logServerError('admin.venue_v2.create_failed', error, { name: payload.name });
      throw error;
    }
  });
}
