"use client";
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import PageFlipAnimation from '@/components/PageFlipAnimation';

// Dynamically import Modal (non-critical, only shown on user interaction)
const Modal = dynamic(() => import('@/components/Modal'), {
  ssr: false,
  loading: () => null,
});

export default function HomeHero() {
  const [open, setOpen] = useState(false);
  const locale = useLocale();
  const t = useTranslations('home');
  const tModal = useTranslations('modal');

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

        <div className="relative mx-auto max-w-6xl px-6 sm:px-8 md:px-6 pt-18 pb-18 lg:pt-22 lg:pb-22">
          <div className="grid items-center gap-8 lg:gap-12 md:grid-cols-2 text-center md:text-left">
            <div className={`${locale === 'en' ? 'relative z-30' : ''} order-2 md:order-1 px-2 sm:px-0`}>
              <h1 
                className={`mt-6 font-bold text-white font-display tracking-[0.01em] ${
                  locale === 'zh'
                    ? 'text-xl md:text-2xl lg:text-3xl'
                    : 'text-2xl md:text-3xl lg:text-4xl leading-[1.1]'
                }`}
                style={locale === 'zh' ? { lineHeight: '1.0' } : undefined}
              >
                <span>{t('hero.title')}</span>
                <br />
                <span className={locale === 'zh' ? 'md:mt-4 md:inline-block' : ''}>{t('hero.titleLine2')}</span>
              </h1>
              <p className="mt-4 text-base md:text-lg text-white/90 max-w-2xl mx-auto md:mx-0 leading-loose font-outfit">
                {t('hero.subtitle')}
              </p>
              <div className="mt-8 flex flex-row flex-wrap items-center md:items-start justify-center md:justify-start gap-2 sm:gap-3">
                <a href="/events" className={`inline-flex min-h-11 items-center rounded-full bg-brand-navy px-3 sm:px-6 py-2.5 sm:py-3 font-semibold text-white shadow border border-white hover:bg-brand-pink hover:text-white hover:border-brand-pink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-pink focus-visible:ring-offset-brand-navy font-outfit transition-all text-sm sm:text-base ${locale === 'zh' ? 'tracking-widest' : 'uppercase tracking-wider'}`}>{t('hero.ctaBookClub')}</a>
                <button onClick={() => setOpen(true)} className={`inline-flex min-h-11 items-center rounded-full bg-brand-navy px-3 sm:px-6 py-2.5 sm:py-3 font-semibold text-white shadow border border-white hover:bg-brand-pink hover:text-white hover:border-brand-pink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-pink focus-visible:ring-offset-brand-navy font-outfit transition-all text-sm sm:text-base ${locale === 'zh' ? 'tracking-widest' : 'uppercase tracking-wider'}`}>{t('hero.ctaDetox')}</button>
              </div>
            </div>
            {/* Page Flip Animation - enlarged for better visibility */}
            <div className="mt-10 md:mt-0 w-full max-w-[calc(100vw-3rem)] mx-auto px-4 sm:px-0 order-1 md:order-2">
              <PageFlipAnimation
                gifSrc="/images/notebook/notebook.gif"
                className={heroFlipClassName}
              />
            </div>
          </div>
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title={tModal('detoxTitle')}>
        {/* Layout inspired by docs/ui/notebook-03 1.png */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-stretch">
          {/* Visual column: Page Flip Animation */}
          <div className="order-last md:order-first">
            <div className="rounded-xl overflow-hidden bg-white/10 border border-white/15 shadow">
              <PageFlipAnimation
                images={[
                  '/images/notebook/notebook-01.png',
                  '/images/notebook/notebook-02.png',
                  '/images/notebook/notebook-03.png',
                  '/images/notebook/notebook-04.png',
                  '/images/notebook/notebook-05.png',
                  '/images/notebook/notebook-06.png',
                ]}
                autoPlay={true}
                interval={3000}
                className="w-full"
              />
            </div>
          </div>
          {/* Content column */}
          <div>
            <p>
              {tModal('detoxIntro')}
            </p>
            <ul className="mt-3 list-disc pl-5 space-y-1">
              <li>{tModal('detoxFeature1')}</li>
              <li>{tModal('detoxFeature2')}</li>
              <li>{tModal('detoxFeature3')}</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href="/events#detox" className={`inline-flex items-center rounded-full bg-brand-pink text-white px-4 py-2 font-semibold hover:brightness-110 transition-all ${locale === 'zh' ? 'tracking-widest' : ''}`}>{tModal('imIn')}</a>
              <button onClick={() => setOpen(false)} className="inline-flex items-center rounded-full border border-white/30 px-4 py-2 font-semibold text-white">{tModal('maybeLater')}</button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
