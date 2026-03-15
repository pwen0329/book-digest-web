import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book Digest Admin',
  icons: {
    icon: '/images/favicon-en.ico',
    shortcut: '/images/favicon-en.ico',
    apple: '/images/favicon-en.ico',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}