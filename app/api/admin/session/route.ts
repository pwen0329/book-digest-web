import { NextRequest, NextResponse } from 'next/server';
import { clearAdminSession, createAdminSession, isAdminAuthenticated, isAdminConfigured, validateAdminPassword } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

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

  let payload: { password?: string };

  try {
    payload = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!payload.password || !validateAdminPassword(payload.password)) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  await createAdminSession();
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ ok: true }, { status: 200 });
}