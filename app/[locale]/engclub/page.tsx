import { locales, setRequestLocale } from '@/lib/i18n';
import { getLocalizedEventContent, getLocalizedEventsContent } from '@/lib/events-content';
import { getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import EngClubClient from './client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const event = getLocalizedEventContent(locale, 'EN');
  return {
    title: event.title,
    description: event.description.slice(0, 160),
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
  return <EngClubClient events={getLocalizedEventsContent(locale)} />;
}
