import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import { BLUR_SQUARE } from '@/lib/constants';
import { locales, setRequestLocale } from '@/lib/i18n';
import { pageSEO, getLocaleAlternates } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: pageSEO.about.title,
    description: pageSEO.about.description,
    openGraph: { title: pageSEO.about.title, description: pageSEO.about.description, locale: locale === 'zh' ? 'zh_TW' : 'en_US' },
    alternates: getLocaleAlternates('about', locale),
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const currentLocale = await getLocale();
  const t = await getTranslations('about');

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Our Story Section - Centered */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-wide font-outfit mb-8 text-center">
          {t('ourStory')}
        </h1>

        {/* Story Paragraphs - Left aligned and horizontally aligned with "A New Book Every Month" text block */}
        <div className="space-y-6 text-white/90 leading-relaxed text-left font-outfit max-w-3xl mx-auto">
          <p className="whitespace-pre-line">
            {t('storyPara1')}
          </p>
          <p className="whitespace-pre-line">
            {t('storyPara2')}
          </p>
          <p className="whitespace-pre-line">
            {t('storyPara3')}
          </p>
        </div>

        {/* Why Us Section */}
        <div className="mt-20">
          <h2 className="text-3xl md:text-4xl font-bold tracking-wide font-outfit text-center mb-12">
            {t('whyUs')}
          </h2>

          {/* Reason 1 - A New Book Every Month */}
          <div className="flex justify-center mb-16">
            <div className="w-full flex flex-col md:flex-row items-center gap-6 md:gap-10 max-w-4xl">
              <div className="flex-shrink-0 relative w-56 md:w-72 h-56 md:h-72">
                <Image 
                  src="/images/elements/whyus-06.webp" 
                  alt="" 
                  fill
                  sizes="(max-width: 768px) 224px, 288px"
                  className="object-contain"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL={BLUR_SQUARE}
                />
              </div>
              <div className="flex-1 text-left w-full">
                <h3 className="text-2xl font-bold font-outfit text-white mb-3">
                  {t('reason1Title')}
                </h3>
                <p className="text-white/80 leading-relaxed whitespace-pre-line font-outfit">
                  {t('reason1Desc')}
                </p>
              </div>
            </div>
          </div>

          {/* Reason 2 - Deep, delightful and diverse conversations */}
          <div className="flex justify-center mb-16">
            <div className="w-full flex flex-col md:flex-row items-center gap-6 md:gap-10 max-w-4xl">
              <div className="flex-shrink-0 relative w-56 md:w-72 h-56 md:h-72">
                <Image 
                  src="/images/elements/whyus-07.webp" 
                  alt="" 
                  fill
                  sizes="(max-width: 768px) 224px, 288px"
                  className="object-contain"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL={BLUR_SQUARE}
                />
              </div>
              <div className="flex-1 text-left w-full">
                <h3 className="text-2xl font-bold font-outfit text-white mb-3">
                  {t('reason2Title')}
                </h3>
                <p className="text-white/80 leading-relaxed whitespace-pre-line font-outfit">
                  {t('reason2Desc')}
                </p>
              </div>
            </div>
          </div>

          {/* Reason 3 - Chill Vibes, No Pressure */}
          <div className="flex justify-center mb-16">
            <div className="w-full flex flex-col md:flex-row items-center gap-6 md:gap-10 max-w-4xl">
              <div className="flex-shrink-0 relative w-56 md:w-72 h-56 md:h-72">
                <Image 
                  src="/images/elements/whyus-08.webp" 
                  alt="" 
                  fill
                  sizes="(max-width: 768px) 224px, 288px"
                  className="object-contain"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL={BLUR_SQUARE}
                />
              </div>
              <div className="flex-1 text-left w-full">
                <h3 className="text-2xl font-bold font-outfit text-white mb-3">
                  {t('reason3Title')}
                </h3>
                <p className="text-white/80 leading-relaxed whitespace-pre-line font-outfit">
                  {t('reason3Desc')}
                </p>
              </div>
            </div>
          </div>

          {/* Join Us Button */}
          <div className="text-center mt-12">
            <Link
              href={`/${currentLocale}/events`}
              className={currentLocale === 'en' ? "inline-flex min-h-11 items-center justify-center rounded-full bg-brand-pink px-5 sm:px-7 py-2.5 sm:py-3 font-semibold text-white shadow font-outfit transition-all text-sm sm:text-base uppercase tracking-wider hover:brightness-110" : "inline-flex min-h-11 items-center justify-center rounded-full bg-brand-pink px-8 sm:px-9 py-2.5 sm:py-3 font-semibold text-white shadow transition-all text-base sm:text-lg tracking-[0.24em] sm:tracking-[0.3em] hover:brightness-110"}
            >
              {t('joinUsBtn')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
