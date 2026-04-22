'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function AdminNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingTab, setLoadingTab] = useState<string | null>(null);

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

  const handleTabClick = (e: React.MouseEvent, tabId: string, href: string) => {
    e.preventDefault();
    setLoadingTab(tabId);
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <div className="flex flex-wrap gap-3">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const isLoading = loadingTab === tab.id && isPending;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            onClick={(e) => handleTabClick(e, tab.id, tab.href)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition relative ${
              isActive
                ? 'bg-brand-pink text-brand-navy'
                : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
            } ${isLoading ? 'opacity-70' : ''}`}
          >
            <span className={isLoading ? 'invisible' : ''}>{tab.label}</span>
            {isLoading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </span>
            )}
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
