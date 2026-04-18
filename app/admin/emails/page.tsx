import { getRegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';
import EmailManager from '@/components/admin/EmailManager';

export const dynamic = 'force-dynamic';

export default async function EmailsPage() {
  const emailSettings = await getRegistrationSuccessEmailSettings();

  return <EmailManager initialRegistrationEmails={emailSettings} />;
}
