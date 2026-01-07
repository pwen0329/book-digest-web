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

        <div className="relative mx-auto max-w-6xl px-6 pt-18 pb-18 lg:pt-22 lg:pb-22">
          <div className="grid items-center gap-8 lg:gap-12 md:grid-cols-2 text-center md:text-left">
            <div className={locale === 'en' ? 'relative z-30' : undefined}>
              <h1 className="mt-6 text-2xl md:text-3xl lg:text-4xl font-bold text-white font-display leading-[1.2] tracking-[0.01em]">
                <span className={locale === 'zh' ? "whitespace-nowrap" : ""}>{t('hero.title')}</span>
                <br /> {t('hero.titleLine2')}
              </h1>
              <p className="mt-4 text-base md:text-lg text-white/90 max-w-2xl mx-auto md:mx-0 leading-relaxed font-outfit">
                {t('hero.subtitle')}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center md:items-start justify-center md:justify-start gap-3">
                <a href="/events" className="inline-flex min-h-11 items-center rounded-full bg-brand-navy px-6 py-3 font-semibold text-white shadow border border-white hover:bg-brand-pink hover:text-brand-navy hover:border-brand-pink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-pink focus-visible:ring-offset-brand-navy uppercase tracking-wider font-outfit transition-all">{t('hero.ctaBookClub')}</a>
                <button onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center rounded-full bg-brand-navy px-6 py-3 font-semibold text-white shadow border border-white hover:bg-brand-pink hover:text-white hover:border-brand-pink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-pink focus-visible:ring-offset-brand-navy uppercase tracking-wider font-outfit transition-all">{t('hero.ctaDetox')}</button>
              </div>
            </div>
            {/* Page Flip Animation - enlarged for better visibility */}
            <div className="mt-10 md:mt-0 w-full overflow-hidden">
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
              <a href="/events#detox" className="inline-flex items-center rounded-full bg-brand-pink text-white px-4 py-2 font-semibold hover:brightness-110 transition-all">{tModal('imIn')}</a>
              <button onClick={() => setOpen(false)} className="inline-flex items-center rounded-full border border-white/30 px-4 py-2 font-semibold text-white">{tModal('maybeLater')}</button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
