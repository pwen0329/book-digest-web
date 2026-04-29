import { NextRequest, NextResponse } from 'next/server';
import { runWithRequestTrace } from '@/lib/observability';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { fetchRows, getTableUrl, getSupabaseHeaders } from '@/lib/supabase-utils';
import { sendEmail } from '@/lib/email-service';
import { interpolateTemplate } from '@/lib/email-templates';
import { formatEventDate } from '@/lib/date-formatter';
import { CLIENT_ENV, EMAIL_CONFIG } from '@/lib/env';

export const dynamic = 'force-dynamic';

type RequestBody = {
  registrationIds: string[];
  subjectZh: string;
  subjectEn: string;
  templateZh: string;
  templateEn: string;
};

type SendResult = {
  registrationId: string;
  success: boolean;
  email: string;
  name: string;
  error?: string;
};

// POST /api/admin/send-final-confirmation
export async function POST(req: NextRequest) {
  return runWithRequestTrace(req, 'admin.send-final-confirmation', async () => {
    // Check admin authentication
    if (!(await isAuthorizedAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const body = await req.json() as RequestBody;
      const { registrationIds, subjectZh, subjectEn, templateZh, templateEn } = body;

      // Validate request body
      if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
        return NextResponse.json(
          { error: 'registrationIds must be a non-empty array' },
          { status: 400 }
        );
      }

      if (!subjectZh || !subjectEn || !templateZh || !templateEn) {
        return NextResponse.json(
          { error: 'Email templates cannot be empty' },
          { status: 400 }
        );
      }

      // Fetch registrations with event details
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
        `id=in.(${registrationIds.join(',')})`
      );

      if (registrations.length !== registrationIds.length) {
        return NextResponse.json(
          { error: 'Some registration IDs not found' },
          { status: 400 }
        );
      }

      // Validate all registrations are confirmed status
      const nonConfirmed = registrations.filter(r => r.status !== 'confirmed');
      if (nonConfirmed.length > 0) {
        return NextResponse.json(
          { error: 'All registrations must be confirmed status' },
          { status: 400 }
        );
      }

      // Validate all registrations belong to same event
      const eventIds = new Set(registrations.map(r => r.event_id));
      if (eventIds.size > 1) {
        return NextResponse.json(
          { error: 'All registrations must belong to the same event' },
          { status: 400 }
        );
      }

      // Process each registration
      const results: SendResult[] = [];
      const updateUrl = getTableUrl('registrations');

      for (const registration of registrations) {
        const event = registration.events;
        const locale = registration.locale as 'zh' | 'en';

        // Select template based on locale
        const subject = locale === 'zh' ? subjectZh : subjectEn;
        const body = locale === 'zh' ? templateZh : templateEn;

        // Format event date
        const formattedDate = formatEventDate(
          event.event_date,
          locale,
          event.venue_location
        );

        // Format venue location
        const venueDisplay = event.venue_address
          ? `${event.venue_name || ''}, ${event.venue_address}`
          : event.venue_name || event.venue_location;

        // Interpolate template variables
        const context = {
          name: registration.name,
          eventTitle: locale === 'en' && event.title_en ? event.title_en : event.title,
          eventDate: formattedDate,
          eventLocation: venueDisplay,
          siteUrl: CLIENT_ENV.SITE_URL,
        };

        const interpolatedSubject = interpolateTemplate(subject, context);
        const interpolatedBody = interpolateTemplate(body, context);

        // Send email
        const emailResult = await sendEmail(
          registration.email,
          interpolatedSubject,
          interpolatedBody,
          EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO
        );

        if (emailResult.status === 'sent') {
          // Update registration status to 'ready' and add audit trail
          const newAuditEntry = {
            event: 'email_sent',
            actor: 'admin',
            at: new Date().toISOString(),
            summary: 'Final confirmation email sent',
            details: { emailType: 'final_confirmation' },
          };

          const updatedAuditTrail = [...(registration.audit_trail || []), newAuditEntry];

          const updateResponse = await fetch(`${updateUrl}?id=eq.${registration.id}`, {
            method: 'PATCH',
            headers: getSupabaseHeaders(),
            body: JSON.stringify({
              status: 'ready',
              audit_trail: updatedAuditTrail,
              updated_at: new Date().toISOString(),
            }),
          });

          if (!updateResponse.ok) {
            // Email sent but status update failed
            results.push({
              registrationId: registration.id,
              success: false,
              email: registration.email,
              name: registration.name,
              error: 'Email sent but failed to update status',
            });
            continue;
          }

          results.push({
            registrationId: registration.id,
            success: true,
            email: registration.email,
            name: registration.name,
          });
        } else {
          // Email failed
          results.push({
            registrationId: registration.id,
            success: false,
            email: registration.email,
            name: registration.name,
            error: emailResult.reason || 'Failed to send email',
          });
        }
      }

      // Calculate summary
      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      };

      return NextResponse.json({ results, summary });
    } catch (error) {
      console.error('Error sending final confirmation emails:', error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}
