"use client";
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import PageFlipAnimation from '@/components/PageFlipAnimation';

export default function HomeHero() {
  const locale = useLocale();
  const t = useTranslations('home');

  const heroFlipClassName =
    locale === 'en'
      ? 'w-full max-w-full md:max-w-2xl mx-auto md:ml-auto md:mr-0'
      : 'w-full max-w-full md:max-w-3xl mx-auto md:ml-auto md:mr-0';
  
  return (
    <>
      <section className="relative bg-brand-navy">
        {/* Decorative background elements (large screens) */}
        <div aria-hidden="true" className="pointer-events-none hidden lg:block absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-24 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 -left-20 h-80 w-80 rounded-full bg-brand-pink/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 sm:px-8 md:px-6 pt-12 pb-12 md:pt-18 md:pb-18 lg:pt-22 lg:pb-22">
          <div className="grid items-center gap-8 lg:gap-12 md:grid-cols-2 text-center md:text-left">
            <div className={`${locale === 'en' ? 'relative z-30' : ''} order-2 md:order-1 px-2 sm:px-0 md:pl-12`}>
              <h1 
                className={`mt-6 font-bold text-white font-display tracking-[0.01em] ${
                  locale === 'zh'
                    ? 'text-xl md:text-2xl lg:text-3xl text-center md:text-left'
                    : 'text-2xl md:text-3xl lg:text-4xl leading-[1.1] whitespace-pre-line'
                }`}
                style={locale === 'zh' ? { lineHeight: '1.35' } : undefined}
              >
                <span>{t('hero.title')}</span>
                <br /> 
                <span className={`${locale === 'zh' ? 'inline-block mt-0 md:mt-0' : 'whitespace-pre-line'}`}>{t('hero.titleLine2')}</span>
              </h1>
              <p className={`mt-4 text-base md:text-lg text-white/90 max-w-2xl mx-auto md:mx-0 leading-snug md:leading-snug font-outfit whitespace-pre-line ${locale === 'zh' ? 'text-center md:text-left' : ''}`}>
                {t('hero.subtitle')}
              </p>
              <div className="mt-8 flex flex-row flex-wrap items-center md:items-start justify-center md:justify-start gap-2 sm:gap-3">
                <Link href={`/${locale}/events`} className={`inline-flex min-h-11 items-center rounded-full bg-brand-navy ${locale === 'en' ? 'px-5 sm:px-7' : 'px-6 sm:px-8'} py-2.5 sm:py-3 font-semibold text-white shadow border border-white hover:bg-brand-pink hover:text-white hover:border-brand-pink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-pink focus-visible:ring-offset-brand-navy font-outfit transition-all text-sm sm:text-base ${locale === 'zh' ? 'tracking-[0.2em]' : 'uppercase tracking-wider'}`}><span className={locale === 'zh' ? '-mr-[0.2em]' : ''}>{t('hero.ctaBookClub')}</span></Link>
                <Link href={`/${locale}/events#detox`} className={`inline-flex min-h-11 items-center rounded-full bg-brand-navy ${locale === 'en' ? 'px-5 sm:px-7' : 'px-6 sm:px-8'} py-2.5 sm:py-3 font-semibold text-white shadow border border-white hover:bg-brand-pink hover:text-white hover:border-brand-pink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-pink focus-visible:ring-offset-brand-navy font-outfit transition-all text-sm sm:text-base ${locale === 'zh' ? 'tracking-[0.2em]' : 'uppercase tracking-wider'}`}><span className={locale === 'zh' ? '-mr-[0.2em]' : ''}>{t('hero.ctaDetox')}</span></Link>
              </div>
            </div>
            {/* Page Flip Animation - enlarged for better visibility */}
            <div className="mt-0 md:mt-0 w-full max-w-[calc(100vw-3rem)] mx-auto px-4 sm:px-0 order-1 md:order-2">
              <PageFlipAnimation
                videoSrc="/images/notebook/notebook.webm"
                videoPoster="/images/notebook/notebook-poster.webp"
                className={heroFlipClassName}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
