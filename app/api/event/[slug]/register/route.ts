import { NextRequest, NextResponse } from 'next/server';
import { saveRegistrationToNotion, type RegistrationInput } from '@/lib/notion';
import { rateLimit } from '@/lib/rate-limit';
import { cryptoRandomId } from '@/lib/crypto-id';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { sendRegistrationSuccessEmail } from '@/lib/registration-success-email';
import { getRetryAfterSeconds } from '@/lib/http-response';
import { parseApiReferral } from '@/lib/signup';
import { createRegistrationReservation, updateRegistrationReservation, countActiveRegistrationsByEventId } from '@/lib/registration-store';
import { logServerError, runWithRequestTrace } from '@/lib/observability';
import { getEventBySlug, calculateRegistrationStatus } from '@/lib/events';
import { EventRegistrationStatus } from '@/types/event';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// POST /api/event/[slug]/register
export async function POST(req: NextRequest, context: RouteContext) {
  return runWithRequestTrace(req, 'event.registration', async () => {
    const { slug } = await context.params;
    let registrationStored = false;
    let tallySucceeded = false;
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
      const event = await getEventBySlug(slug, { includeVenue: true });
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

      // Backward-compat: accept either { name } or { firstName, lastName }
      const rawName = String(body.name || '').trim();
      const firstName = String(body.firstName || '').trim();
      const lastName = String(body.lastName || '').trim();
      const name = rawName || `${firstName} ${lastName}`.trim();

      // Map venue location to legacy location type for backward compatibility with Notion/Tally
      const location = event.venue?.location === 'NL' ? 'NL' : 'TW';

      // Minimal validation mirror of client
      const payload: RegistrationInput = {
        location,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        name,
        age: Number(body.age),
        profession: String(body.profession || '').trim(),
        email: String(body.email || '').trim(),
        instagram: body.instagram ? String(body.instagram) : undefined,
        referral: referral || 'Others',
        referralOther: body.referralOther ? String(body.referralOther) : undefined,
        bankAccount: typeof body.bankAccount === 'string' ? String(body.bankAccount).trim() : undefined,
        timestamp: new Date().toISOString(),
        visitorId: visitorId || undefined,
      };

      // Basic guards
      if (!payload.name || !payload.email || !payload.profession || !Number.isInteger(payload.age)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      }
      // Email format (RFC 5322 relaxed)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
      }
      // Age range
      if (payload.age < 13 || payload.age > 120) {
        return NextResponse.json({ error: 'Invalid age' }, { status: 400 });
      }
      if (!referral) {
        return NextResponse.json({ error: 'Invalid referral' }, { status: 400 });
      }
      if (payload.referral === 'Others' && (!payload.referralOther || payload.referralOther.trim().length < 2)) {
        return NextResponse.json({ error: 'Invalid referralOther' }, { status: 400 });
      }
      // Bank account must be exactly 5 digits if provided
      if (payload.bankAccount && !/^\d{5}$/.test(payload.bankAccount)) {
        return NextResponse.json({ error: 'Invalid bank account' }, { status: 400 });
      }
      // Field length limits (mirror client-side Zod schema)
      if (firstName.length > 60 || lastName.length > 60) {
        return NextResponse.json({ error: 'Name too long' }, { status: 400 });
      }
      if (payload.profession.length > 120) {
        return NextResponse.json({ error: 'Profession too long' }, { status: 400 });
      }
      if (payload.email.length > 254) {
        return NextResponse.json({ error: 'Email too long' }, { status: 400 });
      }
      if (payload.instagram && payload.instagram.length > 60) {
        return NextResponse.json({ error: 'Instagram handle too long' }, { status: 400 });
      }
      if (payload.referralOther && payload.referralOther.length > 200) {
        return NextResponse.json({ error: 'Referral note too long' }, { status: 400 });
      }

      const saveAlsoToNotion = process.env.SUBMIT_SAVE_TO_NOTION === '1';
      const dbId = process.env.NOTION_DB_ID;
      const token = process.env.NOTION_TOKEN;

      // Determine Tally endpoint based on location
      const tallyTW = process.env.TALLY_ENDPOINT_TW;
      const tallyNL = process.env.TALLY_ENDPOINT_NL;
      const tallyEndpoint = location === 'NL' ? tallyNL : tallyTW;

      // Create reservation record
      const reservationRecord = await createRegistrationReservation({
        location,
        locale,
        name: payload.name,
        age: payload.age,
        profession: payload.profession,
        email: payload.email,
        instagram: payload.instagram,
        referral: payload.referral,
        referralOther: payload.referralOther,
        bankAccount: payload.bankAccount,
        visitorId: payload.visitorId,
        requestId,
        timestamp: payload.timestamp || new Date().toISOString(),
        status: 'pending',
        source: 'pending',
        eventId: event.id,
        mirrorState: {
          notion: { enabled: saveAlsoToNotion, status: saveAlsoToNotion ? 'pending' : 'not_configured' },
          tally: { enabled: Boolean(tallyEndpoint), status: tallyEndpoint ? 'pending' : 'not_configured' },
          email: { enabled: Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_OUTBOX_FILE), status: 'pending' },
        },
      });

      reservationRecordId = reservationRecord.id;

      // Forward to Tally if configured
      if (tallyEndpoint) {
        await updateRegistrationReservation(reservationRecord.id, {
          auditEntry: {
            at: new Date().toISOString(),
            event: 'tally_forward_attempted',
            actor: 'tally',
            summary: 'Attempting to forward registration payload to Tally.',
            requestId,
            details: { location, eventSlug: event.slug },
          },
        });

        const tallyBody = {
          Name: payload.name,
          Email: payload.email,
          Age: payload.age,
          Occupation: payload.profession,
          InstagramAccount: payload.instagram || '',
          FindingUs: payload.referral,
          findingUsOthers: payload.referral === 'Others' ? (payload.referralOther || '') : '',
          Purpose: '',
          Attendance: '',
          status: 'new',
          Owner: '',
          ID: cryptoRandomId(),
          Title: `${payload.name} — ${event.title}`.trim(),
          visitorId: visitorId || '',
          bankAccount: payload.bankAccount || '',
          'Created Date': payload.timestamp || new Date().toISOString(),
          'Updated Date': new Date().toISOString(),
          location: payload.location,
          eventSlug: event.slug,
          eventTitle: event.title,
        } as Record<string, unknown>;

        const forward = await fetchWithTimeout(tallyEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tallyBody),
          timeoutMs: 15_000,
        });

        if (!forward.ok) {
          const forwardErr = await forward.text().catch(() => 'unknown');
          await updateRegistrationReservation(reservationRecord.id, {
            mirrorState: {
              tally: {
                enabled: true,
                status: 'failed',
                lastAttemptAt: new Date().toISOString(),
                error: `HTTP ${forward.status}: ${forwardErr}`,
              },
            },
            auditEntry: {
              at: new Date().toISOString(),
              event: 'tally_forward_failed',
              actor: 'tally',
              summary: 'Tally forward failed.',
              requestId,
              details: { status: forward.status, reason: forwardErr },
            },
          });
          await logServerError('event.tally_forward_failed', new Error(`Tally forward failed: ${forward.status} ${forwardErr}`), { eventSlug: event.slug, status: forward.status });
          return NextResponse.json({ error: 'Upstream processor error' }, { status: 502 });
        }

        tallySucceeded = true;
        await updateRegistrationReservation(reservationRecord.id, {
          mirrorState: {
            tally: {
              enabled: true,
              status: 'forwarded',
              lastAttemptAt: new Date().toISOString(),
              lastSuccessAt: new Date().toISOString(),
            },
          },
          auditEntry: {
            at: new Date().toISOString(),
            event: 'tally_forwarded',
            actor: 'tally',
            summary: 'Registration payload forwarded to Tally.',
            requestId,
          },
        });
      }

      // Mirror to Notion if configured
      if (saveAlsoToNotion && dbId && token) {
        await updateRegistrationReservation(reservationRecord.id, {
          auditEntry: {
            at: new Date().toISOString(),
            event: 'notion_mirror_attempted',
            actor: 'notion',
            summary: 'Attempting to mirror registration into Notion.',
            requestId,
          },
        });

        let result;
        try {
          result = await saveRegistrationToNotion(dbId, { ...payload, registrationId: reservationRecord.id });
        } catch (notionError) {
          await updateRegistrationReservation(reservationRecord.id, {
            mirrorState: {
              notion: {
                enabled: true,
                status: 'failed',
                lastAttemptAt: new Date().toISOString(),
                error: notionError instanceof Error ? notionError.message : String(notionError),
              },
            },
            auditEntry: {
              at: new Date().toISOString(),
              event: 'notion_mirror_failed',
              actor: 'notion',
              summary: 'Notion mirror failed.',
              requestId,
              details: { error: notionError instanceof Error ? notionError.message : String(notionError) },
            },
          });
          throw notionError;
        }

        registrationStored = true;
        await updateRegistrationReservation(reservationRecord.id, {
          status: 'confirmed',
          source: 'notion',
          externalId: (result as { id?: string }).id,
          mirrorState: {
            notion: {
              enabled: true,
              status: 'mirrored',
              lastAttemptAt: new Date().toISOString(),
              lastSuccessAt: new Date().toISOString(),
              externalId: (result as { id?: string }).id,
            },
          },
          auditEntries: [
            {
              at: new Date().toISOString(),
              event: 'notion_mirrored',
              actor: 'notion',
              summary: 'Registration mirrored into Notion.',
              requestId,
              details: { notionPageId: (result as { id?: string }).id },
            },
            {
              at: new Date().toISOString(),
              event: 'reservation_confirmed',
              actor: 'system',
              summary: 'Registration confirmed after successful Notion mirroring.',
              requestId,
            },
          ],
        });

        // Send success email
        const emailResult = await sendEmailWithTracking(
          reservationRecord.id,
          locale,
          payload.name,
          payload.email,
          event.title,
          event.titleEn || event.title,
          requestId
        );

        return NextResponse.json({ ok: true, id: (result as { id: string }).id, email: emailResult }, { status: 201 });
      }

      // If no Tally endpoint configured, simulate success
      if (!tallyEndpoint) {
        await new Promise((r) => setTimeout(r, 300));
        registrationStored = true;
        await updateRegistrationReservation(reservationRecord.id, {
          status: 'confirmed',
          source: 'simulated',
          auditEntry: {
            at: new Date().toISOString(),
            event: 'reservation_confirmed',
            actor: 'system',
            summary: 'Registration confirmed without external forwarding.',
            requestId,
          },
        });

        const emailResult = await sendEmailWithTracking(
          reservationRecord.id,
          locale,
          payload.name,
          payload.email,
          event.title,
          event.titleEn || event.title,
          requestId
        );

        return NextResponse.json({ ok: true, simulated: true, email: emailResult }, { status: 201 });
      }

      // Tally forward succeeded
      registrationStored = true;
      await updateRegistrationReservation(reservationRecord.id, {
        status: 'confirmed',
        source: 'tally',
        auditEntry: {
          at: new Date().toISOString(),
          event: 'reservation_confirmed',
          actor: 'system',
          summary: 'Registration confirmed after successful Tally forwarding.',
          requestId,
        },
      });

      const emailResult = await sendEmailWithTracking(
        reservationRecord.id,
        locale,
        payload.name,
        payload.email,
        event.title,
        event.titleEn || event.title,
        requestId
      );

      return NextResponse.json({ ok: true, forwarded: true, email: emailResult }, { status: 201 });
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
        tallySucceeded,
        registrationStored,
        url: req.url,
      });
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  });
}

