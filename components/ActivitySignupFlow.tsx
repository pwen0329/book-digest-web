'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import SignupForm from '@/components/SignupForm';
import Turnstile from '@/components/Turnstile';
import ActivitySignupTabs from '@/components/ActivitySignupTabs';
import { BLUR_POSTER } from '@/lib/constants';
import { mapClientReferralToApi, type SignupFormValues, type SignupLocation } from '@/lib/signup';

type SlotStatus = {
  enabled: boolean;
  open: boolean;
  full: boolean;
  count: number;
  max: number | null;
  reason: 'ok' | 'closed' | 'full';
};

type ActivityTab = 'TW' | 'EN' | 'NL' | 'DETOX';

type ActivitySignupFlowProps = {
  activeTab: ActivityTab;
  location: SignupLocation;
  posterSrc: string;
  posterAlt: string;
  translationNamespace: 'signupFlow' | 'detoxSignupFlow';
  endpoint?: string;
  posterPriority?: boolean;
  renderIntro?: (step: 0 | 1 | 2 | 3) => ReactNode;
  comingSoon?: {
    title: string;
    body?: string;
  };
};

export default function ActivitySignupFlow({
  activeTab,
  location,
  posterSrc,
  posterAlt,
  translationNamespace,
  endpoint,
  posterPriority = false,
  renderIntro,
  comingSoon,
}: ActivitySignupFlowProps) {
  const tEvents = useTranslations('events');
  const tSignup = useTranslations(translationNamespace);
  const locale = useLocale();
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [formValues, setFormValues] = useState<SignupFormValues | null>(null);
  const [bankLast5, setBankLast5] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [slotStatus, setSlotStatus] = useState<SlotStatus | null>(null);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const slotRequestRef = useRef<AbortController | null>(null);
  const submitRequestRef = useRef<AbortController | null>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const submitEndpoint = endpoint || `/api/submit?loc=${location}`;

  const refreshSlotStatus = useCallback(async () => {
    slotRequestRef.current?.abort();
    const controller = new AbortController();
    slotRequestRef.current = controller;
    setCheckingSlot(true);
    setSlotError(null);
    try {
      const res = await fetch(`/api/submit?loc=${location}`, { method: 'GET', signal: controller.signal });
      if (!res.ok) {
        setSlotStatus(null);
        setSlotError(tSignup('slotCheckError'));
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data || typeof data !== 'object') {
        setSlotStatus(null);
        setSlotError(tSignup('slotCheckError'));
        return;
      }

      setSlotStatus({
        enabled: data.enabled === true,
        open: data.open !== false,
        full: data.full === true,
        count: typeof data.count === 'number' ? data.count : 0,
        max: typeof data.max === 'number' ? data.max : null,
        reason: (data.reason as SlotStatus['reason']) || 'ok',
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setSlotStatus(null);
      setSlotError(tSignup('slotCheckError'));
    } finally {
      if (slotRequestRef.current === controller) {
        slotRequestRef.current = null;
        setCheckingSlot(false);
      }
    }
  }, [location, tSignup]);

  useEffect(() => {
    if (comingSoon) return;
    void refreshSlotStatus();
  }, [comingSoon, refreshSlotStatus]);

  useEffect(() => () => {
    slotRequestRef.current?.abort();
    submitRequestRef.current?.abort();
  }, []);

  const isSlotBlocked = Boolean(slotStatus?.enabled && (slotStatus.full || !slotStatus.open));
  const blockReason = slotStatus?.reason === 'full' ? 'full' : 'closed';
  const formBgClass = 'bg-white/20 backdrop-blur-xl rounded-2xl';
  const cancelTitle = tSignup('cancelTitle');
  const cancelBody = tSignup('cancelBody');
  const contact = tSignup('contact');

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

      submitRequestRef.current?.abort();
      const controller = new AbortController();
      submitRequestRef.current = controller;

      const resp = await fetch(submitEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          location,
          name: formValues.name,
          age: Number(formValues.age),
          profession: formValues.profession,
          email: formValues.email,
          instagram: formValues.instagram || undefined,
          referral: mapClientReferralToApi(formValues.referral),
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
      submitRequestRef.current = null;
      setStep(3);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setSendError(tSignup('genericError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-brand-navy text-white min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="mb-8">
          <Link
            href={`/${locale}/events`}
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-brand-pink transition-colors font-outfit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {tEvents('backToEvents')}
          </Link>
        </div>

        <ActivitySignupTabs activeTab={activeTab} />
        {renderIntro ? renderIntro(step) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-stretch max-w-6xl mx-auto">
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[480px] lg:w-[480px] h-auto rounded-xl overflow-hidden shadow-xl" style={{ aspectRatio: '4/5' }}>
              <Image
                src={posterSrc}
                alt={posterAlt}
                fill
                sizes="(max-width: 1024px) 420px, 50vw"
                className="object-cover"
                priority={posterPriority}
                placeholder="blur"
                blurDataURL={BLUR_POSTER}
              />
            </div>
          </div>

          <div className="flex justify-center lg:justify-start">
            <div className={comingSoon ? 'flex w-full max-w-[700px] flex-col justify-start py-6 lg:py-10' : `w-full max-w-[700px] rounded-2xl p-6 lg:p-8 transition-colors duration-300 ${formBgClass}`}>
              {comingSoon ? (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold font-outfit leading-tight">{comingSoon.title}</h1>
                  </div>
                  {comingSoon.body ? <p className="font-bold text-white text-lg font-outfit whitespace-pre-line">{comingSoon.body}</p> : null}
                </div>
              ) : (
                <>
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
                      <div className="text-white/80">{tSignup('checkingAvailability')}</div>
                    ) : slotError ? (
                      <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-6 text-red-100">
                        {slotError}
                      </div>
                    ) : (
                      <SignupForm
                        key={location}
                        location={location}
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
                        <label htmlFor="bank-last-5" className="block text-sm font-medium text-white mb-2">{tSignup('last5Label')}</label>
                        <input
                          id="bank-last-5"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={5}
                          value={bankLast5}
                          onChange={(e) => setBankLast5(e.target.value.replace(/\D/g, '').slice(0, 5))}
                          className="w-full rounded-lg bg-white px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-pink transition-colors"
                          placeholder={tSignup('last5Placeholder')}
                        />
                        {sendError ? <p className="mt-2 text-sm text-red-300">{sendError}</p> : null}
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
                      {cancelTitle ? <h4 className="mt-6 font-semibold">{cancelTitle}</h4> : null}
                      {cancelBody ? <p className="mt-1 whitespace-pre-line text-white">{cancelBody}</p> : null}
                      {contact ? <p className="mt-4 text-white">{contact}</p> : null}
                      {contact ? <p className="text-white">📩 bookdigest2020@gmail.com</p> : null}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}