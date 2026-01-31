import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { locales, setRequestLocale } from '@/lib/i18n';
import { BLUR_POSTER } from '@/lib/constants';

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Left Copy */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold font-outfit">{t('detoxPage.leftTitle')}</h1>
              <p className="mt-2 text-brand-pink/90 font-outfit">{t('detoxPage.leftSubtitle')}</p>
            </div>
            <p className="text-white/80 leading-relaxed whitespace-pre-line font-outfit">
              {t('detoxPage.leftBody')}
            </p>
            <p className="text-white/80 leading-relaxed whitespace-pre-line font-outfit">
              {t('detoxPage.rightBody')}
            </p>
          </div>

          {/* Right Copy + Poster */}
          <div className="space-y-6">
            <div />
            <div className="relative w-full max-w-[340px] sm:max-w-[380px] lg:max-w-[520px] mx-auto rounded-2xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/5' }}>
              <Image
                src="/images/elements/AD-17.png"
                alt="Digital Detox"
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
