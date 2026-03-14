import 'server-only';

import { loadAdminDocument } from '@/lib/admin-content-store';

export type RegistrationEmailLocale = 'zh' | 'en';

export type RegistrationSuccessEmailTemplate = {
  subject: string;
  body: string;
};

export type RegistrationSuccessEmailSettings = {
  enabled: boolean;
  templates: Record<RegistrationEmailLocale, RegistrationSuccessEmailTemplate>;
};

const REGISTRATION_SUCCESS_EMAIL_FILE = 'data/registration-success-email.json';

export async function getRegistrationSuccessEmailSettings(): Promise<RegistrationSuccessEmailSettings> {
  return loadAdminDocument<RegistrationSuccessEmailSettings>({
    key: 'registration-success-email',
    fallbackFile: REGISTRATION_SUCCESS_EMAIL_FILE,
  });
}

export { REGISTRATION_SUCCESS_EMAIL_FILE };