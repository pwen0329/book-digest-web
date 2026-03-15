import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { AdminDocumentConflictError, loadAdminDocumentRecord, saveAdminDocumentRecord } from '@/lib/admin-content-store';
import { logServerError, logServerWarning, runWithRequestTrace } from '@/lib/observability';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import {
  REGISTRATION_SUCCESS_EMAIL_FILE,
  type RegistrationSuccessEmailSettings,
} from '@/lib/registration-success-email-config';
import { clearEmailOutbox, getEmailOutboxRecords } from '@/lib/registration-success-email';

export const dynamic = 'force-dynamic';

const templateSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(12_000),
});

const requestSchema = z.object({
  settings: z.object({
    enabled: z.boolean(),
    templates: z.object({
      zh: templateSchema,
      en: templateSchema,
    }),
  }),
  expectedUpdatedAt: z.string().datetime().nullable().optional(),
});

export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.email.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const includeOutbox = request.nextUrl.searchParams.get('includeOutbox') === '1';
    const settingsRecord = await loadAdminDocumentRecord<RegistrationSuccessEmailSettings>({
        key: 'registration-success-email',
        fallbackFile: REGISTRATION_SUCCESS_EMAIL_FILE,
      });
    const response: { settings: RegistrationSuccessEmailSettings; updatedAt: string | null; outbox?: ReturnType<typeof getEmailOutboxRecords> } = {
      settings: settingsRecord.value,
      updatedAt: settingsRecord.updatedAt,
    };

    if (includeOutbox) {
      response.outbox = getEmailOutboxRecords().slice(-20).reverse();
    }

    return NextResponse.json(response, { status: 200 });
  });
}

export async function PUT(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.email.put', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: z.infer<typeof requestSchema>;

    try {
      payload = await parseJsonRequest(request, requestSchema, { maxBytes: 40_000 });
    } catch (error) {
      if (error instanceof JsonRequestError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    let savedRecord;
    try {
      savedRecord = await saveAdminDocumentRecord(
        { key: 'registration-success-email', fallbackFile: REGISTRATION_SUCCESS_EMAIL_FILE },
        payload.settings satisfies RegistrationSuccessEmailSettings,
        payload.expectedUpdatedAt
      );
    } catch (error) {
      if (error instanceof AdminDocumentConflictError) {
        await logServerWarning('admin.email.save_conflict', { expectedUpdatedAt: payload.expectedUpdatedAt });
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      await logServerError('admin.email.save_failed', error, { enabled: payload.settings.enabled });
      throw error;
    }
    return NextResponse.json({ ok: true, settings: savedRecord.value, updatedAt: savedRecord.updatedAt }, { status: 200 });
  });
}

export async function DELETE(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.email.delete', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (request.nextUrl.searchParams.get('outbox') !== '1') {
      return NextResponse.json({ error: 'Nothing to delete.' }, { status: 400 });
    }

    try {
      clearEmailOutbox();
    } catch (error) {
      await logServerError('admin.email.clear_outbox_failed', error);
      return NextResponse.json({ error: 'Unable to clear the email outbox.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  });
}