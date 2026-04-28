import { NextRequest, NextResponse } from 'next/server';
import { runWithRequestTrace } from '@/lib/observability';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { fetchRows, getTableUrl, getSupabaseHeaders } from '@/lib/supabase-utils';
import { sendPaymentConfirmationEmail } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/registrations/[id]/confirm-payment
export async function POST(req: NextRequest, context: RouteContext) {
  return runWithRequestTrace(req, 'admin.registrations.confirm-payment', async () => {
    // Check admin authentication
    if (!(await isAuthorizedAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const { id: registrationId } = await context.params;

      // Fetch registration with event details
      const registrations = await fetchRows<{
        id: string;
        name: string;
        email: string;
        locale: string;
        status: string;
        event_id: number;
        audit_trail: Array<{ event: string; actor: string; at: string; summary: string }> | null;
        events: {
          id: number;
          title: string;
          title_en: string | null;
          event_date: string;
          venue_location: string;
          venue_name: string | null;
          venue_address: string | null;
        };
      }>(
        'registrations',
        'id,name,email,locale,status,event_id,audit_trail,events(id,title,title_en,event_date,venue_location,venue_name,venue_address)',
        `id=eq.${registrationId}`
      );

      if (registrations.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Registration not found' },
          { status: 404 }
        );
      }

      const registration = registrations[0];

      // Validate registration status
      if (registration.status !== 'pending') {
        return NextResponse.json(
          {
            ok: false,
            error: `Cannot confirm payment for registration with status '${registration.status}'. Only registrations with status 'pending' can be confirmed.`,
          },
          { status: 400 }
        );
      }

      // Prepare new audit entry
      const newAuditEntry = {
        event: 'admin_confirmed_payment',
        actor: 'admin',
        at: new Date().toISOString(),
        summary: 'Payment confirmed by admin',
      };

      // Append to existing audit trail
      const updatedAuditTrail = [...(registration.audit_trail || []), newAuditEntry];

      // Update registration status and audit trail
      const updateUrl = getTableUrl('registrations');
      const updateResponse = await fetch(`${updateUrl}?id=eq.${registrationId}`, {
        method: 'PATCH',
        headers: getSupabaseHeaders(),
        body: JSON.stringify({
          status: 'confirmed',
          audit_trail: updatedAuditTrail,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update registration status');
      }

      // Send payment confirmation email
      const event = registration.events;

      await sendPaymentConfirmationEmail({
        locale: registration.locale as 'zh' | 'en',
        name: registration.name,
        email: registration.email,
        eventTitle: event.title,
        eventTitleEn: event.title_en || event.title,
        eventDate: event.event_date,
        eventLocation: event.venue_location,
        venueName: event.venue_name || '',
        venueAddress: event.venue_address || undefined,
        registrationId: registration.id,
        eventId: event.id,
      });

      return NextResponse.json({
        ok: true,
        message: 'Payment confirmed and email sent',
      });
    } catch (error) {
      console.error('Error confirming payment:', error);
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
