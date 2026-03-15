import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

type LogLevel = 'info' | 'warn' | 'error';

type StructuredPayload = Record<string, unknown>;

type RequestTraceContext = {
  requestId: string;
  traceId: string;
  route: string;
  method: string;
};

const requestTraceStore = new AsyncLocalStorage<RequestTraceContext>();

function getRequestTraceContext(): RequestTraceContext | undefined {
  return requestTraceStore.getStore();
}

function formatLog(level: LogLevel, event: string, payload: StructuredPayload = {}) {
  const context = getRequestTraceContext();
  return JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    requestId: context?.requestId,
    traceId: context?.traceId,
    route: context?.route,
    method: context?.method,
    ...payload,
  });
}

async function captureWithSentry(_level?: LogLevel, _event?: string, _payload?: StructuredPayload, _error?: unknown) {
  // Structured logs plus request-tracing are the primary server-side signal.
  // Sentry SDK bootstrap stays in instrumentation.ts / instrumentation-client.ts
  // to avoid pulling OpenTelemetry tracing helpers into every API route bundle.
  void _level;
  void _event;
  void _payload;
  void _error;
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

export function getOrCreateRequestId(request: Pick<NextRequest, 'headers'> | { headers: Headers }): string {
  return request.headers.get('x-request-id') || randomUUID();
}

export async function runWithRequestTrace<T>(request: Pick<NextRequest, 'headers' | 'method' | 'nextUrl' | 'url'>, operation: string, work: () => Promise<T>): Promise<T> {
  const requestId = getOrCreateRequestId(request);
  const route = request.nextUrl.pathname;
  const context: RequestTraceContext = {
    requestId,
    traceId: requestId,
    route,
    method: request.method,
  };

  return requestTraceStore.run(context, async () => {
    const startedAt = Date.now();
    logServerEvent('info', `${operation}.start`);
    try {
      const result = await work();
      logServerEvent('info', `${operation}.finish`, { durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      logServerEvent('error', `${operation}.finish`, {
        durationMs: Date.now() - startedAt,
        outcome: 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}

export async function traceServerSpan<T>(span: string, payload: StructuredPayload = {}, work: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  logServerEvent('info', `${span}.span_start`, payload);
  try {
    const result = await work();
    logServerEvent('info', `${span}.span_finish`, { ...payload, durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    logServerEvent('error', `${span}.span_finish`, {
      ...payload,
      durationMs: Date.now() - startedAt,
      outcome: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
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