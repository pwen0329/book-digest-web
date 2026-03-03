import { Redis } from '@upstash/redis';
import capacityConfig from '@/data/signup-capacity.json';

type Location = 'TW' | 'NL';

type SlotConfig = {
  enabled: boolean;
  forceFull?: boolean;
  startAt?: Date;
  endAt?: Date;
  max?: number;
  key?: string;
};

type ConfigSlot = {
  enabled?: boolean;
  forceFull?: boolean;
  startAt?: string;
  endAt?: string;
  max?: number;
};

type CapacityConfigFile = {
  TW?: ConfigSlot;
  NL?: ConfigSlot;
};

export type CapacityStatus = {
  enabled: boolean;
  open: boolean;
  full: boolean;
  count: number;
  max: number | null;
  startAt: string | null;
  endAt: string | null;
  reason: 'ok' | 'closed' | 'full';
};

export type ReserveResult = {
  allowed: boolean;
  reason: 'ok' | 'closed' | 'full';
  reservationId?: string;
};

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const memoryCounts = new Map<string, number>();
// Temporary max overrides used only in non-production environments (testing).
const memoryMaxOverrides = new Map<string, number>();
// Temporary forceFull overrides keyed by location (testing only).
const memoryForceFullOverrides = new Map<string, boolean>();

/**
 * Reset in-memory count for a location and optionally override its max.
 * Also clears any forceFull override for the location.
 * Only available in non-production environments.
 */
export function _resetCountForTesting(location: Location, tempMax?: number): void {
  if (process.env.ALLOW_CAPACITY_RESET !== '1') return;
  memoryForceFullOverrides.delete(location);
  const config = parseSlotConfig(location);
  if (config.key) {
    memoryCounts.set(config.key, 0);
    if (tempMax !== undefined) {
      memoryMaxOverrides.set(config.key, tempMax);
    } else {
      memoryMaxOverrides.delete(config.key);
    }
  }
}

/**
 * Override forceFull for a location at runtime.
 * Only available in non-production environments.
 */
export function _setForceFullForTesting(location: Location, value: boolean): void {
  if (process.env.ALLOW_CAPACITY_RESET !== '1') return;
  memoryForceFullOverrides.set(location, value);
}

function getConfigSlot(location: Location): ConfigSlot {
  const fileConfig = capacityConfig as CapacityConfigFile;
  return fileConfig[location] || {};
}

function parseSlotConfig(location: Location): SlotConfig {
  const configSlot = getConfigSlot(location);

  const prefix = `SIGNUP_SLOT_${location}`;
  const enabledRaw = process.env[`${prefix}_ENABLED`];
  const forceFullRaw = process.env[`${prefix}_FORCE_FULL`];
  const startRaw = process.env[`${prefix}_START_AT`] || configSlot.startAt;
  const endRaw = process.env[`${prefix}_END_AT`] || configSlot.endAt;
  const maxRaw = process.env[`${prefix}_MAX`] || (typeof configSlot.max === 'number' ? String(configSlot.max) : undefined);
  const enabled = enabledRaw !== undefined
    ? enabledRaw === '1' || enabledRaw.toLowerCase() === 'true'
    : configSlot.enabled === true;
  const forceFull = memoryForceFullOverrides.has(location)
    ? memoryForceFullOverrides.get(location)!
    : forceFullRaw !== undefined
      ? forceFullRaw === '1' || forceFullRaw.toLowerCase() === 'true'
      : configSlot.forceFull === true;

  if (!enabled) {
    return { enabled: false };
  }

  if (!startRaw || !endRaw || !maxRaw) {
    return { enabled: false };
  }

  const startAt = new Date(startRaw);
  const endAt = new Date(endRaw);
  const max = Number(maxRaw);

  if (
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    !Number.isInteger(max) ||
    max <= 0 ||
    endAt <= startAt
  ) {
    return { enabled: false };
  }

  const key = `signup-slot:${location}:${startAt.toISOString()}:${endAt.toISOString()}`;
  const effectiveMax = memoryMaxOverrides.get(key) ?? max;

  return {
    enabled: true,
    forceFull,
    startAt,
    endAt,
    max: effectiveMax,
    key,
  };
}

function getNow(): Date {
  return new Date();
}

function isOpenNow(config: SlotConfig): boolean {
  if (!config.enabled || !config.startAt || !config.endAt) return true;
  const now = getNow();
  return now >= config.startAt && now <= config.endAt;
}

async function getCount(config: SlotConfig): Promise<number> {
  if (!config.enabled || !config.key) return 0;

  if (redis) {
    try {
      const value = await redis.get<number>(config.key);
      return typeof value === 'number' ? value : 0;
    } catch {
      // Fall back to in-memory if Redis is unavailable.
    }
  }

  return memoryCounts.get(config.key) || 0;
}

async function increment(config: SlotConfig): Promise<number> {
  if (!config.key) return 0;

  if (redis) {
    try {
      return await redis.incr(config.key);
    } catch {
      // Fall back to in-memory if Redis is unavailable.
    }
  }

  const next = (memoryCounts.get(config.key) || 0) + 1;
  memoryCounts.set(config.key, next);
  return next;
}

async function decrement(config: SlotConfig): Promise<void> {
  if (!config.key) return;

  if (redis) {
    try {
      await redis.decr(config.key);
      return;
    } catch {
      // Fall back to in-memory if Redis is unavailable.
    }
  }

  const current = memoryCounts.get(config.key) || 0;
  memoryCounts.set(config.key, Math.max(0, current - 1));
}

export async function getCapacityStatus(location: Location): Promise<CapacityStatus> {
  const config = parseSlotConfig(location);
  if (!config.enabled || !config.max || !config.startAt || !config.endAt) {
    return {
      enabled: false,
      open: true,
      full: false,
      count: 0,
      max: null,
      startAt: null,
      endAt: null,
      reason: 'ok',
    };
  }

  if (config.forceFull) {
    return {
      enabled: true,
      open: true,
      full: true,
      count: 0,
      max: config.max,
      startAt: config.startAt.toISOString(),
      endAt: config.endAt.toISOString(),
      reason: 'full',
    };
  }

  const count = await getCount(config);
  const open = isOpenNow(config);
  const full = count >= config.max;

  let reason: CapacityStatus['reason'] = 'ok';
  if (!open) reason = 'closed';
  else if (full) reason = 'full';

  return {
    enabled: true,
    open,
    full,
    count,
    max: config.max,
    startAt: config.startAt.toISOString(),
    endAt: config.endAt.toISOString(),
    reason,
  };
}

export async function reserveCapacity(location: Location): Promise<ReserveResult> {
  const status = await getCapacityStatus(location);
  if (!status.enabled) return { allowed: true, reason: 'ok' };
  if (!status.open) return { allowed: false, reason: 'closed' };

  const config = parseSlotConfig(location);
  if (!config.enabled || !config.max || !config.key) return { allowed: true, reason: 'ok' };

  const next = await increment(config);
  if (next > config.max) {
    await decrement(config);
    return { allowed: false, reason: 'full' };
  }

  return {
    allowed: true,
    reason: 'ok',
    reservationId: `${config.key}:${Date.now()}`,
  };
}

export async function releaseCapacity(location: Location): Promise<void> {
  const config = parseSlotConfig(location);
  if (!config.enabled) return;
  await decrement(config);
}
