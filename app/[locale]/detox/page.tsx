import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import ActivitySignupTabs from '@/components/ActivitySignupTabs';
import { locales, setRequestLocale } from '@/lib/i18n';
import { BLUR_POSTER } from '@/lib/constants';
import { getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';

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
  const t = await getTranslations('events');

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        {/* Back to Events */}
        <div className="mb-8">
          <Link
            href={`/${locale}/events`}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-brand-pink transition-colors font-outfit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            {t('backToEvents')}
          </Link>
        </div>
        <ActivitySignupTabs activeTab="DETOX" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Left Copy */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold font-outfit">{t('detoxPage.leftTitle')}</h1>
            </div>
            <p className="font-bold text-white text-lg font-outfit">Coming soon…</p>
          </div>

          {/* Right Copy + Poster */}
          <div className="space-y-6">
            <div />
            <div className="relative w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[420px] mx-auto rounded-2xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/5' }}>
              <Image
                src="/images/elements/AD-17.webp"
                alt={t('detoxTitle')}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                loading="lazy"
                placeholder="blur"
                blurDataURL={BLUR_POSTER}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