async function sendEmailWithTracking(
  reservationId: string,
  locale: 'zh' | 'en',
  name: string,
  email: string,
  eventTitle: string,
  eventTitleEn: string,
  requestId?: string
) {
  let emailResult: Awaited<ReturnType<typeof sendRegistrationSuccessEmail>> = { status: 'skipped', reason: 'Email transport not attempted.' };

  try {
    await updateRegistrationReservation(reservationId, {
      auditEntry: {
        at: new Date().toISOString(),
        event: 'email_attempted',
        actor: 'email',
        summary: 'Attempting to send registration success email.',
        requestId,
      },
    });

    emailResult = await sendRegistrationSuccessEmail({
      locale,
      name,
      email,
      eventTitle,
      eventTitleEn,
    });

    await updateRegistrationReservation(reservationId, {
      mirrorState: {
        email: {
          enabled: true,
          status: emailResult.status === 'sent' ? 'forwarded' : 'skipped',
          lastAttemptAt: new Date().toISOString(),
          lastSuccessAt: emailResult.status === 'sent' ? new Date().toISOString() : undefined,
        },
      },
      auditEntry: {
        at: new Date().toISOString(),
        event: emailResult.status === 'sent' ? 'email_sent' : 'email_skipped',
        actor: 'email',
        summary: emailResult.status === 'sent' ? 'Registration success email sent.' : 'Registration success email skipped.',
        requestId,
        details: emailResult,
      },
    });
  } catch (emailError) {
    await updateRegistrationReservation(reservationId, {
      mirrorState: {
        email: {
          enabled: true,
          status: 'failed',
          lastAttemptAt: new Date().toISOString(),
          error: emailError instanceof Error ? emailError.message : String(emailError),
        },
      },
      auditEntry: {
        at: new Date().toISOString(),
        event: 'email_failed',
        actor: 'email',
        summary: 'Registration success email failed.',
        requestId,
        details: { error: emailError instanceof Error ? emailError.message : String(emailError) },
      },
    });
    await logServerError('event.registration_email_failed', emailError, { email, locale });
    emailResult = { status: 'skipped', reason: 'Registration succeeded but email delivery failed.' };
  }

  return emailResult;
}
