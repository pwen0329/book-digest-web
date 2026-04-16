import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { countActiveRegistrationsByEventId } from '@/lib/registration-store';

export const dynamic = 'force-dynamic';

// GET /api/admin/registrations/count?eventId=123 - Count registrations for an event
export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.registrations.count', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get('eventId');

    if (!eventIdParam) {
      return NextResponse.json({ error: 'eventId parameter is required' }, { status: 400 });
    }

    const eventId = parseInt(eventIdParam, 10);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'Invalid eventId' }, { status: 400 });
    }

    try {
      const count = await countActiveRegistrationsByEventId(eventId);
      return NextResponse.json({ count }, { status: 200 });
    } catch (error) {
      await logServerError('admin.registrations.count_failed', error, { eventId });
      throw error;
    }
  });
}
