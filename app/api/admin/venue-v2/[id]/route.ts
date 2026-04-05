import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import { getVenueById, updateVenue, deleteVenue } from '@/lib/venues';
import type { Venue } from '@/types/venue';

export const dynamic = 'force-dynamic';

const venueSchema = z.object({
  name: z.string().min(1).max(200),
  location: z.enum(['TW', 'NL', 'ONLINE']),
  address: z.string().max(500).optional().nullable(),
  maxCapacity: z.number().int().positive(),
  isVirtual: z.boolean(),
}).partial();

function revalidateVenueRoutes() {
  revalidatePath('/zh/events');
  revalidatePath('/en/events');
  revalidatePath('/zh/signup');
  revalidatePath('/en/signup');
}

// GET /api/admin/venue-v2/[id] - Get single venue by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return runWithRequestTrace(request, 'admin.venue_v2.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid venue ID' }, { status: 400 });
    }

    const venue = await getVenueById(id);
    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    return NextResponse.json({ venue }, { status: 200 });
  });
}

// PUT /api/admin/venue-v2/[id] - Update venue
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return runWithRequestTrace(request, 'admin.venue_v2.update', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid venue ID' }, { status: 400 });
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
      const updates: Partial<Venue> = {};
      if (payload.name !== undefined) updates.name = payload.name.trim();
      if (payload.location !== undefined) updates.location = payload.location;
      if (payload.address !== undefined) updates.address = payload.address?.trim() || undefined;
      if (payload.maxCapacity !== undefined) updates.maxCapacity = payload.maxCapacity;
      if (payload.isVirtual !== undefined) updates.isVirtual = payload.isVirtual;

      const venue = await updateVenue(id, updates);

      revalidateVenueRoutes();

      return NextResponse.json({ ok: true, venue }, { status: 200 });
    } catch (error) {
      await logServerError('admin.venue_v2.update_failed', error, { id });
      throw error;
    }
  });
}

// DELETE /api/admin/venue-v2/[id] - Delete venue
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return runWithRequestTrace(request, 'admin.venue_v2.delete', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid venue ID' }, { status: 400 });
    }

    try {
      await deleteVenue(id);

      revalidateVenueRoutes();

      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
      await logServerError('admin.venue_v2.delete_failed', error, { id });
      // Foreign key constraint errors will bubble up
      throw error;
    }
  });
}
