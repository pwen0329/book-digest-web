'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { z } from 'zod';
import Turnstile from '@/components/Turnstile';
import { EMPTY_SIGNUP_FORM_VALUES, mapClientReferralToApi, restoreSignupFormValues, type SignupFormValues, type SignupLocation } from '@/lib/signup';

export type SignupFormProps = {
  location: SignupLocation;
  endpoint?: string;
  disabled?: boolean;
  // When provided, form will validate and call onComplete instead of submitting.
  onComplete?: (values: SignupFormValues) => void;
};

// Move schema to module level for better performance (only created once)
const baseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  age: z
    .string()
    .transform((v) => (v.trim() === '' ? NaN : Number(v)))
    .refine((n) => Number.isInteger(n) && n >= 13 && n <= 120, {
      message: 'Age must be an integer between 13 and 120',
    }),
  profession: z.string().min(1, 'Profession is required').max(120),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email'),
  instagram: z.string().optional(),
  referral: z.enum(['BookDigestIG', 'BookDigestFB', 'Others']),
  referralOther: z.string().optional(),
  website: z.string().optional(),
});

// Pre-built schema with superRefine (module level, created once)
const formSchema = baseSchema.superRefine((data, ctx) => {
  if (data.referral === 'Others') {
    if (!data.referralOther || data.referralOther.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['referralOther'],
        message: 'Please specify at least 2 characters',
      });
    }
  }
});

