import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { getRetryAfterSeconds } from '@/lib/http-response';
import { parseApiReferral } from '@/lib/signup';
import { createRegistrationReservation, updateRegistrationReservation, countActiveRegistrationsByEventId } from '@/lib/registration-store';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { getEventBySlug, calculateRegistrationStatus } from '@/lib/events';
import { EventRegistrationStatus } from '@/types/event';
import { sendRegistrationSuccessEmail } from '@/lib/email-service';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// POST /api/event/[slug]/register
export async function POST(req: NextRequest, context: RouteContext) {
  return runWithRequestTrace(req, 'event.registration', async () => {
    const { slug } = await context.params;
    let registrationStored = false;
    let reservationRecordId: string | null = null;
    const requestId = req.headers.get('x-request-id') || undefined;

    try {
      // Rate limiting
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
      const { allowed, retryAfterMs } = await rateLimit(ip);
      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429, headers: { 'Retry-After': getRetryAfterSeconds(retryAfterMs) } }
        );
      }

      // Fetch event
      const event = await getEventBySlug(slug);
      if (!event || !event.isPublished) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      // Calculate registration status with current registrations
      const currentRegistrations = await countActiveRegistrationsByEventId(event.id);
      const registrationStatus = await calculateRegistrationStatus(event, currentRegistrations);

      if (registrationStatus !== EventRegistrationStatus.OPEN) {
        return NextResponse.json(
          {
            error: registrationStatus === EventRegistrationStatus.UPCOMING ? 'Registration not open yet' : 'Registration closed',
            reason: registrationStatus === EventRegistrationStatus.UPCOMING ? 'upcoming' : 'closed'
          },
          { status: 409 }
        );
      }

      // Parse request body
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
      }

      const visitorId = req.headers.get('x-visitor-id') || null;
      const referral = parseApiReferral(body.referral);
      const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
      const locale = body.locale === 'zh' ? 'zh' : 'en';

      // Honeypot — return silent success if filled by bots
      if (body.website) {
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      // Turnstile verification (if secret key is configured)
      if (process.env.TURNSTILE_SECRET_KEY) {
        const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
        if (!turnstileOk) {
          return NextResponse.json({ error: 'Bot verification failed' }, { status: 403 });
        }
      }

      // Extract and normalize fields
      const rawName = String(body.name || '').trim();
      const firstName = String(body.firstName || '').trim();
      const lastName = String(body.lastName || '').trim();
      const name = rawName || `${firstName} ${lastName}`.trim();
      const age = Number(body.age);
      const profession = String(body.profession || '').trim();
      const email = String(body.email || '').trim();
      const instagram = body.instagram ? String(body.instagram).trim() : undefined;
      const referralValue = referral || 'Others';
      const referralOther = body.referralOther ? String(body.referralOther).trim() : undefined;
      const bankAccount = typeof body.bankAccount === 'string' ? String(body.bankAccount).trim() : undefined;
      const timestamp = new Date().toISOString();

      // Validation
      if (!name || !email || !profession || !Number.isInteger(age)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      }
      if (age < 13 || age > 120) {
        return NextResponse.json({ error: 'Invalid age' }, { status: 400 });
      }
      if (!referral) {
        return NextResponse.json({ error: 'Invalid referral' }, { status: 400 });
      }
      if (referralValue === 'Others' && (!referralOther || referralOther.length < 2)) {
        return NextResponse.json({ error: 'Invalid referralOther' }, { status: 400 });
      }
      if (bankAccount && !/^\d{5}$/.test(bankAccount)) {
        return NextResponse.json({ error: 'Invalid bank account' }, { status: 400 });
      }
      if (firstName.length > 60 || lastName.length > 60) {
        return NextResponse.json({ error: 'Name too long' }, { status: 400 });
      }
      if (profession.length > 120) {
        return NextResponse.json({ error: 'Profession too long' }, { status: 400 });
      }
      if (email.length > 254) {
        return NextResponse.json({ error: 'Email too long' }, { status: 400 });
      }
      if (instagram && instagram.length > 60) {
        return NextResponse.json({ error: 'Instagram handle too long' }, { status: 400 });
      }
      if (referralOther && referralOther.length > 200) {
        return NextResponse.json({ error: 'Referral note too long' }, { status: 400 });
      }

      // Create reservation record
      const reservationRecord = await createRegistrationReservation({
        eventId: event.id,
        locale,
        name,
        age,
        profession,
        email,
        instagram,
        referral: referralValue,
        referralOther,
        bankAccount,
        visitorId: visitorId || undefined,
        requestId,
        timestamp,
        status: 'pending',
      });

      reservationRecordId = reservationRecord.id;
      registrationStored = true;

      // Send confirmation email if enabled
      try {
        await sendRegistrationSuccessEmail({
          locale,
          name,
          email,
          eventTitle: event.title,
          eventTitleEn: event.titleEn,
          eventDate: event.eventDate,
          eventLocation: event.venueLocation,
          venueName: event.venueName || '',
          venueAddress: event.venueAddress,
          bankAccount,
          paymentAmount: event.paymentAmount,
          paymentCurrency: event.paymentCurrency,
          registrationId: reservationRecord.id,
          eventId: event.id,
        });
      } catch (emailError) {
        // Log but don't fail the registration if email fails
        console.error('Failed to send confirmation email:', emailError);
      }

      return NextResponse.json({ ok: true, id: reservationRecord.id }, { status: 201 });
    } catch (err) {
      if (reservationRecordId) {
        await updateRegistrationReservation(reservationRecordId, {
          status: 'cancelled',
          auditEntry: {
            at: new Date().toISOString(),
            event: 'reservation_cancelled',
            actor: 'system',
            summary: 'Registration cancelled after request failure.',
            requestId,
            details: { error: err instanceof Error ? err.message : String(err) },
          },
        }).catch(() => undefined);
      }
      await logServerError('event.registration_failed', err, {
        slug,
        registrationStored,
        url: req.url,
      });
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  });
}
