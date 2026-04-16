import { getAllBooksFromDB } from '@/lib/books-db';
import { getAllEvents } from '@/lib/events';
import { getAllVenues } from '@/lib/venues';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/admin-auth';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminLogin from '@/components/admin/AdminLogin';
import { sortBooksDescending } from '@/lib/book-order';
import { getRegistrationSuccessEmailSettings } from '@/lib/registration-success-email-config';

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

  const [books, events, venues, emailSettings] = await Promise.all([
    getAllBooksFromDB(), // Load from database
    getAllEvents({ includeVenue: true, includeBook: true }), // Load from database with joins
    getAllVenues(), // Load from database
    getRegistrationSuccessEmailSettings(),
  ]);

  return (
    <AdminDashboard
      initialBooks={sortBooksDescending(books)}
      initialEvents={events}
      initialVenues={venues}
      initialRegistrationEmails={emailSettings}
    />
  );
}