import 'server-only';
import { EMAIL_CONFIG } from '@/lib/env';

export type EmailLocale = 'zh' | 'en';

export type EmailTemplate = {
  subject: string;
  body: string;
};

// ============================================================================
// Registration Success Email Templates
// ============================================================================

export type RegistrationSuccessEmailTemplates = {
  templates: Record<EmailLocale, EmailTemplate>;
};

const REGISTRATION_SUCCESS_TEMPLATES_DATA: Record<EmailLocale, EmailTemplate> = {
  zh: {
    subject: 'Book Digest 報名成功｜{{eventTitle}}',
    body: `嗨 {{name}}，

感謝您報名參加 Book Digest 活動！

我們已收到您的報名，目前正在審核您的付款資訊。

活動詳情：
• 活動：{{eventTitle}}
• 付款金額：{{paymentAmount}} {{paymentCurrency}}
• 匯款帳號末五碼：{{bankLast5}}

一旦確認付款，我們將發送確認郵件給您。

如有任何問題，請隨時與我們聯繫：${EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO}`,
  },
  en: {
    subject: 'Book Digest Registration Received | {{eventTitle}}',
    body: `Hi {{name}},

Thank you for registering for Book Digest event!

We have received your registration and are currently reviewing your payment information.

Event Details:
• Event: {{eventTitle}}
• Payment Amount: {{paymentAmount}} {{paymentCurrency}}
• Bank Account Last 5 Digits: {{bankLast5}}

Once payment is confirmed, we will send you a confirmation email.

If you have any questions, please feel free to contact us at ${EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO}`,
  },
};

// TODO: Replace with database-backed configuration per event
export async function getRegistrationSuccessEmailTemplates(): Promise<RegistrationSuccessEmailTemplates> {
  return {
    templates: REGISTRATION_SUCCESS_TEMPLATES_DATA,
  };
}

// ============================================================================
// Payment Confirmation Email Templates
// ============================================================================

export type PaymentConfirmationEmailTemplates = {
  templates: Record<EmailLocale, EmailTemplate>;
};

const PAYMENT_CONFIRMATION_TEMPLATES_DATA: Record<EmailLocale, EmailTemplate> = {
  zh: {
    subject: 'Book Digest 付款確認｜{{eventTitle}}',
    body: `嗨 {{name}}，

感謝您的付款！您的報名已確認。

活動詳情：
• 活動：{{eventTitle}}
• 日期：{{eventDate}}
• 地點：{{eventLocation}}

我們期待在活動中見到您！

如有任何問題，請隨時與我們聯繫：${EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO}`,
  },
  en: {
    subject: 'Book Digest Payment Confirmed | {{eventTitle}}',
    body: `Hi {{name}},

Thank you for your payment! Your registration is now confirmed.

Event Details:
• Event: {{eventTitle}}
• Date: {{eventDate}}
• Location: {{eventLocation}}

We look forward to seeing you at the event!

If you have any questions, please feel free to contact us at ${EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO}`,
  },
};

// TODO: Replace with database-backed configuration per event
export async function getPaymentConfirmationEmailTemplates(): Promise<PaymentConfirmationEmailTemplates> {
  return {
    templates: PAYMENT_CONFIRMATION_TEMPLATES_DATA,
  };
}

// ============================================================================
// Final Confirmation Email Templates
// ============================================================================

export function getFinalConfirmationEmailTemplates(): Record<EmailLocale, EmailTemplate> {
  return {
    zh: {
      subject: 'Book Digest 活動最終確認｜{{eventTitle}}',
      body: `嗨 {{name}}，

您報名的 Book Digest 活動即將舉行！

活動詳情：
• 活動：{{eventTitle}}
• 日期：{{eventDate}}
• 地點：{{eventLocation}}

請準時參加，我們期待在活動中見到您！

如有任何問題，請隨時與我們聯繫：${EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO}`,
    },
    en: {
      subject: 'Book Digest Event Final Confirmation | {{eventTitle}}',
      body: `Hi {{name}},

Your Book Digest event is coming up soon!

Event Details:
• Event: {{eventTitle}}
• Date: {{eventDate}}
• Location: {{eventLocation}}

Please arrive on time. We look forward to seeing you at the event!

If you have any questions, please feel free to contact us at ${EMAIL_CONFIG.REGISTRATION_EMAIL_REPLY_TO}`,
    },
  };
}

// ============================================================================
// Template Interpolation Helpers
// ============================================================================

import { interpolateTemplate, type TemplateContext } from './template-interpolation';

// Re-export for backward compatibility
export type { TemplateContext };
export { interpolateTemplate };

export function interpolateEmailTemplate(
  template: EmailTemplate,
  context: TemplateContext
): { subject: string; body: string } {
  return {
    subject: interpolateTemplate(template.subject, context),
    body: interpolateTemplate(template.body, context),
  };
}
