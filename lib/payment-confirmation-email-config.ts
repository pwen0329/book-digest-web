import 'server-only';

export type PaymentConfirmationEmailTemplate = {
  subject: string;
  body: string;
};

export type PaymentConfirmationEmailTemplates = {
  zh: PaymentConfirmationEmailTemplate;
  en: PaymentConfirmationEmailTemplate;
};

export const PAYMENT_CONFIRMATION_TEMPLATES: PaymentConfirmationEmailTemplates = {
  zh: {
    subject: 'Book Digest 付款確認｜{{eventTitle}}',
    body: `嗨 {{name}}，

感謝您的付款！您的報名已確認。

活動詳情：
• 活動：{{eventTitle}}
• 日期：{{eventDate}}
• 時間：{{eventTime}}
• 地點：{{eventLocation}}

我們期待在活動中見到您！

如有任何問題，請隨時與我們聯繫。

Book Digest 團隊
{{siteUrl}}`,
  },
  en: {
    subject: 'Book Digest Payment Confirmed | {{eventTitle}}',
    body: `Hi {{name}},

Thank you for your payment! Your registration is now confirmed.

Event Details:
• Event: {{eventTitle}}
• Date: {{eventDate}}
• Time: {{eventTime}}
• Location: {{eventLocation}}

We look forward to seeing you at the event!

If you have any questions, please feel free to contact us.

Book Digest Team
{{siteUrl}}`,
  },
};

type TemplateContext = Record<string, string | number | undefined | null>;

export function interpolatePaymentConfirmationTemplate(
  template: PaymentConfirmationEmailTemplate,
  context: TemplateContext
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  for (const [key, value] of Object.entries(context)) {
    const placeholder = `{{${key}}}`;
    const replacement = value != null ? String(value) : '';
    subject = subject.replace(new RegExp(placeholder, 'g'), replacement);
    body = body.replace(new RegExp(placeholder, 'g'), replacement);
  }

  return { subject, body };
}
