export function cryptoRandomId(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') return g.crypto.randomUUID!();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
