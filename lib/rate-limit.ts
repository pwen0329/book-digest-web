/**
 * Sliding-window rate limiter with Redis (Upstash) support.
 * Falls back to in-memory when UPSTASH_REDIS_REST_URL is not configured.
 */
import { Redis } from '@upstash/redis';

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 10;     // max requests per window per IP
const MAX_ENTRIES = 10_000;  // in-memory cap (DoS protection)

// --------------- Redis backend (Upstash) ---------------
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const REDIS_KEY_PREFIX = 'rl:';
const WINDOW_SECONDS = Math.ceil(WINDOW_MS / 1000);

function parseMemberTimestamp(member: string): number | null {
  const [timestamp] = member.split('-', 1);
  const value = Number.parseInt(timestamp, 10);
  return Number.isFinite(value) ? value : null;
}

async function redisRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const key = `${REDIS_KEY_PREFIX}${ip}`;
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

  // Use a pipeline: ZREMRANGEBYSCORE + ZADD + ZCARD + EXPIRE
  const pipe = redis!.pipeline();
  pipe.zremrangebyscore(key, 0, now - WINDOW_MS);   // prune old entries
  pipe.zadd(key, { score: now, member });            // add current
  pipe.zcard(key);                                    // count in window
  pipe.expire(key, WINDOW_SECONDS + 1);              // auto-expire key

  const results = await pipe.exec();
  const count = results[2] as number;

  if (count > MAX_REQUESTS) {
    // Remove the entry we just added (over limit)
    await redis!.zrem(key, member);
    // Get oldest score to calculate retry-after
    const oldest = await redis!.zrange<string[]>(key, 0, 0);
    const oldestTimestamp = oldest.length ? parseMemberTimestamp(oldest[0]) : null;
    const retryAfterMs = oldestTimestamp !== null
      ? Math.max(1000, oldestTimestamp + WINDOW_MS - now)
      : 1000;
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: MAX_REQUESTS - count, retryAfterMs: 0 };
}

// --------------- In-memory fallback ---------------
const requestLog = new Map<string, number[]>();

const cleanupTimer = setInterval(() => {
  cleanupMap();
}, 5 * 60 * 1000);
if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

function cleanupMap(now = Date.now()): void {
  for (const [key, timestamps] of requestLog) {
    const valid = timestamps.filter((t) => now - t < WINDOW_MS);
    if (valid.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, valid);
    }
  }
}

function memoryRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  if (!requestLog.has(ip) && requestLog.size >= Math.floor(MAX_ENTRIES * 0.9)) {
    cleanupMap(now);
  }
  const timestamps = requestLog.get(ip) || [];
  const recent = timestamps.filter((t) => t > now - WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    const retryAfterMs = Math.max(1000, recent[0] + WINDOW_MS - now);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  recent.push(now);

  if (requestLog.size >= MAX_ENTRIES && !requestLog.has(ip)) {
    const firstKey = requestLog.keys().next().value;
    if (firstKey !== undefined) requestLog.delete(firstKey);
  }

  requestLog.set(ip, recent);
  return { allowed: true, remaining: MAX_REQUESTS - recent.length, retryAfterMs: 0 };
}

// --------------- Public API ---------------

/**
 * Rate-limit a request by IP.
 * Uses Redis when configured, otherwise falls back to in-memory.
 */
export async function rateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  if (redis) {
    try {
      return await redisRateLimit(ip);
    } catch (err) {
      console.warn('[rate-limit] Redis error, falling back to memory:', err);
      return memoryRateLimit(ip);
    }
  }
  return memoryRateLimit(ip);
}
