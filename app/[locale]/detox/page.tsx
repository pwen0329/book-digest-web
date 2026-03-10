import { locales, setRequestLocale } from '@/lib/i18n';
import { getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import DetoxClient from './client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Digital Detox',
    description: 'Join our digital detox challenge. Put your phone down and reconnect with the world around you.',
    alternates: getLocaleAlternates('detox', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function DetoxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DetoxClient />;
}
