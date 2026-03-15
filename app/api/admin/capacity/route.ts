import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { AdminDocumentConflictError, loadAdminDocumentRecord, saveAdminDocumentRecord } from '@/lib/admin-content-store';
import { logServerError, logServerWarning, runWithRequestTrace } from '@/lib/observability';
import type { CapacityConfigFile, SignupLocation } from '@/lib/signup-capacity-config';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';

export const dynamic = 'force-dynamic';

const slotSchema = z.object({
  enabled: z.boolean(),
  forceFull: z.boolean(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  max: z.number().int().positive(),
});

const requestSchema = z.object({
  capacity: z.object({
    TW: slotSchema,
    NL: slotSchema,
    EN: slotSchema,
    DETOX: slotSchema,
  }),
  expectedUpdatedAt: z.string().datetime().nullable().optional(),
});

function revalidateCapacityRoutes() {
  const paths = ['/zh/signup', '/en/signup', '/zh/engclub', '/en/engclub', '/zh/detox', '/en/detox'];

  for (const path of paths) {
    revalidatePath(path);
  }
}

function validateSlotWindow(slot: z.infer<typeof slotSchema>) {
  const startAt = new Date(slot.startAt);
  const endAt = new Date(slot.endAt);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    return false;
  }

  return true;
}

export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.capacity.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const record = await loadAdminDocumentRecord<CapacityConfigFile>({ key: 'capacity', fallbackFile: 'data/signup-capacity.json' });
    return NextResponse.json({ capacity: record.value, updatedAt: record.updatedAt }, { status: 200 });
  });
}

export async function PUT(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.capacity.put', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: z.infer<typeof requestSchema>;

    try {
      payload = await parseJsonRequest(request, requestSchema, { maxBytes: 20_000 });
    } catch (error) {
      if (error instanceof JsonRequestError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const nextCapacity = payload.capacity;

    for (const location of Object.keys(nextCapacity) as SignupLocation[]) {
      const slot = nextCapacity[location];
      if (!validateSlotWindow(slot)) {
        return NextResponse.json({ error: `${location} has an invalid signup window.` }, { status: 400 });
      }
    }

    let savedRecord;
    try {
      savedRecord = await saveAdminDocumentRecord(
        { key: 'capacity', fallbackFile: 'data/signup-capacity.json' },
        nextCapacity satisfies CapacityConfigFile,
        payload.expectedUpdatedAt
      );
    } catch (error) {
      if (error instanceof AdminDocumentConflictError) {
        await logServerWarning('admin.capacity.save_conflict', { expectedUpdatedAt: payload.expectedUpdatedAt });
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      await logServerError('admin.capacity.save_failed', error, { locations: Object.keys(nextCapacity) });
      throw error;
    }
    revalidateCapacityRoutes();

    return NextResponse.json({ ok: true, capacity: savedRecord.value, updatedAt: savedRecord.updatedAt }, { status: 200 });
  });
}