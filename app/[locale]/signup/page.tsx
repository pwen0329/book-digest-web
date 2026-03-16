import { Metadata } from 'next';
import { locales, setRequestLocale } from '@/lib/i18n';
import { getCapacityStatus } from '@/lib/signup-capacity';
import { getLocalizedEventsContent } from '@/lib/events-content';
import SignupClient from './client';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ location?: string }>;
}) {
  const { locale } = await params;
  const { location } = await searchParams;
  const activeLocation: 'TW' | 'NL' = location === 'NL' ? 'NL' : 'TW';
  setRequestLocale(locale);
  return (
    <SignupClient
      initialLocation={location}
      events={await getLocalizedEventsContent(locale)}
      initialSlotStatus={await getCapacityStatus(activeLocation)}
    />
  );
}
