import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { readJsonFile, writeJsonFile } from '@/lib/json-store';
import type { RegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';

const originalSettings = readJsonFile<RegistrationSuccessEmailSettings>('data/registration-success-email.json');

describe('registration success email', () => {
  afterEach(() => {
    vi.resetModules();
    writeJsonFile('data/registration-success-email.json', originalSettings);
    delete process.env.EMAIL_OUTBOX_FILE;
    delete process.env.RESEND_API_KEY;
    delete process.env.REGISTRATION_EMAIL_FROM;
    delete process.env.REGISTRATION_EMAIL_REPLY_TO;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('renders the localized template tokens into a delivery-ready message', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3000';

    const { renderRegistrationSuccessEmailMessage } = await import('@/lib/registration-success-email');

    const rendered = await renderRegistrationSuccessEmailMessage(originalSettings, {
      locale: 'zh',
      name: '測試讀者',
      email: 'reader@example.com',
      eventTitle: '台灣讀書會',
      eventTitleEn: 'Taiwan Book Club',
    });

    expect(rendered.locale).toBe('zh');
    expect(rendered.subject).toContain('台灣讀書會');
    expect(rendered.text).toContain('reader@example.com');
    expect(rendered.text).toContain('測試讀者');
    expect(rendered.text).toContain('http://127.0.0.1:3000');
  });

  it('writes a sent record to the configured local outbox when enabled', async () => {
    process.env.EMAIL_OUTBOX_FILE = 'data/test-email-outbox.json';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://bookdigest.test';

    vi.doMock('@/lib/registration-success-email-config', () => ({
      getRegistrationSuccessEmailSettings: async () => ({
        ...originalSettings,
        enabled: true,
      }),
      REGISTRATION_SUCCESS_EMAIL_FILE: 'data/registration-success-email.json',
    }));

    const {
      clearEmailOutbox,
      getEmailOutboxRecords,
      sendRegistrationSuccessEmail,
    } = await import('@/lib/registration-success-email');

    clearEmailOutbox();

    const result = await sendRegistrationSuccessEmail({
      locale: 'en',
      name: 'Detox Adventurer',
      email: 'detox@example.com',
      eventTitle: '數位排毒營',
      eventTitleEn: 'Unplug Project',
    });

    expect(result).toEqual({ status: 'sent', transport: 'file' });
    const deliveries = getEmailOutboxRecords();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      to: 'detox@example.com',
      locale: 'en',
      transport: 'file',
    });
    expect(deliveries[0].subject).toContain('Unplug Project');
    expect(deliveries[0].text).toContain('https://bookdigest.test');
  });
});