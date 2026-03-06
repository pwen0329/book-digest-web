import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { locales, setRequestLocale } from '@/lib/i18n';
import { BLUR_POSTER } from '@/lib/constants';
import { getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Online English Book Club',
    description: 'Join our online English book club. Read and discuss books in English with readers worldwide.',
    alternates: getLocaleAlternates('engclub', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function EngClubPage({ params }: { params: Promise<{ locale: string }> }) {
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Left Copy */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold font-outfit">{t('engclubPage.leftTitle')}</h1>
              <p className="mt-2 text-brand-pink/90 font-outfit">{t('engclubPage.leftSubtitle')}</p>
            </div>
            <p className="font-bold text-white text-lg font-outfit">Coming soon…</p>
          </div>

          {/* Right Poster */}
          <div className="space-y-6">
            <div />
            <div className="relative w-full max-w-[340px] sm:max-w-[380px] lg:max-w-[520px] mx-auto rounded-2xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/5' }}>
              <Image
                src="/images/elements/poster_202604_en_online.webp"
                alt={t('onlineTitle')}
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
