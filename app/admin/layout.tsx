import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { isAdminAuthenticated, isAdminConfigured } from '@/lib/admin-auth';
import AdminNavigation from '@/components/admin/AdminNavigation';

export const metadata: Metadata = {
  title: 'Book Digest Admin',
  icons: {
    icon: '/images/favicon-en.ico',
    shortcut: '/images/favicon-en.ico',
    apple: '/images/favicon-en.ico',
  },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';

  // Skip auth check for login page to avoid redirect loop
  if (pathname === '/admin/login') {
    return (
      <div className="min-h-screen bg-brand-navy px-4 py-8 text-white sm:px-6 lg:px-8">
        {children}
      </div>
    );
  }

  const configured = isAdminConfigured();
  if (!configured) {
    redirect('/admin/login');
  }

  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect('/admin/login');
  }

  return (
    <div className="min-h-screen bg-brand-navy px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header with navigation */}
        <div className="rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-outfit text-xs uppercase tracking-[0.35em] text-brand-pink">Book Digest Admin</p>
              <h1 className="mt-3 text-3xl font-bold font-outfit">Content operations dashboard</h1>
              <p className="mt-2 max-w-3xl text-white/70">
                Edit books, update the current monthly posters and copy, and control registration windows with automatic full-state handling.
              </p>
            </div>

            <AdminNavigation />
          </div>
        </div>

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}