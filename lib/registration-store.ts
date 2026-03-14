import 'server-only';

import { cryptoRandomId } from '@/lib/crypto-id';
import { readJsonFile, writeJsonFile } from '@/lib/json-store';
import type { SignupLocation } from '@/lib/signup-capacity-config';

export type RegistrationRecordStatus = 'pending' | 'confirmed' | 'cancelled';

export type RegistrationRecord = {
  id: string;
  location: SignupLocation;
  locale: 'zh' | 'en';
  name: string;
  age: number;
  profession: string;
  email: string;
  instagram?: string;
  referral: string;
  referralOther?: string;
  bankAccount?: string;
  visitorId?: string;
  timestamp: string;
  status: RegistrationRecordStatus;
  source: 'pending' | 'simulated' | 'tally' | 'notion';
  externalId?: string;
  createdAt: string;
  updatedAt: string;
};

type CreateRegistrationInput = Omit<RegistrationRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

type UpdateRegistrationPatch = Partial<Pick<RegistrationRecord, 'status' | 'source' | 'externalId' | 'bankAccount' | 'visitorId'>>;

const REGISTRATIONS_FALLBACK_FILE = '.local/registrations.json';
const SUPABASE_REGISTRATIONS_TABLE = process.env.SUPABASE_REGISTRATIONS_TABLE || 'registrations';
const PENDING_TTL_MS = 30 * 60 * 1000;

function getSupabaseUrl(): string | null {
  return process.env.SUPABASE_URL || null;
}

function getSupabaseServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function getSupabaseHeaders(extraHeaders?: Record<string, string>): HeadersInit {
  const key = getSupabaseServiceRoleKey();
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

function getSupabaseTableUrl(): string {
  const url = getSupabaseUrl();
  if (!url) {
    throw new Error('SUPABASE_URL is not configured.');
  }

  return `${url}/rest/v1/${SUPABASE_REGISTRATIONS_TABLE}`;
}

export function isPersistentRegistrationStoreConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

function readFallbackRegistrations(): RegistrationRecord[] {
  try {
    return readJsonFile<RegistrationRecord[]>(REGISTRATIONS_FALLBACK_FILE);
  } catch {
    return [];
  }
}

function writeFallbackRegistrations(records: RegistrationRecord[]): void {
  writeJsonFile(REGISTRATIONS_FALLBACK_FILE, records);
}

function isActiveRegistration(record: RegistrationRecord): boolean {
  if (record.status === 'confirmed') {
    return true;
  }

  if (record.status !== 'pending') {
    return false;
  }

  const updatedAt = new Date(record.updatedAt).getTime();
  return Number.isFinite(updatedAt) && Date.now() - updatedAt <= PENDING_TTL_MS;
}

export async function createRegistrationReservation(input: CreateRegistrationInput): Promise<RegistrationRecord> {
  const now = new Date().toISOString();
  const record: RegistrationRecord = {
    ...input,
    id: input.id || cryptoRandomId(),
    createdAt: now,
    updatedAt: now,
  };

  if (isPersistentRegistrationStoreConfigured()) {
    const response = await fetch(getSupabaseTableUrl(), {
      method: 'POST',
      headers: getSupabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify([record]),
      cache: 'no-store',
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => 'unknown');
      throw new Error(`Supabase registration insert failed: ${response.status} ${reason}`);
    }

    const rows = await response.json() as RegistrationRecord[];
    return rows[0] || record;
  }

  const records = readFallbackRegistrations();
  records.push(record);
  writeFallbackRegistrations(records);
  return record;
}

export async function updateRegistrationReservation(id: string, patch: UpdateRegistrationPatch): Promise<RegistrationRecord | null> {
  const updatedAt = new Date().toISOString();

  if (isPersistentRegistrationStoreConfigured()) {
    const response = await fetch(`${getSupabaseTableUrl()}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: getSupabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ ...patch, updatedAt }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => 'unknown');
      throw new Error(`Supabase registration update failed: ${response.status} ${reason}`);
    }

    const rows = await response.json() as RegistrationRecord[];
    return rows[0] || null;
  }

  const records = readFallbackRegistrations();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) {
    return null;
  }

  const updated = { ...records[index], ...patch, updatedAt };
  records[index] = updated;
  writeFallbackRegistrations(records);
  return updated;
}

export async function countActiveRegistrations(location: SignupLocation): Promise<number> {
  if (isPersistentRegistrationStoreConfigured()) {
    const pendingCutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
    const query = `${getSupabaseTableUrl()}?select=id&location=eq.${encodeURIComponent(location)}&or=${encodeURIComponent(`status.eq.confirmed,and(status.eq.pending,updatedAt.gte.${pendingCutoff})`)}`;
    const response = await fetch(query, {
      method: 'GET',
      headers: getSupabaseHeaders({ Prefer: 'count=exact' }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => 'unknown');
      throw new Error(`Supabase registration count failed: ${response.status} ${reason}`);
    }

    const countHeader = response.headers.get('content-range');
    if (countHeader?.includes('/')) {
      const total = Number(countHeader.split('/').pop());
      if (Number.isFinite(total)) {
        return total;
      }
    }

    const rows = await response.json() as Array<{ id: string }>;
    return rows.length;
  }

  return readFallbackRegistrations().filter((record) => record.location === location && isActiveRegistration(record)).length;
}

export async function listStoredRegistrations(limit: number, location?: SignupLocation): Promise<RegistrationRecord[]> {
  if (isPersistentRegistrationStoreConfigured()) {
    const filters = [
      'select=*',
      'order=createdAt.desc',
      `limit=${limit}`,
      ...(location ? [`location=eq.${encodeURIComponent(location)}`] : []),
    ];

    const response = await fetch(`${getSupabaseTableUrl()}?${filters.join('&')}`, {
      method: 'GET',
      headers: getSupabaseHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => 'unknown');
      throw new Error(`Supabase registration list failed: ${response.status} ${reason}`);
    }

    return await response.json() as RegistrationRecord[];
  }

  const records = readFallbackRegistrations()
    .filter((record) => (location ? record.location === location : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return records.slice(0, limit);
}

export async function resetRegistrationsForTesting(location: SignupLocation): Promise<void> {
  if (process.env.ALLOW_CAPACITY_RESET !== '1') {
    return;
  }

  if (isPersistentRegistrationStoreConfigured()) {
    const response = await fetch(`${getSupabaseTableUrl()}?location=eq.${encodeURIComponent(location)}`, {
      method: 'DELETE',
      headers: getSupabaseHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => 'unknown');
      throw new Error(`Supabase registration reset failed: ${response.status} ${reason}`);
    }
    return;
  }

  const records = readFallbackRegistrations().filter((record) => record.location !== location);
  writeFallbackRegistrations(records);
}