import { NextRequest, NextResponse } from 'next/server';
import { saveRegistrationToNotion, type RegistrationInput } from '@/lib/notion';
import { rateLimit } from '@/lib/rate-limit';
import { cryptoRandomId } from '@/lib/crypto-id';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { sendRegistrationSuccessEmail } from '@/lib/registration-success-email';
import { getCapacityStatus, releaseCapacity, reserveCapacity, _resetCountForTesting, _setForceFullForTesting } from '@/lib/signup-capacity';
import { getRetryAfterSeconds } from '@/lib/http-response';
import { parseApiReferral } from '@/lib/signup';

type Location = 'TW' | 'NL' | 'EN' | 'DETOX';

function parseLocation(url: string): Location | null {
  const { searchParams } = new URL(url);
  const loc = (searchParams.get('loc') || '') as Location;
  if (loc !== 'TW' && loc !== 'NL' && loc !== 'EN' && loc !== 'DETOX') return null;
  return loc;
}

// GET /api/submit?loc=TW|NL|EN|DETOX
// Returns the current slot/capacity status for the requested location.
export async function GET(req: NextRequest) {
  const loc = parseLocation(req.url);
  if (!loc) {
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
  }

  const status = await getCapacityStatus(loc);
  return NextResponse.json({ ok: true, location: loc, ...status }, { status: 200, headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } });
}

