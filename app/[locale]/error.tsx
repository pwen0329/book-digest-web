'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  useEffect(() => {
    Sentry.captureException(error);
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-3xl font-bold text-white mb-4">{t('title')}</h2>
        <p className="text-white/70 mb-8">
          {t('description')}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-brand-pink text-white font-semibold rounded-full hover:brightness-110 transition-all"
        >
          {t('tryAgain')}
        </button>
      </div>
    </div>
  );
}
