import { locales, setRequestLocale } from '@/lib/i18n';
import { getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import JoinUsClient from './client';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Join Us',
    description: 'Become a Book Digest host. Lead conversations, connect readers, and build community.',
    alternates: getLocaleAlternates('joinus', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function JoinUsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  
  return <JoinUsClient />;
}
