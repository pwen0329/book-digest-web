import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { runWithRequestTrace } from '@/lib/observability';
import { getRegistrationSuccessEmailTemplates, getPaymentConfirmationEmailTemplates } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'admin.email.get', async () => {
    if (!(await isAuthorizedAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [registrationTemplates, paymentTemplates] = await Promise.all([
      getRegistrationSuccessEmailTemplates(),
      getPaymentConfirmationEmailTemplates(),
    ]);

    const response = {
      registration: registrationTemplates,
      payment: paymentTemplates,
      updatedAt: null, // Hardcoded templates, no version tracking
    };

    return NextResponse.json(response, { status: 200 });
  });
}