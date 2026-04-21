import { NextResponse } from 'next/server';
import { EMAIL_CONFIG, CLIENT_ENV } from '@/lib/env';

export const dynamic = 'force-dynamic';

// GET /api/email-config - Get public email configuration
export async function GET() {
  return NextResponse.json({
    replyTo: EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO || '',
    siteUrl: CLIENT_ENV.SITE_URL,
  });
}
