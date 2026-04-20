import 'server-only';

import { ResendEmailProvider } from './resend-provider';
import { GmailEmailProvider } from './gmail-provider';
import type { IEmailProvider } from './types';

type EmailProviderConfig = {
  resend?: {
    apiKey: string;
    fromEmail: string;
  };
  gmail?: {
    user: string;
    password: string;
    smtpHost?: string;
    smtpPort?: number;
  };
};

export function createEmailProvider(config: EmailProviderConfig): IEmailProvider {
  // Priority: RESEND > GMAIL
  if (config.resend?.apiKey && config.resend?.fromEmail) {
    return new ResendEmailProvider(config.resend.apiKey, config.resend.fromEmail);
  }

  if (config.gmail?.user && config.gmail?.password) {
    return new GmailEmailProvider(
      config.gmail.user,
      config.gmail.password,
      config.gmail.smtpHost,
      config.gmail.smtpPort
    );
  }

  throw new Error('No email provider configured. Please set either RESEND or GMAIL credentials.');
}
