'use client';
import { useState, useEffect, Suspense, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import SignupForm, { SignupFormValues } from '@/components/SignupForm';
import Turnstile from '@/components/Turnstile';
import { BLUR_POSTER } from '@/lib/constants';

type SlotStatus = {
  enabled: boolean;
  open: boolean;
  full: boolean;
  count: number;
  max: number | null;
  reason: 'ok' | 'closed' | 'full';
};

function EngClubContent() {
  const t = useTranslations('events');
  const tSignup = useTranslations('signupFlow');
  const locale = useLocale();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [formValues, setFormValues] = useState<SignupFormValues | null>(null);
  const [bankLast5, setBankLast5] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [slotStatus, setSlotStatus] = useState<SlotStatus | null>(null);
  const [checkingSlot, setCheckingSlot] = useState(false);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const endpoint =
    process.env.NEXT_PUBLIC_FORMS_ENDPOINT_EN || '/api/submit?loc=EN';

  const refreshSlotStatus = useCallback(async () => {
    setCheckingSlot(true);
    try {
      const res = await fetch('/api/submit?loc=EN', { method: 'GET' });
      if (!res.ok) {
        setSlotStatus(null);
        return;
      }
      const data = await res.json();
      setSlotStatus({
        enabled: data.enabled === true,
        open: data.open !== false,
        full: data.full === true,
        count: typeof data.count === 'number' ? data.count : 0,
        max: typeof data.max === 'number' ? data.max : null,
        reason: (data.reason as SlotStatus['reason']) || 'ok',
      });
    } catch {
      setSlotStatus(null);
    } finally {
      setCheckingSlot(false);
    }
  }, []);

  useEffect(() => {
    void refreshSlotStatus();
  }, [refreshSlotStatus]);

  const isSlotBlocked = Boolean(slotStatus?.enabled && (slotStatus.full || !slotStatus.open));
  const blockReason = slotStatus?.reason === 'full' ? 'full' : 'closed';

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
          location: 'EN',
          firstName: formValues.firstName,
          lastName: formValues.lastName,
          name: `${formValues.firstName} ${formValues.lastName}`.trim(),
          age: Number(formValues.age),
          profession: formValues.profession,
          email: formValues.email,
          instagram: formValues.instagram || undefined,
          referral: mapReferral(formValues.referral),
          referralOther: formValues.referral === 'Others' ? formValues.referralOther : undefined,
          bankAccount: bankLast5,
          timestamp: new Date().toISOString(),
          turnstileToken: turnstileToken || undefined,
        }),
      });
      if (resp.status === 409) {
        const conflict = await resp.json().catch(() => ({ reason: 'full' }));
        await refreshSlotStatus();
        setStep(0);
        setSendError(conflict.reason === 'closed' ? tSignup('closedBody') : tSignup('fullBody'));
        setSending(false);
        return;
      }
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
        {/* Back to Events */}
        <div className="mb-8">
          <Link
            href={`/${locale}/events`}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-brand-pink transition-colors font-outfit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('backToEvents')}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-stretch max-w-6xl mx-auto">
          {/* Poster */}
          <div className="flex justify-center lg:justify-end">
            <div
              className="relative w-full max-w-[480px] lg:w-[480px] h-auto rounded-xl overflow-hidden shadow-xl"
              style={{ aspectRatio: '4/5' }}
            >
              <Image
                src="/images/elements/poster_202604_en_online.webp"
                alt={t('onlineTitle')}
                fill
                sizes="(max-width: 1024px) 420px, 50vw"
                className="object-cover"
                priority
                placeholder="blur"
                blurDataURL={BLUR_POSTER}
              />
            </div>
          </div>

          {/* Form */}
          <div className="flex justify-center lg:justify-start">
            <div className="w-full max-w-[700px] rounded-2xl p-6 lg:p-8 bg-white/20 backdrop-blur-xl">
              {step === 0 && (
                isSlotBlocked ? (
                  <div className="rounded-xl border border-brand-pink/50 bg-white/10 p-6 text-white">
                    <h3 className="text-2xl font-bold mb-2">
                      {blockReason === 'full' ? tSignup('fullTitle') : tSignup('closedTitle')}
                    </h3>
                    <p className="text-white/90 whitespace-pre-line">
                      {blockReason === 'full' ? tSignup('fullBody') : tSignup('closedBody')}
                    </p>
                  </div>
                ) : checkingSlot ? (
                  <div className="text-white/80">Checking availability...</div>
                ) : (
                  <SignupForm
                    location="EN"
                    onComplete={(vals) => {
                      setFormValues(vals);
                      setStep(1);
                    }}
                  />
                )
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
                      <a
                        href="https://mobile.richart.tw/TSDIB_RichartWeb/RC04/RC040300?token=88084B8A2C7A93B4DC6FB4D553667015"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-brand-pink inline-block mt-1"
                      >
                        {tSignup('richartLinkText')}
                      </a>
                    </p>
                  </div>
                  <p className="mt-4 text-white/90">{tSignup('remitPrompt')}</p>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-white mb-2">
                      {tSignup('last5Label')}
                    </label>
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
                  <Turnstile onVerify={handleTurnstileVerify} onExpire={handleTurnstileExpire} />
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
      </div>
    </section>
  );
}

export default function EngClubClient() {
  return (
    <Suspense
      fallback={
        <div className="bg-brand-navy text-white min-h-screen flex items-center justify-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      }
    >
      <EngClubContent />
    </Suspense>
  );
}
