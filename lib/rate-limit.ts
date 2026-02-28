/**
 * Simple in-memory sliding window rate limiter.
 * NOTE: This works per-server-instance. For multi-instance deployments,
 * use Redis-based rate limiting instead.
 */

const windowMs = 60 * 1000; // 1 minute window
const maxRequests = 10; // max requests per window per IP

const requestLog = new Map<string, number[]>();

// Cleanup stale entries every 5 minutes
// .unref() prevents this timer from keeping the Node.js process alive during SSG builds
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestLog) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, valid);
    }
  }
}, 5 * 60 * 1000);
if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

export function rateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = requestLog.get(ip) || [];
  const windowStart = now - windowMs;

  // Filter to only timestamps within window
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  recent.push(now);
  requestLog.set(ip, recent);
  return { allowed: true, remaining: maxRequests - recent.length };
}
