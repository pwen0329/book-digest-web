import 'server-only';

import nodemailer from 'nodemailer';
import type { IEmailProvider, EmailParams, EmailResult } from './types';

export class GmailEmailProvider implements IEmailProvider {
  private user: string;
  private password: string;
  private smtpHost?: string;
  private smtpPort?: number;

  constructor(user: string, password: string, smtpHost?: string, smtpPort?: number) {
    this.user = user;
    this.password = password;
    this.smtpHost = smtpHost;
    this.smtpPort = smtpPort;
  }

  getProviderName(): string {
    return 'gmail';
  }

  isConfigured(): boolean {
    return !!this.user && !!this.password;
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    try {
      // Use custom SMTP host/port if provided (for testing with MailHog), otherwise use Gmail service
      const transporter = this.smtpHost && this.smtpPort
        ? nodemailer.createTransport({
            host: this.smtpHost,
            port: this.smtpPort,
            secure: false,
            auth: {
              user: this.user,
              pass: this.password,
            },
          })
        : nodemailer.createTransport({
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
        html: params.html,
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
