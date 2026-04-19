import { describe, expect, it } from 'vitest';

describe('registration success email', () => {
  it('renders the localized zh template with correct context', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3000';

    const { getRegistrationSuccessEmailTemplates } = await import('@/lib/email-templates');
    const templateConfig = await getRegistrationSuccessEmailTemplates();
    const template = templateConfig.templates.zh;

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

    const { getRegistrationSuccessEmailTemplates } = await import('@/lib/email-templates');
    const templateConfig = await getRegistrationSuccessEmailTemplates();
    const template = templateConfig.templates.en;

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
