import { loadAdminDocumentRecord } from '@/lib/admin-content-store';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/admin-auth';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminLogin from '@/components/admin/AdminLogin';
import type { Book } from '@/types/book';
import type { EventContentMap } from '@/types/event-content';
import type { CapacityConfigFile } from '@/lib/signup-capacity-config';
import type { RegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const configured = isAdminConfigured();

  if (!configured) {
    return <AdminLogin configured={false} />;
  }

  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return <AdminLogin configured={true} />;
  }

  const [booksRecord, eventsRecord, capacityRecord, emailRecord] = await Promise.all([
    loadAdminDocumentRecord<Book[]>({ key: 'books', fallbackFile: 'data/books.json' }),
    loadAdminDocumentRecord<EventContentMap>({ key: 'events', fallbackFile: 'data/events-content.json' }),
    loadAdminDocumentRecord<CapacityConfigFile>({ key: 'capacity', fallbackFile: 'data/signup-capacity.json' }),
    loadAdminDocumentRecord<RegistrationSuccessEmailSettings>({ key: 'registration-success-email', fallbackFile: 'data/registration-success-email.json' }),
  ]);

  return (
    <AdminDashboard
      initialBooks={booksRecord.value}
      initialEvents={eventsRecord.value}
      initialCapacity={capacityRecord.value}
      initialRegistrationEmails={emailRecord.value}
      initialDocumentVersions={{
        books: booksRecord.updatedAt,
        events: eventsRecord.updatedAt,
        capacity: capacityRecord.updatedAt,
        emails: emailRecord.updatedAt,
      }}
    />
  );
}