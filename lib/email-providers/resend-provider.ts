import 'server-only';

import { Resend } from 'resend';
import type { IEmailProvider, EmailParams, EmailResult } from './types';

export class ResendEmailProvider implements IEmailProvider {
  private apiKey: string;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  getProviderName(): string {
    return 'resend';
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.fromEmail;
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    try {
      const resend = new Resend(this.apiKey);
      const result = await resend.emails.send({
        from: this.fromEmail,
        to: params.to,
        subject: params.subject,
        text: params.text,
        replyTo: params.replyTo,
      });

      if (result.error) {
        return {
          success: false,
          error: result.error.message,
        };
      }

      return {
        success: true,
        emailId: result.data?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
