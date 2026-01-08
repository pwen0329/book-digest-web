'use client';
import { useState, Suspense } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { BLUR_POSTER } from '@/lib/constants';

function HostFAQItem({ 
  title, 
  children,
  isOpen,
  onToggle,
}: { 
  title: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors px-4 -mx-4"
      >
        <h3 className="font-semibold text-white text-lg">{title}</h3>
        <svg 
          className={`w-6 h-6 text-brand-pink transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-white/80 space-y-3 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

function JoinUsContent() {
  const tJoin = useTranslations('joinus');
  const locale = useLocale();
  
  // Track which FAQ items are open
  const [openItems, setOpenItems] = useState<{ [key: string]: boolean }>({
    whatDo: true,
    whyJoin: false,
    where: false,
    uncertain: false,
    apply: false,
  });

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const allClosed = {
        whatDo: false,
        whyJoin: false,
        where: false,
        uncertain: false,
        apply: false,
      };
      // 若目前已開，則全部收合；否則只開所選，其餘收合
      if (prev[key]) return allClosed;
      return { ...allClosed, [key]: true };
    });
  };

  const postItImage = locale === 'zh' ? '/images/elements/post-it-23.png' : '/images/elements/post-it-24.png';

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold font-outfit">
            {tJoin('title')}
          </h1>
        </div>

        {/* Main Content: Left Side Note + Right Side FAQ */}
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8 lg:gap-16 items-start">
          {/* Left: Post-it Note Style */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative w-full lg:w-[400px] h-auto">
              <Image
                src={postItImage}
                alt="Host Note"
                width={400}
                height={500}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>

          {/* Right: Accordion FAQ */}
          <div className="space-y-0">
            {/* What does a host do */}
            <HostFAQItem
              title={tJoin('hostTitle')}
              isOpen={openItems.whatDo}
              onToggle={() => toggleItem('whatDo')}
            >
              <p className="font-medium text-white mb-3">{tJoin('hostIntro')}</p>
              <ul className="space-y-2">
                <li>{tJoin('hostPoint1')}</li>
                <li>{tJoin('hostPoint2')}</li>
                <li>{tJoin('hostPoint3')}</li>
                <li>{tJoin('hostPoint4')}</li>
                <li>{tJoin('hostPoint5')}</li>
              </ul>
              <p className="mt-4 text-white/80 text-sm">{tJoin('hostKitTitle')}</p>
            </HostFAQItem>

            {/* Why join us */}
            <HostFAQItem
              title={tJoin('whyJoinTitle')}
              isOpen={openItems.whyJoin}
              onToggle={() => toggleItem('whyJoin')}
            >
              <div className="space-y-3 whitespace-pre-line">{tJoin('whyJoinDesc')}</div>
            </HostFAQItem>

            {/* Where can you host */}
            <HostFAQItem
              title={tJoin('whereTitle')}
              isOpen={openItems.where}
              onToggle={() => toggleItem('where')}
            >
              <div className="space-y-3 whitespace-pre-line">{tJoin('whereDesc')}</div>
            </HostFAQItem>

            {/* Not sure yet */}
            <HostFAQItem
              title={tJoin('uncertainTitle')}
              isOpen={openItems.uncertain}
              onToggle={() => toggleItem('uncertain')}
            >
              <div className="space-y-3 whitespace-pre-line">{tJoin('uncertainDesc')}</div>
            </HostFAQItem>

            {/* How to apply */}
            <HostFAQItem
              title={tJoin('applyTitle')}
              isOpen={openItems.apply}
              onToggle={() => toggleItem('apply')}
            >
              <div className="space-y-4">
                <p className="whitespace-pre-line">{tJoin('applyDesc')}</p>
              </div>
            </HostFAQItem>
            {/* 固定顯示的 JOIN US CTA */}
            <div className="mt-6">
              <a
                href="https://forms.gle/GjiBkX56ktwtnY2b7"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-3 rounded-full bg-brand-pink text-white font-semibold hover:brightness-110 transition-all uppercase tracking-wider text-sm"
              >
                {tJoin('joinUsBtn')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function JoinUsClient() {
  return (
    <Suspense
      fallback={
        <div className="bg-brand-navy text-white min-h-screen flex items-center justify-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      }
    >
      <JoinUsContent />
    </Suspense>
  );
}
