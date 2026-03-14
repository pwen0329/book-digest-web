import { getEventsContent } from '@/lib/events-content';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/admin-auth';
import { getRegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';
import { getSignupCapacityConfig } from '@/lib/signup-capacity-config';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminLogin from '@/components/admin/AdminLogin';
import { getBooks } from '@/lib/books';

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

  return (
    <AdminDashboard
      initialBooks={await getBooks()}
      initialEvents={await getEventsContent()}
      initialCapacity={await getSignupCapacityConfig()}
      initialRegistrationEmails={await getRegistrationSuccessEmailSettings()}
    />
  );
}