import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { getRegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';
import { clearEmailOutbox, getEmailOutboxRecords } from '@/lib/registration-success-email';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.email.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const includeOutbox = request.nextUrl.searchParams.get('includeOutbox') === '1';
    const settings = await getRegistrationSuccessEmailSettings();

    const response: { settings: typeof settings; updatedAt: null; outbox?: ReturnType<typeof getEmailOutboxRecords> } = {
      settings,
      updatedAt: null, // Hardcoded settings, no version tracking
    };

    if (includeOutbox) {
      response.outbox = getEmailOutboxRecords().slice(-20).reverse();
    }

    return NextResponse.json(response, { status: 200 });
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
