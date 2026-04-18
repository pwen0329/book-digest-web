import { NextRequest, NextResponse } from 'next/server';
import { runWithRequestTrace } from '@/lib/observability';
import { getEmailSettings, updateEmailSettings } from '@/lib/email-service';

// GET /api/admin/settings/email
export async function GET(req: NextRequest) {
  return runWithRequestTrace(req, 'admin.settings.email.get', async () => {
    // Check admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || token !== adminPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get email settings
    try {
      const settings = await getEmailSettings();
      return NextResponse.json({
        ok: true,
        settings,
      });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  });
}

// PUT /api/admin/settings/email
export async function PUT(req: NextRequest) {
  return runWithRequestTrace(req, 'admin.settings.email.put', async () => {
    // Check admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || token !== adminPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Validate reservationConfirmationEnabled
    if (typeof body.reservationConfirmationEnabled !== 'boolean') {
      return NextResponse.json({
        error: 'reservationConfirmationEnabled must be a boolean',
      }, { status: 400 });
    }

    // Update email settings
    try {
      await updateEmailSettings({
        reservationConfirmationEnabled: body.reservationConfirmationEnabled,
      });
      return NextResponse.json({
        ok: true,
        message: 'Email settings updated successfully',
      });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  });
}
