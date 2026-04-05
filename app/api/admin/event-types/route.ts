import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { runWithRequestTrace } from '@/lib/observability';
import { getAllEventTypes } from '@/lib/event-types';

export const dynamic = 'force-dynamic';

// GET /api/admin/event-types - Get all event types
export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.event_types.list', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventTypes = await getAllEventTypes();
    return NextResponse.json({ eventTypes }, { status: 200 });
  });
}
