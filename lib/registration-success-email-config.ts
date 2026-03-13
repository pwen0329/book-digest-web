import 'server-only';

import { readJsonFile } from '@/lib/json-store';

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

export function getRegistrationSuccessEmailSettings(): RegistrationSuccessEmailSettings {
  return readJsonFile<RegistrationSuccessEmailSettings>(REGISTRATION_SUCCESS_EMAIL_FILE);
}

export { REGISTRATION_SUCCESS_EMAIL_FILE };