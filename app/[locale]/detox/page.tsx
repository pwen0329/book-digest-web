import { locales, setRequestLocale } from '@/lib/i18n';
import { getLocalizedEventContent, getLocalizedEventsContent } from '@/lib/events-content';
import { getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import DetoxClient from './client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const event = getLocalizedEventContent(locale, 'DETOX');
  return {
    title: event.title,
    description: event.description.slice(0, 160),
    alternates: getLocaleAlternates('detox', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function DetoxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DetoxClient events={getLocalizedEventsContent(locale)} />;
}
