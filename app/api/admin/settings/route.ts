import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import {
  getAllSettings,
  getSetting,
  upsertSetting,
} from '@/lib/settings';
import type { SettingKey } from '@/types/settings';

export const dynamic = 'force-dynamic';

const upsertRequestSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(), // Can be any JSON value
  description: z.string().min(1).max(1000),
  updatedBy: z.string().max(100).optional(),
});

function revalidateSettingsRoutes() {
  revalidatePath('/zh/events');
  revalidatePath('/en/events');
  revalidatePath('/zh/signup');
  revalidatePath('/en/signup');
}

// GET /api/admin/settings - Get all settings
// GET /api/admin/settings?key=registration_email_enabled - Get single setting by key
export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.settings.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyParam = searchParams.get('key');

    if (keyParam) {
      const setting = await getSetting(keyParam as SettingKey);
      if (!setting) {
        return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
      }

      return NextResponse.json({ setting }, { status: 200 });
    }

    const settings = await getAllSettings();
    return NextResponse.json({ settings }, { status: 200 });
  });
}

// POST /api/admin/settings - Upsert setting
export async function POST(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.settings.upsert', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: z.infer<typeof upsertRequestSchema>;

    try {
      payload = await parseJsonRequest(request, upsertRequestSchema, { maxBytes: 50_000 });
    } catch (error) {
      if (error instanceof JsonRequestError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    try {
      const setting = await upsertSetting(
        payload.key as SettingKey,
        payload.value,
        payload.description.trim(),
        payload.updatedBy?.trim()
      );

      revalidateSettingsRoutes();

      return NextResponse.json({ ok: true, setting }, { status: 200 });
    } catch (error) {
      await logServerError('admin.settings.upsert_failed', error, { key: payload.key });
      throw error;
    }
  });
}
