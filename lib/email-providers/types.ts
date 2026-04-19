import 'server-only';

export type EmailParams = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export type EmailResult = {
  success: boolean;
  emailId?: string;
  error?: string;
};

export interface IEmailProvider {
  sendEmail(params: EmailParams): Promise<EmailResult>;
  isConfigured(): boolean;
  getProviderName(): string;
}
