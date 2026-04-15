import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { getSupabaseUrl, getSupabaseHeaders } from '@/lib/supabase-utils';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// DELETE /api/admin/registrations-by-event/[eventId] - Delete all registrations for an event
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    if (!(await isAuthorizedAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;

    if (!/^\d+$/.test(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const eventIdNum = parseInt(eventId, 10);

    // Delete all registrations for this event
    const deleteUrl = `${getSupabaseUrl()}/rest/v1/registrations?event_id=eq.${eventIdNum}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: getSupabaseHeaders(),
    });

    if (!deleteResponse.ok) {
      const reason = await deleteResponse.text().catch(() => 'unknown');
      throw new Error(`Failed to delete registrations: ${deleteResponse.status} ${reason}`);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('Failed to delete registrations:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
