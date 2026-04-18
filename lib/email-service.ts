import 'server-only';

import { Resend } from 'resend';
import { PAYMENT_CONFIRMATION_TEMPLATES, interpolatePaymentConfirmationTemplate } from '@/lib/payment-confirmation-email-config';
import { EMAIL_CONFIG, CLIENT_ENV } from '@/lib/env';
import { getSupabaseUrl, getSupabaseHeaders } from '@/lib/supabase-utils';

const RESEND_API_KEY = EMAIL_CONFIG.RESEND_API_KEY;
const FROM_EMAIL = EMAIL_CONFIG.FROM_EMAIL;
const SITE_URL = CLIENT_ENV.SITE_URL;

// Email Settings

export function isResendConfigured(): boolean {
  return !!RESEND_API_KEY;
}

export type EmailSettings = {
  reservationConfirmationEnabled: boolean;
  resendConfigured: boolean;
};

export async function getEmailSettings(): Promise<EmailSettings> {
  const response = await fetch(
    `${getSupabaseUrl()}/rest/v1/settings?select=value&key=eq.email.reservation_confirmation_enabled&limit=1`,
    {
      method: 'GET',
      headers: getSupabaseHeaders(),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return {
      reservationConfirmationEnabled: false,
      resendConfigured: isResendConfigured(),
    };
  }

  const rows = await response.json() as Array<{ value: string }>;
  return {
    reservationConfirmationEnabled: rows[0]?.value === 'true',
    resendConfigured: isResendConfigured(),
  };
}

export async function updateEmailSettings(settings: { reservationConfirmationEnabled: boolean }): Promise<void> {
  const response = await fetch(
    `${getSupabaseUrl()}/rest/v1/settings?key=eq.email.reservation_confirmation_enabled`,
    {
      method: 'PATCH',
      headers: getSupabaseHeaders(),
      body: JSON.stringify({
        value: String(settings.reservationConfirmationEnabled),
        updated_at: new Date().toISOString(),
      }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Failed to update email settings: ${response.status} ${reason}`);
  }
}

// Email Audit

export type EmailAuditEntry = {
  recipientEmail: string;
  emailType: 'reservation_confirmation' | 'payment_confirmation' | 'test';
  status: 'sent' | 'failed' | 'skipped';
  registrationId?: string;
  eventId?: number;
  locale: string;
  subject: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export async function logEmailAudit(entry: EmailAuditEntry): Promise<void> {
  const response = await fetch(`${getSupabaseUrl()}/rest/v1/email_audit`, {
    method: 'POST',
    headers: getSupabaseHeaders(),
    body: JSON.stringify({
      recipient_email: entry.recipientEmail,
      email_type: entry.emailType,
      status: entry.status,
      registration_id: entry.registrationId,
      event_id: entry.eventId,
      locale: entry.locale,
      subject: entry.subject,
      error_message: entry.errorMessage,
      metadata: entry.metadata,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    console.error(`Failed to log email audit: ${response.status} ${reason}`);
  }
}

// Email Sending

type SendEmailResult = {
  status: 'sent' | 'failed' | 'skipped';
  reason?: string;
  emailId?: string;
};

async function sendEmailViaResend(to: string, subject: string, body: string): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    return { status: 'skipped', reason: 'Resend API key not configured' };
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      text: body,
    });

    if (result.error) {
      return { status: 'failed', reason: result.error.message };
    }

    return { status: 'sent', emailId: result.data?.id };
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

// Payment Confirmation Email

export type SendPaymentConfirmationEmailInput = {
  locale: 'zh' | 'en';
  name: string;
  email: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  registrationId: string;
  eventId: number;
};

export async function sendPaymentConfirmationEmail(
  input: SendPaymentConfirmationEmailInput
): Promise<SendEmailResult> {
  const template = PAYMENT_CONFIRMATION_TEMPLATES[input.locale];
  const { subject, body } = interpolatePaymentConfirmationTemplate(template, {
    name: input.name,
    eventTitle: input.eventTitle,
    eventDate: input.eventDate,
    eventTime: input.eventTime,
    eventLocation: input.eventLocation,
    siteUrl: SITE_URL,
  });

  const result = await sendEmailViaResend(input.email, subject, body);

  await logEmailAudit({
    recipientEmail: input.email,
    emailType: 'payment_confirmation',
    status: result.status,
    registrationId: input.registrationId,
    eventId: input.eventId,
    locale: input.locale,
    subject,
    errorMessage: result.reason,
    metadata: { emailId: result.emailId },
  });

  return result;
}

// Test Email

export type SendTestEmailInput = {
  recipientEmail: string;
  emailType: 'reservation_confirmation' | 'payment_confirmation';
};

export async function sendTestEmail(input: SendTestEmailInput): Promise<SendEmailResult> {
  const locale = 'en';
  const testContext = {
    name: 'Test User',
    eventTitle: 'Sample Book Club Event',
    eventDate: '2026-05-01',
    eventTime: '19:00',
    eventLocation: 'Book Digest Space',
    paymentAmount: '200',
    paymentCurrency: 'TWD',
    paymentInstructions: 'Test payment instructions',
    siteUrl: SITE_URL,
  };

  let subject: string;
  let body: string;

  if (input.emailType === 'payment_confirmation') {
    const template = PAYMENT_CONFIRMATION_TEMPLATES[locale];
    const interpolated = interpolatePaymentConfirmationTemplate(template, testContext);
    subject = interpolated.subject;
    body = interpolated.body;
  } else {
    // For reservation_confirmation, we'll add this after updating registration-success-email-config.ts
    subject = 'Test Reservation Confirmation Email';
    body = 'This is a test email. Full template will be implemented with reservation email updates.';
  }

  const result = await sendEmailViaResend(input.recipientEmail, subject, body);

  await logEmailAudit({
    recipientEmail: input.recipientEmail,
    emailType: 'test',
    status: result.status,
    locale,
    subject,
    errorMessage: result.reason,
    metadata: { emailId: result.emailId, testType: input.emailType },
  });

  return result;
}
