'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminNavigation() {
  const pathname = usePathname();

  const tabs = [
    { id: 'books', label: 'Books', href: '/admin/books' },
    { id: 'events', label: 'Events', href: '/admin/events' },
    { id: 'venues', label: 'Venues', href: '/admin/venues' },
    { id: 'emails', label: 'Emails', href: '/admin/emails' },
    { id: 'registrations', label: 'Registrations', href: '/admin/registrations' },
    { id: 'assets', label: 'Assets', href: '/admin/assets' },
  ];

  const handleLogout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    window.location.href = '/admin/login';
  };

  return (
    <div className="flex flex-wrap gap-3">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-brand-pink text-brand-navy'
                : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      <button
        onClick={handleLogout}
        type="button"
        className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/20 hover:text-white"
      >
        Logout
      </button>
    </div>
  );
}
