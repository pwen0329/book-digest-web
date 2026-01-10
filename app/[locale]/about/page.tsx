import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import { BLUR_SQUARE } from '@/lib/constants';
import { locales, setRequestLocale } from '@/lib/i18n';

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
        <div className="space-y-6 text-white/90 leading-relaxed text-left font-outfit md:pl-72 lg:pl-80">
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
                  src="/images/elements/whyus-06.png" 
                  alt="" 
                  fill
                  sizes="(max-width: 768px) 224px, 288px"
                  className="object-contain"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL={BLUR_SQUARE}
                />
              </div>
              <div className="flex-1 text-center md:text-left">
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
                  src="/images/elements/whyus-07.png" 
                  alt="" 
                  fill
                  sizes="(max-width: 768px) 224px, 288px"
                  className="object-contain"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL={BLUR_SQUARE}
                />
              </div>
              <div className="flex-1 text-center md:text-left">
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
                  src="/images/elements/whyus-08.png" 
                  alt="" 
                  fill
                  sizes="(max-width: 768px) 224px, 288px"
                  className="object-contain"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL={BLUR_SQUARE}
                />
              </div>
              <div className="flex-1 text-center md:text-left">
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
              href="/events"
              className={`inline-flex items-center px-8 py-3 rounded-full bg-brand-pink text-white font-semibold hover:brightness-110 transition-all text-sm ${currentLocale === 'zh' ? 'tracking-widest' : 'uppercase tracking-wider'}`}
            >
              {t('joinUsBtn')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
