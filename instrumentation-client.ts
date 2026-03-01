import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  
  // Only enable in production
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance monitoring sample rate (10% of transactions)
  tracesSampleRate: 0.1,
  
  // Don't send PII
  sendDefaultPii: false,
  
  // Ignore common non-actionable errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'Load failed',
    'Script error',
    /^NetworkError/,
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
