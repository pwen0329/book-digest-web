'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureException(error);
      });
    }
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="zh">
      <body style={{ backgroundColor: '#0F2E66', color: 'white', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
            <h2 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              發生錯誤 / Something went wrong
            </h2>
            <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
              發生了意外錯誤，請再試一次。<br />A critical error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#FFA6C3',
                color: 'white',
                fontWeight: 600,
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              再試一次 / Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
