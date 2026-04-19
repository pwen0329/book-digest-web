import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { readJsonFile, writeJsonFile } from '@/lib/json-store';
import type { RegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';

const originalSettings = readJsonFile<RegistrationSuccessEmailSettings>('data/registration-success-email.json');

describe('registration success email', () => {
  afterEach(() => {
    vi.resetModules();
    writeJsonFile('data/registration-success-email.json', originalSettings);
    delete process.env.RESEND_API_KEY;
    delete process.env.REGISTRATION_EMAIL_FROM;
    delete process.env.REGISTRATION_EMAIL_REPLY_TO;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('renders the localized zh template with correct context', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3000';

    const { getRegistrationSuccessEmailSettings } = await import('@/lib/registration-success-email-config');
    const settings = await getRegistrationSuccessEmailSettings();
    const template = settings.templates.zh;

    const context = {
      name: '測試讀者',
      eventTitle: '台灣讀書會',
      paymentAmount: '',
      paymentCurrency: '',
      paymentInstructions: '',
      siteUrl: 'http://127.0.0.1:3000',
    };

    const subject = template.subject.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => context[key as keyof typeof context] || '');
    const body = template.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => context[key as keyof typeof context] || '');

    expect(subject).toContain('台灣讀書會');
    expect(body).toContain('測試讀者');
    expect(body).toContain('http://127.0.0.1:3000');
  });

  it('renders the localized en template with correct context', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://bookdigest.test';

    const { getRegistrationSuccessEmailSettings } = await import('@/lib/registration-success-email-config');
    const settings = await getRegistrationSuccessEmailSettings();
    const template = settings.templates.en;

    const context = {
      name: 'Detox Adventurer',
      eventTitle: 'Unplug Project',
      paymentAmount: '',
      paymentCurrency: '',
      paymentInstructions: '',
      siteUrl: 'https://bookdigest.test',
    };

    const subject = template.subject.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => context[key as keyof typeof context] || '');
    const body = template.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => context[key as keyof typeof context] || '');

    expect(subject).toContain('Unplug Project');
    expect(body).toContain('Detox Adventurer');
    expect(body).toContain('https://bookdigest.test');
  });
});
