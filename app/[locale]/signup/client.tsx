'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import SignupForm from '@/components/SignupForm';
import { BLUR_POSTER } from '@/lib/constants';

function SignupContent() {
  const t = useTranslations('events');
  const searchParams = useSearchParams();
  const [activeLocation, setActiveLocation] = useState<'TW' | 'NL'>('TW');

  // 保留舊版：從 URL 讀取地點參數
  useEffect(() => {
    const loc = searchParams.get('location');
    if (loc === 'NL' || loc === 'TW') {
      setActiveLocation(loc);
    }
  }, [searchParams]);

  const locationLocked = searchParams.get('location') !== null;
  const formBgClass = 'bg-white/20 backdrop-blur-xl rounded-2xl';

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        {!locationLocked && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold font-outfit">
                {t('joinBookClub')}
              </h1>
              <p className="mt-2 text-white/70">
                {t('chooseLocation')}
              </p>
            </div>

            {/* 地點切換 */}
            <div className="mb-8">
              <div className="inline-flex bg-white/10 rounded-full p-1">
                <button
                  onClick={() => setActiveLocation('TW')}
                  className={`px-5 py-2 rounded-full font-medium transition-all text-sm ${
                    activeLocation === 'TW'
                      ? 'bg-brand-pink text-brand-navy'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {t('taiwan')}
                </button>
                <button
                  onClick={() => setActiveLocation('NL')}
                  className={`px-5 py-2 rounded-full font-medium transition-all text-sm ${
                    activeLocation === 'NL'
                      ? 'bg-brand-pink text-brand-navy'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {t('netherlands')}
                </button>
              </div>
            </div>
          </>
        )}

        {/* 舊版：左海報 + 右表單 */}
        <div className="grid grid-cols-1 lg:grid-cols-[600px_1fr] gap-6 lg:gap-10 items-stretch max-w-6xl mx-auto">
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[600px] lg:w-[600px] h-auto rounded-2xl overflow-hidden shadow-xl" style={{ aspectRatio: '750/570' }}>
              <Image
                src={activeLocation === 'TW' ? '/images/elements/AD-16.png' : '/images/elements/AD-15.png'}
                alt={activeLocation === 'TW' ? 'Taiwan Book Club' : 'Netherlands Book Club'}
                fill
                sizes="(max-width: 1024px) 420px, 50vw"
                className="object-cover"
                placeholder="blur"
                blurDataURL={BLUR_POSTER}
              />
            </div>
          </div>

          <div className="flex justify-center lg:justify-start">
            <div className={`w-full max-w-[700px] rounded-2xl p-6 lg:p-8 transition-colors duration-300 ${formBgClass}`}>
              <SignupForm
                key={activeLocation}
                location={activeLocation}
                endpoint={
                  activeLocation === 'TW'
                    ? process.env.NEXT_PUBLIC_FORMS_ENDPOINT_TW || '/api/submit?loc=TW'
                    : process.env.NEXT_PUBLIC_FORMS_ENDPOINT_NL || '/api/submit?loc=NL'
                }
              />
            </div>
          </div>
        </div>

        {/* 移除 Detox 區段：/detox 為獨立頁 */}
      </div>
    </section>
  );
}

export default function SignupClient() {
  return (
    <Suspense
      fallback={
        <div className="bg-brand-navy text-white min-h-screen flex items-center justify-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
