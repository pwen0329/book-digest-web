/**
 * Wrapper around fetch() that aborts after a specified timeout.
 * Prevents hanging requests to external services (Tally, Notion, Turnstile).
 */
export function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = 10_000, ...fetchInit } = init || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...fetchInit, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}
