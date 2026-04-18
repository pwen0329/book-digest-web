import 'server-only';

export type RegistrationEmailLocale = 'zh' | 'en';

export type RegistrationSuccessEmailTemplate = {
  subject: string;
  body: string;
};

export type RegistrationSuccessEmailSettings = {
  enabled: boolean;
  templates: Record<RegistrationEmailLocale, RegistrationSuccessEmailTemplate>;
};

// TODO: Replace with database-backed configuration per event
// For now, return hardcoded default values from data/registration-success-email.json
export async function getRegistrationSuccessEmailSettings(): Promise<RegistrationSuccessEmailSettings> {
  return {
    enabled: false,
    templates: {
      zh: {
        subject: 'Book Digest 報名成功｜{{eventTitle}}',
        body: `嗨 {{name}}，

感謝您報名參加 Book Digest 活動！

我們已收到您的報名，目前正在審核您的付款資訊。

活動詳情：
• 活動：{{eventTitle}}
• 付款金額：{{paymentAmount}} {{paymentCurrency}}

付款說明：
{{paymentInstructions}}

一旦確認付款，我們將發送確認郵件給您。

如有任何問題，請隨時與我們聯繫。

Book Digest 團隊
{{siteUrl}}`,
      },
      en: {
        subject: 'Book Digest Registration Received | {{eventTitle}}',
        body: `Hi {{name}},

Thank you for registering for Book Digest event!

We have received your registration and are currently reviewing your payment information.

Event Details:
• Event: {{eventTitle}}
• Payment Amount: {{paymentAmount}} {{paymentCurrency}}

Payment Instructions:
{{paymentInstructions}}

Once payment is confirmed, we will send you a confirmation email.

If you have any questions, please feel free to contact us.

Book Digest Team
{{siteUrl}}`,
      },
    },
  };
}
