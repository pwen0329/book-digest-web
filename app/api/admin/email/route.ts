import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { runWithRequestTrace } from '@/lib/observability';
import { getRegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.email.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getRegistrationSuccessEmailSettings();

    const response = {
      settings,
      updatedAt: null, // Hardcoded settings, no version tracking
    };

    return NextResponse.json(response, { status: 200 });
  });
}

