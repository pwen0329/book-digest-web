import { getTranslations } from 'next-intl/server';
import dynamic from 'next/dynamic';
import { getLocalizedEventsContent } from '@/lib/events';
import { locales, setRequestLocale } from '@/lib/i18n';
import { pageSEO, getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import EventsClient from './client';

// Counter is a client component below the fold; lazy-load it
const Counter = dynamic(() => import('@/components/Counter'), { ssr: false });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: pageSEO.events.title,
    description: pageSEO.events.description,
    openGraph: { title: pageSEO.events.title, description: pageSEO.events.description, locale: locale === 'zh' ? 'zh_TW' : 'en_US' },
    alternates: getLocaleAlternates('events', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('events');
  const eventsMap = await getLocalizedEventsContent(locale);
  const ctaClass = locale === 'en' ? "inline-flex min-h-11 items-center justify-center rounded-full bg-brand-pink px-5 sm:px-7 py-2.5 sm:py-3 font-semibold text-white shadow font-outfit transition-all text-sm sm:text-base uppercase tracking-wider hover:brightness-110" : "inline-flex min-h-11 items-center justify-center rounded-full bg-brand-pink px-8 sm:px-9 py-2.5 sm:py-3 font-semibold text-white shadow transition-all text-base sm:text-lg tracking-[0.24em] sm:tracking-[0.3em] hover:brightness-110";

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-5xl px-6 lg:px-16 py-16">
        {/* Stats Counters - Client Component for animation */}
        {(() => {
          const startDate = new Date('2020-07-31');
          const now = new Date();
          const readingDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

          const baseDate = new Date('2026-03-01');
          const monthsDiff = (now.getFullYear() - baseDate.getFullYear()) * 12 + (now.getMonth() - baseDate.getMonth());
          const safeMonthsDiff = Math.max(0, monthsDiff);

          const clubsHeld = 78 + safeMonthsDiff * 2;
          const readersJoined = 300 + safeMonthsDiff * 15;
          return (
            <div className="grid grid-cols-3 gap-2 min-[420px]:gap-6 mb-16" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <div className="min-[420px]:translate-x-4 min-w-0"><Counter target={readingDays} label={t('readingDays')} /></div>
              <div className="min-w-0"><Counter target={clubsHeld} label={t('clubsHeld')} /></div>
              <div className="min-[420px]:-translate-x-4 min-w-0"><Counter target={readersJoined} label={t('readersJoined')} /></div>
            </div>
          );
        })()}

        {/* Events with Tabbed Navigation */}
        <EventsClient
          locale={locale}
          eventsMap={eventsMap}
          signUpText={t('signUp')}
          ctaClass={ctaClass}
        />
      </div>
    </section>
  );
}
