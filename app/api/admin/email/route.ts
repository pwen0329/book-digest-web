import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { writeJsonFile } from '@/lib/json-store';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import {
  REGISTRATION_SUCCESS_EMAIL_FILE,
  getRegistrationSuccessEmailSettings,
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
});

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const includeOutbox = request.nextUrl.searchParams.get('includeOutbox') === '1';
  const response: { settings: RegistrationSuccessEmailSettings; outbox?: ReturnType<typeof getEmailOutboxRecords> } = {
    settings: getRegistrationSuccessEmailSettings(),
  };

  if (includeOutbox) {
    response.outbox = getEmailOutboxRecords().slice(-20).reverse();
  }

  return NextResponse.json(response, { status: 200 });
}

export async function PUT(request: NextRequest) {
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

  writeJsonFile(REGISTRATION_SUCCESS_EMAIL_FILE, payload.settings satisfies RegistrationSuccessEmailSettings);
  return NextResponse.json({ ok: true, settings: payload.settings }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (request.nextUrl.searchParams.get('outbox') !== '1') {
    return NextResponse.json({ error: 'Nothing to delete.' }, { status: 400 });
  }

  try {
    clearEmailOutbox();
  } catch (error) {
    console.error('[api/admin/email] Failed to clear email outbox', { error });
    return NextResponse.json({ error: 'Unable to clear the email outbox.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}