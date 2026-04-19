import 'server-only';

import { createEmailProvider, type IEmailProvider } from '@/lib/email-providers';
import { EMAIL_CONFIG, CLIENT_ENV } from '@/lib/env';
import { getSupabaseUrl, getSupabaseHeaders } from '@/lib/supabase-utils';
import { PAYMENT_CONFIRMATION_TEMPLATES, interpolatePaymentConfirmationTemplate } from '@/lib/payment-confirmation-email-config';
import { getRegistrationSuccessEmailSettings, type RegistrationEmailLocale } from '@/lib/registration-success-email-config';

// ============================================================================
// Email Provider
// ============================================================================

let cachedProvider: IEmailProvider | null = null;

function getEmailProvider(): IEmailProvider {
  if (!cachedProvider) {
    cachedProvider = createEmailProvider({
      resend: EMAIL_CONFIG.RESEND_API_KEY && EMAIL_CONFIG.REGISTRATION_EMAIL_FROM
        ? {
            apiKey: EMAIL_CONFIG.RESEND_API_KEY,
            fromEmail: EMAIL_CONFIG.REGISTRATION_EMAIL_FROM,
          }
        : undefined,
      gmail: EMAIL_CONFIG.GMAIL_USER && EMAIL_CONFIG.GMAIL_PASSWORD
        ? {
            user: EMAIL_CONFIG.GMAIL_USER,
            password: EMAIL_CONFIG.GMAIL_PASSWORD,
          }
        : undefined,
    });
  }
  return cachedProvider;
}

export function isEmailConfigured(): boolean {
  try {
    const provider = getEmailProvider();
    return provider.isConfigured();
  } catch {
    return false;
  }
}

export function getEmailProviderName(): string {
  try {
    const provider = getEmailProvider();
    return provider.getProviderName();
  } catch {
    return 'none';
  }
}

// ============================================================================
// Email Settings
// ============================================================================

export type EmailSettings = {
  reservationConfirmationEnabled: boolean;
  emailConfigured: boolean;
  providerName: string;
  resendConfigured: boolean;
  gmailConfigured: boolean;
  activeProvider: 'resend' | 'gmail' | 'none';
};

function isResendConfigured(): boolean {
  return !!(EMAIL_CONFIG.RESEND_API_KEY && EMAIL_CONFIG.REGISTRATION_EMAIL_FROM);
}

function isGmailConfigured(): boolean {
  return !!(EMAIL_CONFIG.GMAIL_USER && EMAIL_CONFIG.GMAIL_PASSWORD);
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const response = await fetch(
    `${getSupabaseUrl()}/rest/v1/settings?select=value&key=eq.email.reservation_confirmation_enabled&limit=1`,
    {
      method: 'GET',
      headers: getSupabaseHeaders(),
      cache: 'no-store',
    }
  );

  const resendConfigured = isResendConfigured();
  const gmailConfigured = isGmailConfigured();
  const providerName = getEmailProviderName();

  if (!response.ok) {
    return {
      reservationConfirmationEnabled: false,
      emailConfigured: isEmailConfigured(),
      providerName,
      resendConfigured,
      gmailConfigured,
      activeProvider: providerName === 'resend' ? 'resend' : providerName === 'gmail' ? 'gmail' : 'none',
    };
  }

  const rows = await response.json() as Array<{ value: string }>;
  return {
    reservationConfirmationEnabled: rows[0]?.value === 'true',
    emailConfigured: isEmailConfigured(),
    providerName,
    resendConfigured,
    gmailConfigured,
    activeProvider: providerName === 'resend' ? 'resend' : providerName === 'gmail' ? 'gmail' : 'none',
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

// ============================================================================
// Email Audit
// ============================================================================

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

// ============================================================================
// Email Sending Core
// ============================================================================

type SendEmailResult = {
  status: 'sent' | 'failed' | 'skipped';
  reason?: string;
  emailId?: string;
};

async function sendEmail(to: string, subject: string, body: string, replyTo?: string): Promise<SendEmailResult> {
  try {
    const provider = getEmailProvider();

    if (!provider.isConfigured()) {
      return { status: 'skipped', reason: 'Email provider not configured' };
    }

    const result = await provider.sendEmail({
      to,
      subject,
      text: body,
      replyTo,
    });

    if (!result.success) {
      return { status: 'failed', reason: result.error };
    }

    return { status: 'sent', emailId: result.emailId };
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Template Helpers
// ============================================================================

function getSiteUrl(): string {
  return CLIENT_ENV.SITE_URL;
}

function interpolateTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => context[key] || '');
}

function normalizeLocale(locale?: string): RegistrationEmailLocale {
  return locale === 'zh' ? 'zh' : 'en';
}

// ============================================================================
// Registration Success Email
// ============================================================================

export type SendRegistrationSuccessEmailInput = {
  locale: RegistrationEmailLocale;
  name: string;
  email: string;
  eventTitle: string;
  eventTitleEn: string;
  registrationId?: string;
  eventId?: number;
};

export async function sendRegistrationSuccessEmail(input: SendRegistrationSuccessEmailInput): Promise<SendEmailResult> {
  const settings = await getRegistrationSuccessEmailSettings();
  if (!settings.enabled) {
    return { status: 'skipped', reason: 'Registration success emails are disabled.' };
  }

  const locale = normalizeLocale(input.locale);
  const template = settings.templates[locale];
  const eventTitle = locale === 'en' ? input.eventTitleEn : input.eventTitle;

  const context = {
    name: input.name,
    email: input.email,
    eventTitle,
    siteUrl: getSiteUrl(),
  };

  const subject = interpolateTemplate(template.subject, context);
  const body = interpolateTemplate(template.body, context);
  const replyTo = EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO || undefined;

  const result = await sendEmail(input.email, subject, body, replyTo);

  await logEmailAudit({
    recipientEmail: input.email,
    emailType: 'reservation_confirmation',
    status: result.status,
    registrationId: input.registrationId,
    eventId: input.eventId,
    locale,
    subject,
    errorMessage: result.reason,
    metadata: { emailId: result.emailId, provider: getEmailProviderName() },
  });

  return result;
}

// ============================================================================
// Payment Confirmation Email
// ============================================================================

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
    siteUrl: getSiteUrl(),
  });

  const replyTo = EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO || undefined;
  const result = await sendEmail(input.email, subject, body, replyTo);

  await logEmailAudit({
    recipientEmail: input.email,
    emailType: 'payment_confirmation',
    status: result.status,
    registrationId: input.registrationId,
    eventId: input.eventId,
    locale: input.locale,
    subject,
    errorMessage: result.reason,
    metadata: { emailId: result.emailId, provider: getEmailProviderName() },
  });

  return result;
}
