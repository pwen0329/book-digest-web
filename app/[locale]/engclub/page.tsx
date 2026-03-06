import { locales, setRequestLocale } from '@/lib/i18n';
import { getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import EngClubClient from './client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'English Book Club',
    description: 'Join our English book club. Read and discuss books in English with readers worldwide.',
    robots: { index: false, follow: false },
    alternates: getLocaleAlternates('engclub', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function EngClubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EngClubClient />;
}
