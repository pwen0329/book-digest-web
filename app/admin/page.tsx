import { readJsonFile } from '@/lib/json-store';
import { getEventsContent } from '@/lib/events-content';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/admin-auth';
import { getSignupCapacityConfig } from '@/lib/signup-capacity-config';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminLogin from '@/components/admin/AdminLogin';
import type { Book } from '@/types/book';

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
      initialBooks={readJsonFile<Book[]>('data/books.json')}
      initialEvents={getEventsContent()}
      initialCapacity={getSignupCapacityConfig()}
    />
  );
}