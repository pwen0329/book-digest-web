import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { saveRegistrationToNotion, type RegistrationInput } from '@/lib/notion';

// POST /api/submit?loc=TW|NL
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const loc = (searchParams.get('loc') || '') as 'TW' | 'NL';
    if (loc !== 'TW' && loc !== 'NL') {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
    }

    const body = await req.json();
    const hdrs = headers();
    const visitorId = hdrs.get('x-visitor-id') || null; // Optional: client may send an anonymous visitor id

    // Backward-compat: accept either { name } or { firstName, lastName }
    const rawName = String(body.name || '').trim();
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const name = rawName || `${firstName} ${lastName}`.trim();

    // Minimal validation mirror of client
    const payload: RegistrationInput = {
      location: loc,
      name,
      age: Number(body.age),
      profession: String(body.profession || '').trim(),
      email: String(body.email || '').trim(),
      instagram: body.instagram ? String(body.instagram) : undefined,
      referral: body.referral as RegistrationInput['referral'],
      referralOther: body.referralOther ? String(body.referralOther) : undefined,
      bankAccount: typeof body.bankAccount === 'string' ? String(body.bankAccount).trim() : undefined,
      timestamp: body.timestamp,
      visitorId: visitorId || undefined,
    };

    // Basic guards
    if (!payload.name || !payload.email || !payload.profession || !Number.isInteger(payload.age)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (!['Instagram', 'Facebook', 'Others'].includes(payload.referral)) {
      return NextResponse.json({ error: 'Invalid referral' }, { status: 400 });
    }
    if (payload.referral === 'Others' && (!payload.referralOther || payload.referralOther.trim().length < 2)) {
      return NextResponse.json({ error: 'Invalid referralOther' }, { status: 400 });
    }

    // 1) Optional Tally forward. Use per-location endpoint if provided.
    const tallyTW = process.env.TALLY_ENDPOINT_TW;
    const tallyNL = process.env.TALLY_ENDPOINT_NL;
    const tallyEndpoint = payload.location === 'TW' ? tallyTW : tallyNL;

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

      const forward = await fetch(tallyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tallyBody),
      });
      if (!forward.ok) {
        // Do not expose upstream body; return a generic error
        return NextResponse.json({ error: 'Upstream processor error' }, { status: 502 });
      }
    }

    // 2) Optional Notion save (server-side) based on env flag
    const saveAlsoToNotion = process.env.SUBMIT_SAVE_TO_NOTION === '1';
    const dbId = process.env.NOTION_DB_ID;
    const token = process.env.NOTION_TOKEN;

    console.info('[api/submit] routing', {
      loc,
      hasTallyEndpoint: Boolean(tallyEndpoint),
      saveAlsoToNotion,
      hasNotionDbId: Boolean(dbId),
      hasNotionToken: Boolean(token),
    });

    if (saveAlsoToNotion && dbId && token) {
      const result = await saveRegistrationToNotion(dbId, payload);
      return NextResponse.json({ ok: true, id: (result as { id: string }).id }, { status: 201 });
    }

    // 3) If neither upstream nor Notion persistence is configured, simulate success
    if (!tallyEndpoint) {
      await new Promise((r) => setTimeout(r, 300));
      return NextResponse.json({ ok: true, simulated: true }, { status: 201 });
    }

    // If Tally forward succeeded (and we didn't save to Notion), return success
    return NextResponse.json({ ok: true, forwarded: true }, { status: 201 });
  } catch (err) {
    console.error('Submit error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function cryptoRandomId(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') {
    return g.crypto.randomUUID!();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
