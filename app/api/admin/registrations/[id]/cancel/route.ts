import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { runWithRequestTrace } from '@/lib/observability';
import { fetchRows, getTableUrl, getSupabaseHeaders } from '@/lib/supabase-utils';
import { sendEmail } from '@/lib/email-service';
import { EMAIL_CONFIG } from '@/lib/env';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/registrations/[id]/cancel - Cancel a registration
export async function POST(request: NextRequest, context: RouteContext) {
  return runWithRequestTrace(request, 'admin.registrations.cancel', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { emailContent, emailSubject } = body as { emailContent?: string | null; emailSubject?: string };

    try {
      // Fetch registration with audit trail
      const registrations = await fetchRows<{
        id: string;
        status: string;
        email: string;
        name: string;
        audit_trail: Array<{ event: string; actor: string; at: string; summary: string }> | null;
      }>('registrations', 'id,status,email,name,audit_trail', `id=eq.${id}`);

      if (registrations.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Registration not found' },
          { status: 404 }
        );
      }

      const registration = registrations[0];

      // Only allow cancellation for non-cancelled registrations
      if (registration.status === 'cancelled') {
        return NextResponse.json(
          { ok: false, error: `Registration is already cancelled` },
          { status: 400 }
        );
      }

      // Prepare new audit entry
      const newAuditEntry = {
        event: 'admin_cancelled',
        actor: 'admin',
        at: new Date().toISOString(),
        summary: emailContent ? 'Registration cancelled by admin with email notification' : 'Registration cancelled by admin without email notification',
      };

      // Append to existing audit trail
      const updatedAuditTrail = [...(registration.audit_trail || []), newAuditEntry];

      // Update registration status and audit trail
      const updateUrl = `${getTableUrl('registrations')}?id=eq.${id}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: getSupabaseHeaders(),
        body: JSON.stringify({
          status: 'cancelled',
          audit_trail: updatedAuditTrail,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update registration status');
      }

      // Send email if content was provided
      let emailSent = false;
      if (emailContent) {
        try {
          const replyTo = EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO || undefined;
          const result = await sendEmail(
            registration.email,
            emailSubject || 'Registration Cancelled - Book Digest',
            emailContent,
            replyTo
          );

          emailSent = result.status === 'sent';
          if (result.status !== 'sent') {
            console.error('Failed to send cancellation email:', result.reason);
          }
        } catch (emailError) {
          console.error('Failed to send cancellation email:', emailError);
          // Continue even if email fails
        }
      }

      const message = emailContent
        ? emailSent
          ? 'Registration cancelled and email sent'
          : 'Registration cancelled but email failed to send'
        : 'Registration cancelled without email';

      return NextResponse.json(
        { ok: true, message },
        { status: 200 }
      );
    } catch (error) {
      console.error('Failed to cancel registration:', error);
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : 'Failed to cancel registration' },
        { status: 500 }
      );
    }
  });
}
