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
  const subtitle = t('detoxPage.leftSubtitle');
  const rightBody = t('detoxPage.rightBody');

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-stretch max-w-6xl mx-auto">
          {/* Left Copy */}
          <div className="order-1 flex justify-center lg:justify-start">
            <div className="flex w-full max-w-[700px] flex-col justify-start py-6 lg:py-10">
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold font-outfit leading-tight">{t('detoxPage.leftTitle')}</h1>
                </div>
                {subtitle ? <p className="text-lg text-white font-outfit">{subtitle}</p> : null}
                <div className="text-white/85 leading-relaxed whitespace-pre-line text-base md:text-lg font-outfit">
                  {t.rich('detoxPage.leftBody', {
                    label: (chunks) => <strong className="font-bold text-white">{chunks}</strong>,
                  })}
                </div>
                {rightBody ? <p className="text-white/70 text-base font-outfit">{rightBody}</p> : null}
              </div>
            </div>
          </div>

          {/* Right Poster */}
          <div className="order-2 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[480px] lg:w-[480px] h-auto rounded-xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/5' }}>
              <Image
                src="/images/elements/poster_202604_detox.jpg"
                alt={t('detoxTitle')}
                fill
                sizes="(max-width: 1024px) 420px, 50vw"
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
