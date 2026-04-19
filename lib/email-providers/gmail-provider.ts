import 'server-only';

import nodemailer from 'nodemailer';
import type { IEmailProvider, EmailParams, EmailResult } from './types';

export class GmailEmailProvider implements IEmailProvider {
  private user: string;
  private password: string;

  constructor(user: string, password: string) {
    this.user = user;
    this.password = password;
  }

  getProviderName(): string {
    return 'gmail';
  }

  isConfigured(): boolean {
    return !!this.user && !!this.password;
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.user,
          pass: this.password,
        },
      });

      const info = await transporter.sendMail({
        from: this.user,
        to: params.to,
        subject: params.subject,
        text: params.text,
        replyTo: params.replyTo,
      });

      return {
        success: true,
        emailId: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
