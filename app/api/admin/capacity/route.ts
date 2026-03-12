import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { getSignupCapacityConfig, type CapacityConfigFile, type SignupLocation } from '@/lib/signup-capacity-config';
import { writeJsonFile } from '@/lib/json-store';
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
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ capacity: getSignupCapacityConfig() }, { status: 200 });
}

export async function PUT(request: NextRequest) {
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

  writeJsonFile('data/signup-capacity.json', nextCapacity satisfies CapacityConfigFile);
  revalidateCapacityRoutes();

  return NextResponse.json({ ok: true, capacity: nextCapacity }, { status: 200 });
}