export default function SignupForm({ location, endpoint, onComplete, disabled = false }: SignupFormProps) {
  const t = useTranslations('form');
  const tEvents = useTranslations('events');
  const locale = useLocale();
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<null | 'ok' | 'error'>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const submitRequestRef = useRef<AbortController | null>(null);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const storageKey = `signup-form-${location}`;

  const [values, setValues] = useState<SignupFormValues>({ ...EMPTY_SIGNUP_FORM_VALUES });

  const persistValues = useCallback((nextValues: SignupFormValues) => {
    if (!hasRestoredState) {
      return;
    }

    try {
      const toSave = { ...nextValues };
      delete toSave.website;
      sessionStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (error) {
      console.warn('[signup] Failed to persist form state.', error);
    }
  }, [hasRestoredState, storageKey]);

  useEffect(() => {
    let restoredValues = { ...EMPTY_SIGNUP_FORM_VALUES };

    try {
      restoredValues = restoreSignupFormValues(sessionStorage.getItem(storageKey));
    } catch (error) {
      console.warn('[signup] Failed to restore saved form state.', error);
    }

    setValues(restoredValues);
    setHasRestoredState(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hasRestoredState) return;
    persistValues(values);
  }, [hasRestoredState, persistValues, values]);

  useEffect(() => () => {
    if (submitRequestRef.current && typeof submitRequestRef.current.abort === 'function') {
      submitRequestRef.current.abort();
    }
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (disabled) return;
    const target = e.target as HTMLInputElement & HTMLSelectElement;
    const { name } = target;
    const isCheckbox = (target as HTMLInputElement).type === 'checkbox';
    const nextValue = isCheckbox ? (target as HTMLInputElement).checked : target.value;
    setValues((currentValues) => {
      const nextValues = { ...currentValues, [name]: nextValue };
      persistValues(nextValues);
      return nextValues;
    });
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (disabled) return;
    setSubmitting(true);
    setSuccess(null);

    const res = formSchema.safeParse(values);
    if (!res.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of res.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setSubmitting(false);
      return;
    }

    if (values.website && values.website.trim().length > 0) {
      setSuccess('ok');
      setSubmitting(false);
      setValues({ ...EMPTY_SIGNUP_FORM_VALUES });
      try {
        sessionStorage.removeItem(storageKey);
      } catch (error) {
        console.warn('[signup] Failed to clear saved form state.', error);
      }
      return;
    }

    // If onComplete is provided (wizard mode), just validate and pass values up
    if (typeof onComplete === 'function') {
      onComplete(values);
      setSubmitting(false);
      return;
    }

    try {
      if (endpoint) {
        submitRequestRef.current?.abort();
        const controller = new AbortController();
        submitRequestRef.current = controller;
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            location,
            locale,
            name: values.name,
            age: Number(values.age),
            profession: values.profession,
            email: values.email,
            instagram: values.instagram || undefined,
            referral: mapClientReferralToApi(values.referral),
            referralOther: values.referral === 'Others' ? values.referralOther : undefined,
            timestamp: new Date().toISOString(),
            turnstileToken: turnstileToken || undefined,
          }),
        });
        if (!resp.ok) throw new Error('Request failed');
        submitRequestRef.current = null;
      } else {
        await new Promise((r) => setTimeout(r, 800));
      }

      setSuccess('ok');
      setTurnstileToken(null);
      setValues({ ...EMPTY_SIGNUP_FORM_VALUES });
      try {
        sessionStorage.removeItem(storageKey);
      } catch (error) {
        console.warn('[signup] Failed to clear saved form state.', error);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setSuccess('error');
    } finally {
      setSubmitting(false);
    }
  };

  // Unified white input style
  const inputClass = (hasError: boolean) =>
    `w-full rounded-lg bg-white px-4 py-3 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-pink transition-colors ${hasError ? 'ring-2 ring-red-400' : ''}`;

  // Location badge colors
  const locationBadgeClass = location === 'TW'
    ? 'bg-[#FFDD57] text-brand-navy'
    : location === 'EN'
      ? 'bg-emerald-400 text-brand-navy'
      : location === 'DETOX'
        ? 'bg-cyan-300 text-brand-navy'
      : 'bg-brand-pink text-brand-navy';

  const locationLabel = location === 'TW'
    ? tEvents('taiwan')
    : location === 'NL'
      ? tEvents('netherlands')
      : location === 'EN'
        ? tEvents('english')
        : tEvents('detoxTitle');
  const isInputDisabled = disabled;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-lg font-semibold text-white">
          {tEvents('signUp')}
        </h3>
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${locationBadgeClass}`}>
          📍 {locationLabel}
        </span>
      </div>

      {(!onComplete && success === 'ok') ? (
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 p-4" role="status">
          {t('success')}
        </div>
      ) : (!onComplete && success === 'error') ? (
        <div className="rounded-lg bg-red-500/15 border border-red-400/30 text-red-200 p-4" role="alert">
          <p>{t('error')}</p>
          <p className="mt-2 text-sm">
            {locale === 'zh' ? '或直接寄信給我們：' : 'Or email us directly: '}
            <a
              href="mailto:bookdigest2020@gmail.com?subject=Book%20Digest%20Inquiry"
              className="underline hover:text-white"
            >
              bookdigest2020@gmail.com
            </a>
          </p>
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit} noValidate data-form-ready={hasRestoredState ? 'true' : 'false'}>
        {/* Honeypot */}
        <input
          type="text"
          name="website"
          value={values.website}
          onChange={onChange}
          className="hidden"
          style={{ display: 'none', visibility: 'hidden', position: 'absolute', left: '-9999px' }}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white mb-2">{t('nameLabel')}</label>
            <input
              id="name" name="name" value={values.name} onChange={onChange}
              disabled={isInputDisabled}
              className={inputClass(!!errors.name)}
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && <p id="name-error" className="mt-1 text-xs text-red-300" aria-live="polite">{errors.name}</p>}
          </div>

          {/* Age */}
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-white mb-2">{t('ageLabel')}</label>
            <input
              id="age" name="age" inputMode="numeric" pattern="[0-9]*" value={values.age} onChange={onChange}
              disabled={isInputDisabled}
              className={inputClass(!!errors.age)}
              aria-invalid={errors.age ? true : undefined}
              aria-describedby={errors.age ? 'age-error' : undefined}
            />
            {errors.age && <p id="age-error" className="mt-1 text-xs text-red-300" aria-live="polite">{errors.age}</p>}
          </div>

          {/* Profession */}
          <div>
            <label htmlFor="profession" className="block text-sm font-medium text-white mb-2">{t('professionLabel')}</label>
            <input
              id="profession" name="profession" value={values.profession} onChange={onChange}
              disabled={isInputDisabled}
              className={inputClass(!!errors.profession)}
              aria-invalid={errors.profession ? true : undefined}
              aria-describedby={errors.profession ? 'profession-error' : undefined}
            />
            {errors.profession && <p id="profession-error" className="mt-1 text-xs text-red-300" aria-live="polite">{errors.profession}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white mb-2">{t('emailLabel')}</label>
            <input
              id="email" name="email" type="email" value={values.email} onChange={onChange}
              disabled={isInputDisabled}
              className={inputClass(!!errors.email)}
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && <p id="email-error" className="mt-1 text-xs text-red-300" aria-live="polite">{errors.email}</p>}
          </div>
        </div>

        {/* Instagram - Full width */}
        <div>
          <label htmlFor="instagram" className="block text-sm font-medium text-white mb-2">{t('instagramLabel')}</label>
          <input
            id="instagram" name="instagram" value={values.instagram} onChange={onChange}
            disabled={isInputDisabled}
            className={inputClass(false)}
            placeholder="bookdigest_tw"
          />
        </div>

        {/* Referral */}
        <div>
          <label htmlFor="referral" className="block text-sm font-medium text-white mb-2">{t('referralLabel')}</label>
          <select
            id="referral" name="referral" value={values.referral} onChange={onChange}
            disabled={isInputDisabled}
            className={`${inputClass(false)} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23666%22%3E%3Cpath%20stroke-linecap%3D%22round%20stroke-linejoin%3D%22round%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_1rem_center] bg-[length:1.25rem]`}
          >
            <option value="BookDigestIG">{t('referralBookDigestIG')}</option>
            <option value="BookDigestFB">{t('referralBookDigestFB')}</option>
            <option value="Others">{t('referralOthers')}</option>
          </select>
        </div>

        {/* Reserve space for referralOther to prevent layout shift */}
        <div className={`transition-all duration-200 overflow-hidden ${values.referral === 'Others' ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div>
            <label htmlFor="referralOther" className="block text-sm font-medium text-white mb-2">{t('referralOtherLabel')}</label>
            <input
              id="referralOther" name="referralOther" value={values.referralOther} onChange={onChange}
              disabled={isInputDisabled}
              className={inputClass(!!errors.referralOther)}
              placeholder={t('referralOtherPlaceholder')}
              aria-invalid={errors.referralOther ? true : undefined}
              aria-describedby={errors.referralOther ? 'referralOther-error' : undefined}
            />
            {errors.referralOther && <p id="referralOther-error" className="mt-1 text-xs text-red-300" aria-live="polite">{errors.referralOther}</p>}
          </div>
        </div>

        {/* Turnstile CAPTCHA — only in direct submission mode, not wizard mode */}
        {!disabled && !onComplete && <Turnstile onVerify={handleTurnstileVerify} onExpire={handleTurnstileExpire} />}

        {/* Submit */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={submitting || disabled || !hasRestoredState}
            className={`inline-flex items-center rounded-full bg-brand-pink text-white px-6 py-2.5 font-semibold shadow hover:brightness-110 transition-all disabled:opacity-60 ${locale === 'zh' ? 'tracking-widest' : ''}`}
          >
            {submitting ? t('submitting') : t('submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
