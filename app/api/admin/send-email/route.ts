import { NextRequest, NextResponse } from 'next/server';
import { runWithRequestTrace } from '@/lib/observability';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { sendRegistrationSuccessEmail, sendPaymentConfirmationEmail } from '@/lib/email-service';
import { getEventById } from '@/lib/events';
import { listStoredRegistrations } from '@/lib/registration-store';
import { HttpError, BadRequestError, NotFoundError } from '@/lib/http-errors';

// ============================================================================
// Request Body Types
// ============================================================================

type SendEmailRequestBody = {
  eventId: number;
  emailType: 'reservation_confirmation' | 'payment_confirmation';
  recipientEmail?: string;
  recipientLocale?: 'zh' | 'en';
};

function validateRequestBody(body: unknown): SendEmailRequestBody {
  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Request body must be a JSON object');
  }

  const obj = body as Record<string, unknown>;

  // Validate eventId
  if (!('eventId' in obj)) {
    throw new BadRequestError('Missing required field: eventId');
  }
  if (typeof obj.eventId !== 'number' || !Number.isInteger(obj.eventId) || obj.eventId <= 0) {
    throw new BadRequestError('eventId must be a positive integer');
  }

  // Validate emailType
  if (!('emailType' in obj)) {
    throw new BadRequestError('Missing required field: emailType');
  }
  if (obj.emailType !== 'reservation_confirmation' && obj.emailType !== 'payment_confirmation') {
    throw new BadRequestError('emailType must be "reservation_confirmation" or "payment_confirmation"');
  }

  // Validate recipientEmail (optional)
  if ('recipientEmail' in obj) {
    if (typeof obj.recipientEmail !== 'string' || !obj.recipientEmail.includes('@')) {
      throw new BadRequestError('recipientEmail must be a valid email address');
    }
  }

  // Validate recipientLocale (optional)
  if ('recipientLocale' in obj) {
    if (obj.recipientLocale !== 'zh' && obj.recipientLocale !== 'en') {
      throw new BadRequestError('recipientLocale must be "zh" or "en"');
    }
  }

  // Ensure no extra fields
  const allowedFields = ['eventId', 'emailType', 'recipientEmail', 'recipientLocale'];
  const extraFields = Object.keys(obj).filter(key => !allowedFields.includes(key));
  if (extraFields.length > 0) {
    throw new BadRequestError(`Unexpected fields in request body: ${extraFields.join(', ')}`);
  }

  return {
    eventId: obj.eventId,
    emailType: obj.emailType,
    recipientEmail: obj.recipientEmail as string | undefined,
    recipientLocale: obj.recipientLocale as 'zh' | 'en' | undefined,
  };
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  return runWithRequestTrace(req, 'POST /api/admin/send-email', async () => {
    // Authorization check
    const isAuthorized = await isAuthorizedAdminRequest(req);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      // Parse and validate request body
      const rawBody = await req.json();
      const body = validateRequestBody(rawBody);

      // Fetch event with venue
      const event = await getEventById(body.eventId, { includeVenue: true });
      if (!event) {
        throw new NotFoundError(`Event with id ${body.eventId} not found`);
      }

      if (!event.venue) {
        throw new BadRequestError(`Event ${body.eventId} has no associated venue`);
      }

      // Test mode: single recipient
      if (body.recipientEmail) {
        const locale = body.recipientLocale || 'en';
        let result;

        if (body.emailType === 'reservation_confirmation') {
          result = await sendRegistrationSuccessEmail({
            locale,
            name: 'Test User',
            email: body.recipientEmail,
            eventTitle: event.title,
            eventTitleEn: event.titleEn,
            eventId: event.id,
          });
        } else {
          result = await sendPaymentConfirmationEmail({
            locale,
            name: 'Test User',
            email: body.recipientEmail,
            eventTitle: locale === 'en' ? event.titleEn : event.title,
            eventDate: event.eventDate,
            eventTime: event.eventTime,
            eventLocation: event.venue.location,
            registrationId: 'test',
            eventId: event.id,
          });
        }

        return NextResponse.json({
          ok: true,
          mode: 'test',
          sent: result.status === 'sent' ? 1 : 0,
          failed: result.status === 'failed' ? 1 : 0,
          skipped: result.status === 'skipped' ? 1 : 0,
          result,
        });
      }

      // Broadcast mode: all registrations
      const registrations = await listStoredRegistrations({
        eventId: body.eventId,
        limit: 10000,
      });

      if (registrations.length === 0) {
        return NextResponse.json({
          ok: true,
          mode: 'broadcast',
          sent: 0,
          failed: 0,
          skipped: 0,
          message: 'No registrations found for this event',
        });
      }

      const results = await Promise.all(
        registrations.map(async (registration) => {
          if (body.emailType === 'reservation_confirmation') {
            return await sendRegistrationSuccessEmail({
              locale: registration.locale,
              name: registration.name,
              email: registration.email,
              eventTitle: event.title,
              eventTitleEn: event.titleEn,
              registrationId: registration.id,
              eventId: event.id,
            });
          } else {
            return await sendPaymentConfirmationEmail({
              locale: registration.locale,
              name: registration.name,
              email: registration.email,
              eventTitle: registration.locale === 'en' ? event.titleEn : event.title,
              eventDate: event.eventDate,
              eventTime: event.eventTime,
              eventLocation: event.venue.location,
              registrationId: registration.id,
              eventId: event.id,
            });
          }
        })
      );

      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const skipped = results.filter(r => r.status === 'skipped').length;

      return NextResponse.json({
        ok: true,
        mode: 'broadcast',
        sent,
        failed,
        skipped,
        total: registrations.length,
      });
    } catch (error) {
      console.error('Error sending email:', error);

      // Handle custom HTTP errors
      if (error instanceof HttpError) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: error.statusCode }
        );
      }

      // Unknown error → 500
      return NextResponse.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        { status: 500 }
      );
    }
  });
}
