// Guard: Next.js calls register() once, but during HMR the module can be
// re-evaluated. A module-level flag prevents Sentry from adding duplicate
// listeners to the HTTP Server on each reload (MaxListenersExceededWarning).
let registered = false;

export async function register() {
  if (registered) return;

  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  registered = true;

  // Dynamic import: load Sentry only for production Node.js requests.
  const { init } = await import('@sentry/nextjs');
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: true,
    tracesSampleRate: 0.1,
  });
}
