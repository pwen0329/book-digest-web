import 'server-only';

type LogLevel = 'info' | 'warn' | 'error';

type StructuredPayload = Record<string, unknown>;

function formatLog(level: LogLevel, event: string, payload: StructuredPayload = {}) {
  return JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

async function captureWithSentry(level: LogLevel, event: string, payload: StructuredPayload, error?: unknown) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  try {
    const Sentry = await import('@sentry/nextjs');
    if (error instanceof Error) {
      Sentry.captureException(error, {
        tags: { event, level },
        extra: payload,
      });
      return;
    }

    Sentry.captureMessage(event, level === 'error' ? 'error' : level === 'warn' ? 'warning' : 'info');
  } catch {
    // Ignore Sentry transport errors and rely on structured logs.
  }
}

export function logServerEvent(level: LogLevel, event: string, payload: StructuredPayload = {}) {
  const line = formatLog(level, event, payload);
  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.info(line);
}

export async function logServerError(event: string, error: unknown, payload: StructuredPayload = {}) {
  const normalizedPayload = {
    ...payload,
    errorMessage: error instanceof Error ? error.message : String(error),
  };
  logServerEvent('error', event, normalizedPayload);
  await captureWithSentry('error', event, normalizedPayload, error);
}

export async function logServerWarning(event: string, payload: StructuredPayload = {}) {
  logServerEvent('warn', event, payload);
  await captureWithSentry('warn', event, payload);
}