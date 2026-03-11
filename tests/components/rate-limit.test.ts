import { describe, expect, it } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

describe('rateLimit', () => {
  it('blocks the request after the in-memory window limit is exceeded', async () => {
    const ip = `test-ip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (let index = 0; index < 10; index += 1) {
      await expect(rateLimit(ip)).resolves.toMatchObject({
        allowed: true,
        retryAfterMs: 0,
      });
    }

    const blocked = await rateLimit(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });
});