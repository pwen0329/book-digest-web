// Guard: Next.js calls register() once, but during HMR the module can be
// re-evaluated. A module-level flag prevents Sentry from adding duplicate
// listeners to the HTTP Server on each reload (MaxListenersExceededWarning).
let registered = false;

export async function register() {
  if (registered) return;
  registered = true;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import: load Sentry only in the Node.js runtime, not edge.
    const { init } = await import('@sentry/nextjs');
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
}
