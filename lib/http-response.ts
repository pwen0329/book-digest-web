export function getRetryAfterSeconds(retryAfterMs: number): string {
  if (!Number.isFinite(retryAfterMs) || retryAfterMs <= 0) {
    return '1';
  }

  return String(Math.max(1, Math.ceil(retryAfterMs / 1000)));
}