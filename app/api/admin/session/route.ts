import { NextRequest, NextResponse } from 'next/server';
import { clearAdminSession, createAdminSession, isAdminAuthenticated, isAdminConfigured, validateAdminPassword } from '@/lib/admin-auth';
import { JsonRequestError, parseJsonRequest } from '@/lib/request-json';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const sessionSchema = z.object({
  password: z.string().min(1),
});

export async function GET() {
  if (!isAdminConfigured()) {
    return NextResponse.json({ authenticated: false, configured: false }, { status: 200 });
  }

  return NextResponse.json({ authenticated: await isAdminAuthenticated(), configured: true }, { status: 200 });
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'Admin is not configured.' }, { status: 503 });
  }

  let payload: z.infer<typeof sessionSchema>;

  try {
    payload = await parseJsonRequest(request, sessionSchema, { maxBytes: 10_000 });
  } catch (error) {
    if (error instanceof JsonRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!validateAdminPassword(payload.password)) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ ok: true }, { status: 200 });
}