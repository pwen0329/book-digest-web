import { getRegistrationSuccessEmailTemplates, getPaymentConfirmationEmailTemplates } from '@/lib/email-templates';
import { getAllEvents } from '@/lib/events';
import EmailManager from '@/components/admin/EmailManager';

export const dynamic = 'force-dynamic';

export default async function EmailsPage() {
  const [registrationTemplates, paymentTemplates] = await Promise.all([
    getRegistrationSuccessEmailTemplates(),
    getPaymentConfirmationEmailTemplates(),
  ]);
  const events = await getAllEvents({ isPublished: true });

  return (
    <EmailManager
      initialEmailTemplates={{
        registration: registrationTemplates,
        payment: paymentTemplates,
      }}
      events={events.map(e => ({
        id: e.id,
        title: e.title,
        titleEn: e.titleEn || e.title,
        eventDate: e.eventDate,
      }))}
    />
  );
}
