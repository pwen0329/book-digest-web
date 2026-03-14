import { getSignupCapacitySlot, type CapacityConfigSlot, type SignupLocation } from '@/lib/signup-capacity-config';
import { countActiveRegistrations, resetRegistrationsForTesting } from '@/lib/registration-store';

type Location = SignupLocation;

type SlotConfig = {
  enabled: boolean;
  forceFull?: boolean;
  startAt?: Date;
  endAt?: Date;
  max?: number;
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

// Temporary max overrides used only in non-production environments (testing).
const memoryMaxOverrides = new Map<string, number>();
// Temporary forceFull overrides keyed by location (testing only).
const memoryForceFullOverrides = new Map<string, boolean>();

/**
 * Reset in-memory count for a location and optionally override its max.
 * Also clears any forceFull override for the location.
 * Only available in non-production environments.
 */
export async function _resetCountForTesting(location: Location, tempMax?: number): Promise<void> {
  if (process.env.ALLOW_CAPACITY_RESET !== '1') return;
  memoryForceFullOverrides.delete(location);
  await resetRegistrationsForTesting(location);
  if (tempMax !== undefined) {
    memoryMaxOverrides.set(location, tempMax);
  } else {
    memoryMaxOverrides.delete(location);
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

async function getConfigSlot(location: Location): Promise<CapacityConfigSlot> {
  return getSignupCapacitySlot(location);
}

async function parseSlotConfig(location: Location): Promise<SlotConfig> {
  const configSlot = await getConfigSlot(location);

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

  const effectiveMax = memoryMaxOverrides.get(location) ?? max;

  return {
    enabled: true,
    forceFull,
    startAt,
    endAt,
    max: effectiveMax,
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

export async function getCapacityStatus(location: Location): Promise<CapacityStatus> {
  const config = await parseSlotConfig(location);
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

  const open = isOpenNow(config);

  if (!open) {
    return {
      enabled: true,
      open: false,
      full: false,
      count: 0,
      max: config.max,
      startAt: config.startAt.toISOString(),
      endAt: config.endAt.toISOString(),
      reason: 'closed',
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

  const count = await countActiveRegistrations(location);
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
  if (status.full) return { allowed: false, reason: 'full' };

  return {
    allowed: true,
    reason: 'ok',
  };
}

export async function releaseCapacity(location: Location): Promise<void> {
  void location;
}
