import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { runWithRequestTrace } from '@/lib/observability';
import { getAllEvents } from '@/lib/events';
import type { EventType } from '@/types/event';

export const dynamic = 'force-dynamic';

// GET /api/admin/events-v2 - Get all events from database
// Query params: ?eventType=TW&isPublished=true
export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.events_v2.get_all', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventTypeParam = searchParams.get('eventType') as EventType | null;
    const isPublishedParam = searchParams.get('isPublished');

    const events = await getAllEvents({
      eventType: eventTypeParam || undefined,
      isPublished: isPublishedParam ? isPublishedParam === 'true' : undefined,
      includeVenue: true,
      includeBook: true,
    });

    return NextResponse.json({ events }, { status: 200 });
  });
}
