import 'server-only';

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveWorkspacePath } from '@/lib/json-store';
import {
  getRegistrationSuccessEmailSettings,
  type RegistrationEmailLocale,
  type RegistrationSuccessEmailSettings,
} from '@/lib/registration-success-email-config';
type SendRegistrationSuccessEmailInput = {
  locale: RegistrationEmailLocale;
  name: string;
  email: string;
  eventTitle: string;
  eventTitleEn: string;
};

type EmailDeliveryRecord = {
  to: string;
  subject: string;
  text: string;
  locale: RegistrationEmailLocale;
  transport: 'resend' | 'file';
  createdAt: string;
};

type SendEmailResult =
  | { status: 'disabled' | 'skipped'; reason: string }
  | { status: 'sent'; transport: 'resend' | 'file' };

type TemplateContext = {
  name: string;
  email: string;
  eventTitle: string;
  siteUrl: string;
};

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
}

function interpolateTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{\s*(name|email|eventTitle|siteUrl)\s*\}\}/g, (_, key: keyof TemplateContext) => context[key]);
}

function normalizeLocale(locale?: string): RegistrationEmailLocale {
  return locale === 'zh' ? 'zh' : 'en';
}

async function renderMessage(
  settings: RegistrationSuccessEmailSettings,
  input: SendRegistrationSuccessEmailInput
): Promise<{ subject: string; text: string; locale: RegistrationEmailLocale }> {
  const locale = normalizeLocale(input.locale);
  const template = settings.templates[locale];

  // Choose title based on locale
  const eventTitle = locale === 'en' ? input.eventTitleEn : input.eventTitle;

  const context: TemplateContext = {
    name: input.name,
    email: input.email,
    eventTitle,
    siteUrl: getSiteUrl(),
  };

  return {
    locale,
    subject: interpolateTemplate(template.subject, context),
    text: interpolateTemplate(template.body, context),
  };
}

export function renderRegistrationSuccessEmailMessage(
  settings: RegistrationSuccessEmailSettings,
  input: SendRegistrationSuccessEmailInput
) {
  return renderMessage(settings, input);
}

function getOutboxPath(): string | null {
  const configuredPath = process.env.EMAIL_OUTBOX_FILE;
  if (!configuredPath) {
    return null;
  }

  return path.isAbsolute(configuredPath) ? configuredPath : resolveWorkspacePath(configuredPath);
}

function readOutboxRecords(filePath: string): EmailDeliveryRecord[] {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as EmailDeliveryRecord[];
  } catch {
    return [];
  }
}

function writeOutboxRecord(record: EmailDeliveryRecord): void {
  const outboxPath = getOutboxPath();
  if (!outboxPath) {
    throw new Error('EMAIL_OUTBOX_FILE is not configured.');
  }

  mkdirSync(path.dirname(outboxPath), { recursive: true });
  const records = readOutboxRecords(outboxPath);
  records.push(record);
  writeFileSync(outboxPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

export function getEmailOutboxRecords(): EmailDeliveryRecord[] {
  const outboxPath = getOutboxPath();
  if (!outboxPath) {
    return [];
  }

  return readOutboxRecords(outboxPath);
}

export function clearEmailOutbox(): void {
  const outboxPath = getOutboxPath();
  if (!outboxPath) {
    return;
  }

  rmSync(outboxPath, { force: true });
}

async function sendWithResend(payload: { to: string; subject: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REGISTRATION_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY or REGISTRATION_EMAIL_FROM is not configured.');
  }

  const replyTo = process.env.REGISTRATION_EMAIL_REPLY_TO;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      reply_to: replyTo || undefined,
    }),
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Resend email failed: ${response.status} ${reason}`);
  }
}

export async function sendRegistrationSuccessEmail(input: SendRegistrationSuccessEmailInput): Promise<SendEmailResult> {
  const settings = await getRegistrationSuccessEmailSettings();
  if (!settings.enabled) {
    return { status: 'disabled', reason: 'Registration success emails are disabled.' };
  }

  const message = await renderMessage(settings, input);
  const outboxPath = getOutboxPath();

  if (outboxPath) {
    writeOutboxRecord({
      to: input.email,
      subject: message.subject,
      text: message.text,
      locale: message.locale,
      transport: 'file',
      createdAt: new Date().toISOString(),
    });
    return { status: 'sent', transport: 'file' };
  }

  if (!process.env.RESEND_API_KEY || !process.env.REGISTRATION_EMAIL_FROM) {
    return { status: 'skipped', reason: 'No email transport is configured.' };
  }

  try {
    await sendWithResend({
      to: input.email,
      subject: message.subject,
      text: message.text,
    });
  } catch (error) {
    console.error('[registration-success-email] Resend delivery failed', {
      error,
      to: input.email,
      locale: message.locale,
      subject: message.subject,
    });
    throw error;
  }

  return { status: 'sent', transport: 'resend' };
}