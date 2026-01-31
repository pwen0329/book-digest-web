'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import SignupForm, { SignupFormValues } from '@/components/SignupForm';
import { BLUR_POSTER } from '@/lib/constants';

function SignupContent() {
  const t = useTranslations('events');
  const tSignup = useTranslations('signupFlow');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [activeLocation, setActiveLocation] = useState<'TW' | 'NL'>('TW');
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [formValues, setFormValues] = useState<SignupFormValues | null>(null);
  const [bankLast5, setBankLast5] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // 保留舊版：從 URL 讀取地點參數
  useEffect(() => {
    const loc = searchParams.get('location');
    if (loc === 'NL' || loc === 'TW') {
      setActiveLocation(loc);
    }
  }, [searchParams]);

  const locationLocked = searchParams.get('location') !== null;
  const formBgClass = 'bg-white/20 backdrop-blur-xl rounded-2xl';

  const endpoint =
    activeLocation === 'TW'
      ? process.env.NEXT_PUBLIC_FORMS_ENDPOINT_TW || '/api/submit?loc=TW'
      : process.env.NEXT_PUBLIC_FORMS_ENDPOINT_NL || '/api/submit?loc=NL';

  const mapReferral = (ref: SignupFormValues['referral']): 'Instagram' | 'Facebook' | 'Others' => {
    if (ref === 'BookDigestIG') return 'Instagram';
    if (ref === 'BookDigestFB') return 'Facebook';
    return 'Others';
  };

  const handleFinalize = async () => {
    if (!formValues) return;
    setSending(true);
    setSendError(null);
    try {
      if (!/^[0-9]{5}$/.test(bankLast5)) {
        setSendError(tSignup('last5Error'));
        setSending(false);
        return;
      }
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: activeLocation,
          name: formValues.name,
          age: Number(formValues.age),
          profession: formValues.profession,
          email: formValues.email,
          instagram: formValues.instagram || undefined,
          referral: mapReferral(formValues.referral),
          referralOther: formValues.referral === 'Others' ? formValues.referralOther : undefined,
          bankAccount: bankLast5,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!resp.ok) throw new Error('Request failed');
      setStep(3);
    } catch {
      setSendError(tSignup('genericError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        {!locationLocked && step === 0 && (
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
            <div className="relative w-full max-w-[600px] lg:w-[600px] h-auto rounded-2xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/5' }}>
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
              {step === 0 && (
                <SignupForm
                  key={activeLocation}
                  location={activeLocation}
                  onComplete={(vals) => {
                    setFormValues(vals);
                    setStep(1);
                  }}
                />
              )}

              {step === 1 && (
                <div className="text-white flex flex-col min-h-[300px] justify-between py-6">
                  <div>
                    <h3 className="text-xl font-bold mb-4">{tSignup('thanksTitle')}</h3>
                    <p className="whitespace-pre-line text-white">{tSignup('thanksBody')}</p>
                  </div>
                  <div className="pt-6">
                    <button
                      onClick={() => setStep(2)}
                      className={`inline-flex items-center rounded-full bg-brand-pink text-white px-6 py-2.5 font-semibold shadow hover:brightness-110 transition-all ${locale === 'zh' ? 'tracking-widest' : ''}`}
                    >
                      {tSignup('next')}
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="text-white">
                  <h3 className="text-xl font-bold mb-4">{tSignup('remitTitle')}</h3>
                  <div className="space-y-1 text-white/90">
                    <p>{tSignup('bank')}</p>
                    <p>{tSignup('account')}</p>
                    <p>
                      <span className="block">{tSignup('richartPrefix')}</span>
                      <a href="https://mobile.richart.tw/TSDIB_RichartWeb/RC04/RC040300?token=88084B8A2C7A93B4DC6FB4D553667015" target="_blank" rel="noopener noreferrer" className="underline text-brand-pink inline-block mt-1">
                        {tSignup('richartLinkText')}
                      </a>
                    </p>
                  </div>
                  <p className="mt-4 text-white/90">{tSignup('remitPrompt')}</p>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-white mb-2">{tSignup('last5Label')}</label>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={5}
                      value={bankLast5}
                      onChange={(e) => setBankLast5(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      className="w-full rounded-lg bg-white px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-pink transition-colors"
                      placeholder={tSignup('last5Placeholder')}
                    />
                    {sendError && <p className="mt-2 text-sm text-red-300">{sendError}</p>}
                  </div>
                  <div className="pt-6">
                    <button
                      onClick={handleFinalize}
                      disabled={sending}
                      className={`inline-flex items-center rounded-full bg-brand-pink text-white px-6 py-2.5 font-semibold shadow hover:brightness-110 transition-all disabled:opacity-60 ${locale === 'zh' ? 'tracking-widest' : ''}`}
                    >
                      {sending ? tSignup('submitting') : tSignup('submitPayment')}
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="text-white">
                  <h3 className="text-xl font-bold mb-4">{tSignup('successTitle')}</h3>
                  <p className="whitespace-pre-line text-white">{tSignup('successBody')}</p>
                  <h4 className="mt-6 font-semibold">{tSignup('cancelTitle')}</h4>
                  <p className="mt-1 whitespace-pre-line text-white">{tSignup('cancelBody')}</p>
                  <p className="mt-4 text-white">{tSignup('contact')}</p>
                  <p className="text-white">📩 bookdigest2020@gmail.com</p>
                </div>
              )}
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