// DELETE /api/submit?loc=TW|NL|EN|DETOX&tempMax=N
// Resets in-memory count and optionally sets a temporary max override.
// Only available outside production; used for automated testing.
export async function DELETE(req: NextRequest) {
  if (process.env.ALLOW_CAPACITY_RESET !== '1') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const loc = parseLocation(req.url);
  if (!loc) {
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const tempMaxRaw = searchParams.get('tempMax');
  const tempMax = tempMaxRaw !== null ? Number(tempMaxRaw) : undefined;
  const forceFullRaw = searchParams.get('forceFull');
  // Reset count first (also clears any prior forceFull override).
  _resetCountForTesting(loc, tempMax !== undefined && Number.isInteger(tempMax) && tempMax > 0 ? tempMax : undefined);
  // Apply forceFull override after reset so it isn't cleared.
  if (forceFullRaw !== null) {
    _setForceFullForTesting(loc, forceFullRaw === '1' || forceFullRaw.toLowerCase() === 'true');
  }
  return NextResponse.json({ ok: true, location: loc, reset: true }, { status: 200 });
}

// POST /api/submit?loc=TW|NL|EN|DETOX
export async function POST(req: NextRequest) {
  let reservedLoc: Location | null = null;
  let tallySucceeded = false;
  let registrationStored = false;
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

    const loc = parseLocation(req.url);
    if (!loc) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    }

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
    // Minimal validation mirror of client
    const payload: RegistrationInput = {
      location: loc,
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

    const reservation = await reserveCapacity(loc);
    if (!reservation.allowed) {
      return NextResponse.json(
        { error: reservation.reason === 'full' ? 'Registration full' : 'Registration closed', reason: reservation.reason },
        { status: 409 }
      );
    }
    reservedLoc = loc;
    // Use per-location endpoint if provided.
    const tallyTW = process.env.TALLY_ENDPOINT_TW;
    const tallyNL = process.env.TALLY_ENDPOINT_NL;
    const tallyEN = process.env.TALLY_ENDPOINT_EN;
    const tallyDetox = process.env.TALLY_ENDPOINT_DETOX;
    const tallyEndpoint = payload.location === 'TW'
      ? tallyTW
      : payload.location === 'NL'
        ? tallyNL
        : payload.location === 'EN'
          ? tallyEN
          : tallyDetox;

    if (tallyEndpoint) {
      // Map payload to the requested column names for Tally or generic webhook.
      const tallyBody = {
        // Preferred columns from user request
        Name: payload.name,
        Email: payload.email,
        Age: payload.age,
        Occupation: payload.profession,
        InstagramAccount: payload.instagram || '',
        FindingUs: payload.referral,
        findingUsOthers: payload.referral === 'Others' ? (payload.referralOther || '') : '',
        Purpose: '', // not captured in phase 1 form
        Attendance: '', // not captured in phase 1 form
        status: 'new',
        Owner: '',
        ID: cryptoRandomId(),
        Title: `${payload.name} — ${payload.location}`.trim(),
        visitorId: visitorId || '',
        bankAccount: payload.bankAccount || '',
        // Timestamps for convenience (Tally can also store submission time)
        'Created Date': payload.timestamp || new Date().toISOString(),
        'Updated Date': new Date().toISOString(),
        location: payload.location,
      } as Record<string, unknown>;

      const forward = await fetchWithTimeout(tallyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tallyBody),
        timeoutMs: 15_000,
      });
      if (!forward.ok) {
        const forwardErr = await forward.text().catch(() => 'unknown');
        console.error('[api/submit] Tally forward failed:', forward.status, forwardErr);
        await releaseCapacity(loc);
        return NextResponse.json({ error: 'Upstream processor error' }, { status: 502 });
      }
      tallySucceeded = true;
    }

    // 2) Optional Notion save (server-side) based on env flag
    const saveAlsoToNotion = process.env.SUBMIT_SAVE_TO_NOTION === '1';
    const dbId = process.env.NOTION_DB_ID;
    const token = process.env.NOTION_TOKEN;

    console.debug('[api/submit] routing', {
      loc,
      hasTallyEndpoint: Boolean(tallyEndpoint),
      saveAlsoToNotion,
      hasNotionDbId: Boolean(dbId),
      hasNotionToken: Boolean(token),
    });

    if (saveAlsoToNotion && dbId && token) {
      const result = await saveRegistrationToNotion(dbId, payload);
      registrationStored = true;

      let emailResult: Awaited<ReturnType<typeof sendRegistrationSuccessEmail>> = { status: 'skipped', reason: 'Email transport not attempted.' };
      try {
        emailResult = await sendRegistrationSuccessEmail({
          location: loc,
          locale,
          name: payload.name,
          email: payload.email,
        });
      } catch (emailError) {
        console.error('[api/submit] Registration success email failed', {
          error: emailError,
          message: emailError instanceof Error ? emailError.message : String(emailError),
          loc,
          email: payload.email,
          locale,
        });
        emailResult = { status: 'skipped', reason: 'Registration succeeded but email delivery failed.' };
      }

      return NextResponse.json({ ok: true, id: (result as { id: string }).id, email: emailResult }, { status: 201 });
    }

    // 3) If neither upstream nor Notion persistence is configured, simulate success
    if (!tallyEndpoint) {
      await new Promise((r) => setTimeout(r, 300));
      registrationStored = true;

      let emailResult: Awaited<ReturnType<typeof sendRegistrationSuccessEmail>> = { status: 'skipped', reason: 'Email transport not attempted.' };
      try {
        emailResult = await sendRegistrationSuccessEmail({
          location: loc,
          locale,
          name: payload.name,
          email: payload.email,
        });
      } catch (emailError) {
        console.error('[api/submit] Registration success email failed', {
          error: emailError,
          message: emailError instanceof Error ? emailError.message : String(emailError),
          loc,
          email: payload.email,
          locale,
        });
        emailResult = { status: 'skipped', reason: 'Registration succeeded but email delivery failed.' };
      }

      return NextResponse.json({ ok: true, simulated: true, email: emailResult }, { status: 201 });
    }

    // If Tally forward succeeded (and we didn't save to Notion), return success
    registrationStored = true;

    let emailResult: Awaited<ReturnType<typeof sendRegistrationSuccessEmail>> = { status: 'skipped', reason: 'Email transport not attempted.' };
    try {
      emailResult = await sendRegistrationSuccessEmail({
        location: loc,
        locale,
        name: payload.name,
        email: payload.email,
      });
    } catch (emailError) {
      console.error('[api/submit] Registration success email failed', {
        error: emailError,
        message: emailError instanceof Error ? emailError.message : String(emailError),
        loc,
        email: payload.email,
        locale,
      });
      emailResult = { status: 'skipped', reason: 'Registration succeeded but email delivery failed.' };
    }

    return NextResponse.json({ ok: true, forwarded: true, email: emailResult }, { status: 201 });
  } catch (err) {
    if (reservedLoc && !registrationStored && !tallySucceeded) {
      await releaseCapacity(reservedLoc);
    }
    console.error('[api/submit] Submit error', {
      error: err,
      reservedLoc,
      tallySucceeded,
      registrationStored,
      url: req.url,
    });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}


