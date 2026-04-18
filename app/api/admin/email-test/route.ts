import { NextRequest, NextResponse } from 'next/server';
import { runWithRequestTrace } from '@/lib/observability';
import { sendTestEmail } from '@/lib/email-service';

// POST /api/admin/email-test
export async function POST(req: NextRequest) {
  return runWithRequestTrace(req, 'admin.email_test', async () => {
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

    // Validate recipientEmail
    const recipientEmail = typeof body.recipientEmail === 'string' ? body.recipientEmail.trim() : '';
    if (!recipientEmail) {
      return NextResponse.json({ error: 'recipientEmail is required' }, { status: 400 });
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate emailType
    const emailType = body.emailType === 'payment_confirmation' ? 'payment_confirmation' : 'reservation_confirmation';

    // Send test email
    try {
      const result = await sendTestEmail({
        recipientEmail,
        emailType,
      });

      if (result.status === 'sent') {
        return NextResponse.json({
          ok: true,
          message: `Test email sent to ${recipientEmail}`,
        });
      }

      if (result.status === 'skipped') {
        return NextResponse.json({
          ok: false,
          message: result.reason || 'Email skipped',
        }, { status: 503 });
      }

      return NextResponse.json({
        ok: false,
        message: result.reason || 'Failed to send email',
      }, { status: 500 });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 });
    }
  });
}
