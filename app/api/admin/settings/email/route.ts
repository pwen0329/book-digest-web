import { NextRequest, NextResponse } from 'next/server';
import { runWithRequestTrace } from '@/lib/observability';
import { getEmailSettings, updateEmailSettings } from '@/lib/unified-email-service';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';

// GET /api/admin/settings/email
export async function GET(req: NextRequest) {
  return runWithRequestTrace(req, 'admin.settings.email.get', async () => {
    // Check admin authentication (supports both Bearer token and cookies)
    if (!(await isAuthorizedAdminRequest(req))) {
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
    // Check admin authentication (supports both Bearer token and cookies)
    if (!(await isAuthorizedAdminRequest(req))) {
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
