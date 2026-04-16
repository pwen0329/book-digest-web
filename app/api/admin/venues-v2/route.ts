import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { runWithRequestTrace } from '@/lib/observability';
import { getAllVenues } from '@/lib/venues';

export const dynamic = 'force-dynamic';

// GET /api/admin/venues-v2 - Get all venues
export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.venues_v2.get_all', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const venues = await getAllVenues();
    return NextResponse.json({ venues }, { status: 200 });
  });
}
