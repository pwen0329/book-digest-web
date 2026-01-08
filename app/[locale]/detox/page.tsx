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
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold font-outfit">{t('digitalDetox.title')}</h1>
          <p className="mt-3 text-white/80 max-w-3xl">{t('digitalDetox.description')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Content */}
          <div className="space-y-8">
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-pink text-brand-navy flex items-center justify-center font-bold">1</span>
                <p className="text-white/80 pt-1">{t('digitalDetox.step1')}</p>
              </div>
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-pink text-brand-navy flex items-center justify-center font-bold">2</span>
                <p className="text-white/80 pt-1">{t('digitalDetox.step2')}</p>
              </div>
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-pink text-brand-navy flex items-center justify-center font-bold">3</span>
                <p className="text-white/80 pt-1">{t('digitalDetox.step3')}</p>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <p className="text-brand-pink">
                <span className="font-semibold">💡 Tip:</span>{' '}
                <span className="text-white/80">{t('digitalDetox.tip').replace('Tip: ', '')}</span>
              </p>
            </div>
          </div>

          {/* Poster */}
          <div>
            <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ aspectRatio: '750/570' }}>
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
