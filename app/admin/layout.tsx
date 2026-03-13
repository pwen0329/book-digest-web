import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book Digest Admin',
  icons: {
    icon: '/images/logo/footer-icon.png',
    shortcut: '/images/logo/footer-icon.png',
    apple: '/images/logo/footer-icon.png',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}