'use client';
import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { BLUR_SQUARE } from '@/lib/constants';

// Move items to module level to avoid recreation on each render
const ITEMS = [
  {
    titleKey: 'reason1Title',
    descKey: 'reason1Desc',
    icon: '/images/elements/whyus-06.webp',
  },
  {
    titleKey: 'reason2Title',
    descKey: 'reason2Desc',
    icon: '/images/elements/whyus-07.webp',
  },
  {
    titleKey: 'reason3Title',
    descKey: 'reason3Desc',
    icon: '/images/elements/whyus-08.webp',
  },
] as const;

export default function WhyUs() {
  const t = useTranslations('about');
  const locale = useLocale();
  const isZh = locale === 'zh';

  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev <= 0 ? ITEMS.length - 1 : prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev >= ITEMS.length - 1 ? 0 : prev + 1));
  }, []);

  // Pre-compute next index for image preloading
  const nextIndex = useMemo(() => 
    (currentIndex + 1) % ITEMS.length, 
    [currentIndex]
  );

  const currentItem = ITEMS[currentIndex];
  const nextItem = ITEMS[nextIndex];

  return (
    <section aria-labelledby="why-us-heading" className="bg-brand-navy">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Centered Title - larger */}
        <h2 id="why-us-heading" className="text-3xl md:text-4xl font-bold tracking-wide font-outfit text-center">{t('whyUs')}</h2>
        
        {/* Carousel for all screen sizes */}
        <div className="mt-10 relative">
          {/* Decorative stars */}
          <div className="absolute -top-4 left-1/4 text-yellow-400 text-xl hidden md:block">★</div>
          <div className="absolute top-1/2 left-[15%] text-yellow-400 text-sm hidden md:block">★</div>
          <div className="absolute bottom-8 left-[20%] text-yellow-400 text-lg hidden md:block">★</div>

          <div className="flex items-center gap-4 md:gap-8">
            {/* Left Arrow */}
            <button
              onClick={goToPrev}
              className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand-pink/20 hover:bg-brand-pink/40 text-brand-pink flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
              aria-label="Previous item"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Main Content: Image Left + Text Right - Fixed height container */}
            <div className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-6 ${isZh ? 'md:gap-8 md:max-w-3xl mx-auto' : 'md:gap-14'} min-h-[280px] md:min-h-[240px]`}>
              {/* Large Image on Left - Fixed size container */}
              <div className="flex-shrink-0 w-44 h-44 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 relative">
                <Image 
                  src={currentItem.icon} 
                  alt="" 
                  fill
                  sizes="(max-width: 640px) 176px, (max-width: 768px) 192px, (max-width: 1024px) 224px, 256px"
                  className="object-contain transition-opacity duration-300"
                  priority
                  placeholder="blur"
                  blurDataURL={BLUR_SQUARE}
                />
                {/* Preload next image */}
                <Image
                  src={nextItem.icon}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 176px, (max-width: 768px) 192px, (max-width: 1024px) 224px, 256px"
                  className="object-contain opacity-0 absolute"
                  aria-hidden="true"
                  placeholder="blur"
                  blurDataURL={BLUR_SQUARE}
                />
              </div>
              
              {/* Text Content - 手機靠左、桌面靠左 */}
              <div className={`flex-1 min-h-[120px] md:min-h-[140px] flex flex-col justify-center ${isZh ? 'items-center' : ''}`}>
                <div className={`${isZh ? 'text-center md:text-left max-w-lg mx-auto md:mx-0' : 'text-left md:max-w-lg'}`}>
                  <h3 className="font-bold text-white font-outfit text-xl md:text-2xl lg:text-3xl">
                    {t(currentItem.titleKey)}
                  </h3>
                  <p className="text-white text-sm md:text-base lg:text-lg mt-3 md:mt-4 leading-relaxed whitespace-pre-line font-outfit">
                    {t(currentItem.descKey)}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={goToNext}
              className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-brand-pink/20 hover:bg-brand-pink/40 text-brand-pink flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
              aria-label="Next item"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Pagination Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {ITEMS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? 'bg-brand-pink w-6'
                    : 'bg-white/30 hover:bg-white/50 w-2'
                }`}
                aria-label={`Go to item ${idx + 1}`}
                aria-current={idx === currentIndex ? 'page' : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
