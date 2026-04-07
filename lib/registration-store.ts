import 'server-only';

import { cryptoRandomId } from '@/lib/crypto-id';
import { readJsonFile, writeJsonFile } from '@/lib/json-store';
import type { SignupLocation } from '@/lib/signup';

export type RegistrationRecordStatus = 'pending' | 'confirmed' | 'cancelled';
export type RegistrationRecordSource = 'pending' | 'simulated' | 'tally' | 'notion';

export type RegistrationSyncStatus = 'pending' | 'mirrored' | 'forwarded' | 'failed' | 'skipped' | 'not_configured';

export type RegistrationAuditEntry = {
  at: string;
  event:
    | 'reservation_created'
    | 'reservation_confirmed'
    | 'reservation_cancelled'
    | 'tally_forward_attempted'
    | 'tally_forwarded'
    | 'tally_forward_failed'
    | 'notion_mirror_attempted'
    | 'notion_mirrored'
    | 'notion_mirror_failed'
    | 'email_attempted'
    | 'email_sent'
    | 'email_skipped'
    | 'email_failed'
    | 'admin_updated';
  actor: 'system' | 'tally' | 'notion' | 'email' | 'admin';
  summary: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

export type RegistrationSyncChannelState = {
  enabled: boolean;
  status: RegistrationSyncStatus;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  externalId?: string;
  error?: string;
};

export type RegistrationMirrorState = {
  notion: RegistrationSyncChannelState;
  tally: RegistrationSyncChannelState;
  email: RegistrationSyncChannelState;
};

export type RegistrationRecord = {
  id: string;
  eventId: number;
  /** @deprecated Use eventId instead. Kept for backwards compatibility during migration. */
  location?: SignupLocation;
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
  requestId?: string;
  timestamp: string;
  status: RegistrationRecordStatus;
  source: RegistrationRecordSource;
  externalId?: string;
  mirrorState?: RegistrationMirrorState;
  auditTrail?: RegistrationAuditEntry[];
  createdAt: string;
  updatedAt: string;
};

export type RegistrationListFilters = {
  limit: number;
  eventId?: number;
  /** @deprecated Use eventId instead */
  location?: SignupLocation;
  status?: RegistrationRecordStatus;
  source?: RegistrationRecordSource;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
};

export type RegistrationAuditSummary = {
  total: number;
  byStatus: Record<RegistrationRecordStatus, number>;
  byLocation: Record<SignupLocation, Record<RegistrationRecordStatus, number> & { total: number }>;
  notionMirrored: number;
  failedMirrors: number;
};

type CreateRegistrationInput = Omit<RegistrationRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

type UpdateRegistrationPatch = Partial<Pick<RegistrationRecord, 'status' | 'source' | 'externalId' | 'bankAccount' | 'visitorId' | 'requestId'>> & {
  mirrorState?: Partial<RegistrationMirrorState>;
  auditEntry?: RegistrationAuditEntry;
  auditEntries?: RegistrationAuditEntry[];
};

type SupabaseRegistrationRow = {
  id: string;
  event_id: number;
  location?: SignupLocation | null;
  locale: 'zh' | 'en';
  name: string;
  age: number;
  profession: string;
  email: string;
  instagram?: string | null;
  referral: string;
  referral_other?: string | null;
  bank_account?: string | null;
  visitor_id?: string | null;
  request_id?: string | null;
  timestamp: string;
  status: RegistrationRecordStatus;
  source: RegistrationRecordSource;
  external_id?: string | null;
  mirror_state?: RegistrationMirrorState | null;
  audit_trail?: RegistrationAuditEntry[] | null;
  created_at: string;
  updated_at: string;
};

const REGISTRATIONS_FALLBACK_FILE = process.env.FORCE_LOCAL_PERSISTENT_STORES === '1'
  ? '.local/playwright-registrations.json'
  : '.local/registrations.json';
const SUPABASE_REGISTRATIONS_TABLE = process.env.SUPABASE_REGISTRATIONS_TABLE || 'registrations';
const PENDING_TTL_MS = 30 * 60 * 1000;
const OPTIONAL_SUPABASE_MUTATION_COLUMNS = new Set([
  'instagram',
  'referral_other',
  'bank_account',
  'visitor_id',
  'request_id',
  'external_id',
  'mirror_state',
  'audit_trail',
  'created_at',
  'updated_at',
]);

const unsupportedSupabaseMutationColumns = new Set<string>();

function shouldForceLocalPersistentStores(): boolean {
  return process.env.FORCE_LOCAL_PERSISTENT_STORES === '1';
}

function createDefaultMirrorState(): RegistrationMirrorState {
  return {
    notion: { enabled: process.env.SUBMIT_SAVE_TO_NOTION === '1', status: process.env.SUBMIT_SAVE_TO_NOTION === '1' ? 'pending' : 'not_configured' },
    tally: { enabled: Boolean(process.env.TALLY_ENDPOINT_TW || process.env.TALLY_ENDPOINT_NL || process.env.TALLY_ENDPOINT_EN || process.env.TALLY_ENDPOINT_DETOX), status: 'not_configured' },
    email: { enabled: Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_OUTBOX_FILE), status: 'not_configured' },
  };
}

function mergeMirrorState(current?: RegistrationMirrorState, patch?: Partial<RegistrationMirrorState>): RegistrationMirrorState {
  const base = current || createDefaultMirrorState();

  if (!patch) {
    return base;
  }

  return {
    notion: { ...base.notion, ...(patch.notion || {}) },
    tally: { ...base.tally, ...(patch.tally || {}) },
    email: { ...base.email, ...(patch.email || {}) },
  };
}

function normalizeAuditTrail(value?: RegistrationAuditEntry[] | null): RegistrationAuditEntry[] {
  return (value || []).filter((entry) => Boolean(entry?.at && entry?.event && entry?.actor && entry?.summary));
}

function normalizeRecord(record: RegistrationRecord): RegistrationRecord {
  return {
    ...record,
    referralOther: record.referralOther || undefined,
    bankAccount: record.bankAccount || undefined,
    visitorId: record.visitorId || undefined,
    requestId: record.requestId || undefined,
    externalId: record.externalId || undefined,
    mirrorState: mergeMirrorState(record.mirrorState),
    auditTrail: normalizeAuditTrail(record.auditTrail),
  };
}

function getSupportedSupabaseMutationColumns(): Set<string> {
  return new Set(
    [...OPTIONAL_SUPABASE_MUTATION_COLUMNS].filter((column) => !unsupportedSupabaseMutationColumns.has(column))
  );
}

function buildSupabaseInsertPayload(record: RegistrationRecord): Record<string, unknown> {
  const normalized = normalizeRecord(record);
  const supported = getSupportedSupabaseMutationColumns();
  const payload: Record<string, unknown> = {
    id: normalized.id,
    event_id: normalized.eventId,
    locale: normalized.locale,
    name: normalized.name,
    age: normalized.age,
    profession: normalized.profession,
    email: normalized.email,
    referral: normalized.referral,
    timestamp: normalized.timestamp,
    status: normalized.status,
    source: normalized.source,
  };

  if (supported.has('instagram') && normalized.instagram) payload.instagram = normalized.instagram;
  if (supported.has('referral_other') && normalized.referralOther) payload.referral_other = normalized.referralOther;
  if (supported.has('bank_account') && normalized.bankAccount) payload.bank_account = normalized.bankAccount;
  if (supported.has('visitor_id') && normalized.visitorId) payload.visitor_id = normalized.visitorId;
  if (supported.has('request_id') && normalized.requestId) payload.request_id = normalized.requestId;
  if (supported.has('external_id') && normalized.externalId) payload.external_id = normalized.externalId;
  if (supported.has('mirror_state')) payload.mirror_state = normalized.mirrorState || createDefaultMirrorState();
  if (supported.has('audit_trail')) payload.audit_trail = normalized.auditTrail || [];
  if (supported.has('created_at')) payload.created_at = normalized.createdAt;
  if (supported.has('updated_at')) payload.updated_at = normalized.updatedAt;

  return payload;
}

function buildSupabaseUpdatePayload(record: RegistrationRecord): Record<string, unknown> {
  const supported = getSupportedSupabaseMutationColumns();
  const payload: Record<string, unknown> = {
    status: record.status,
    source: record.source,
  };

  if (supported.has('external_id')) payload.external_id = record.externalId || null;
  if (supported.has('bank_account')) payload.bank_account = record.bankAccount || null;
  if (supported.has('visitor_id')) payload.visitor_id = record.visitorId || null;
  if (supported.has('request_id')) payload.request_id = record.requestId || null;
  if (supported.has('mirror_state')) payload.mirror_state = record.mirrorState || createDefaultMirrorState();
  if (supported.has('audit_trail')) payload.audit_trail = record.auditTrail || [];
  if (supported.has('updated_at')) payload.updated_at = record.updatedAt;

  return payload;
}

function extractMissingSupabaseColumn(reason: string): string | null {
  const schemaCacheMatch = reason.match(/Could not find the '([a-z_]+)' column/i);
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1];
  }

  const missingColumnMatch = reason.match(/column (?:[a-z_]+\.)?([a-z_]+) does not exist/i);
  if (missingColumnMatch?.[1]) {
    return missingColumnMatch[1];
  }

  return null;
}

function markUnsupportedSupabaseMutationColumn(reason: string): boolean {
  const missingColumn = extractMissingSupabaseColumn(reason);
  if (!missingColumn || !OPTIONAL_SUPABASE_MUTATION_COLUMNS.has(missingColumn) || unsupportedSupabaseMutationColumns.has(missingColumn)) {
    return false;
  }

  unsupportedSupabaseMutationColumns.add(missingColumn);
  return true;
}

function fromSupabaseRow(row: SupabaseRegistrationRow): RegistrationRecord {
  return normalizeRecord({
    id: row.id,
    eventId: row.event_id,
    location: row.location || undefined,
    locale: row.locale,
    name: row.name,
    age: row.age,
    profession: row.profession,
    email: row.email,
    instagram: row.instagram || undefined,
    referral: row.referral,
    referralOther: row.referral_other || undefined,
    bankAccount: row.bank_account || undefined,
    visitorId: row.visitor_id || undefined,
    requestId: row.request_id || undefined,
    timestamp: row.timestamp,
    status: row.status,
    source: row.source,
    externalId: row.external_id || undefined,
    mirrorState: row.mirror_state || undefined,
    auditTrail: row.audit_trail || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function getSupabaseUrl(): string | null {
  if (shouldForceLocalPersistentStores()) {
    return null;
  }

  return process.env.SUPABASE_URL || null;
}

function getSupabaseServiceRoleKey(): string | null {
  if (shouldForceLocalPersistentStores()) {
    return null;
  }

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

function buildSupabaseQuery(params: Record<string, string | number | Array<string | number> | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, String(entry));
      }
      continue;
    }

    query.set(key, String(value));
  }

  return `${getSupabaseTableUrl()}?${query.toString()}`;
}

export function isPersistentRegistrationStoreConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function resetRegistrationStoreSchemaFallbacksForTesting(): void {
  unsupportedSupabaseMutationColumns.clear();
}

function readFallbackRegistrations(): RegistrationRecord[] {
  try {
    return readJsonFile<RegistrationRecord[]>(REGISTRATIONS_FALLBACK_FILE).map((record) => normalizeRecord(record));
  } catch {
    return [];
  }
}

function writeFallbackRegistrations(records: RegistrationRecord[]): void {
  writeJsonFile(REGISTRATIONS_FALLBACK_FILE, records.map((record) => normalizeRecord(record)));
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

function filterRegistrations(records: RegistrationRecord[], filters: Omit<RegistrationListFilters, 'limit'>): RegistrationRecord[] {
  const searchTerm = filters.search?.trim().toLowerCase();
  const createdAfter = filters.createdAfter ? new Date(filters.createdAfter).getTime() : Number.NaN;
  const createdBefore = filters.createdBefore ? new Date(filters.createdBefore).getTime() : Number.NaN;

  return records.filter((record) => {
    if (filters.eventId && record.eventId !== filters.eventId) {
      return false;
    }
    if (filters.location && record.location !== filters.location) {
      return false;
    }
    if (filters.status && record.status !== filters.status) {
      return false;
    }
    if (filters.source && record.source !== filters.source) {
      return false;
    }
    if (Number.isFinite(createdAfter) && new Date(record.timestamp).getTime() < createdAfter) {
      return false;
    }
    if (Number.isFinite(createdBefore) && new Date(record.timestamp).getTime() > createdBefore) {
      return false;
    }
    if (!searchTerm) {
      return true;
    }

    return [record.name, record.email, record.profession, record.instagram, record.externalId, record.requestId, record.bankAccount, record.visitorId]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(searchTerm));
  });
}

async function getStoredRegistrationById(id: string): Promise<RegistrationRecord | null> {
  if (isPersistentRegistrationStoreConfigured()) {
    const response = await fetch(`${getSupabaseTableUrl()}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`, {
      method: 'GET',
      headers: getSupabaseHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => 'unknown');
      throw new Error(`Supabase registration lookup failed: ${response.status} ${reason}`);
    }

    const rows = await response.json() as SupabaseRegistrationRow[];
    return rows[0] ? fromSupabaseRow(rows[0]) : null;
  }

  return readFallbackRegistrations().find((record) => record.id === id) || null;
}

export async function createRegistrationReservation(input: CreateRegistrationInput): Promise<RegistrationRecord> {
  const now = new Date().toISOString();
  const record = normalizeRecord({
    ...input,
    id: input.id || cryptoRandomId(),
    mirrorState: mergeMirrorState(input.mirrorState),
    auditTrail: [
      ...normalizeAuditTrail(input.auditTrail),
      {
        at: now,
        event: 'reservation_created',
        actor: 'system',
        summary: 'Registration reservation created.',
        requestId: input.requestId,
        details: { status: input.status, source: input.source, location: input.location },
      },
    ],
    createdAt: now,
    updatedAt: now,
  });

  if (isPersistentRegistrationStoreConfigured()) {
    for (let attempt = 0; attempt <= OPTIONAL_SUPABASE_MUTATION_COLUMNS.size; attempt += 1) {
      const response = await fetch(getSupabaseTableUrl(), {
        method: 'POST',
        headers: getSupabaseHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify([buildSupabaseInsertPayload(record)]),
        cache: 'no-store',
      });

      if (response.ok) {
        const rows = await response.json() as SupabaseRegistrationRow[];
        return rows[0] ? fromSupabaseRow(rows[0]) : record;
      }

      const reason = await response.text().catch(() => 'unknown');
      if (response.status === 400 && markUnsupportedSupabaseMutationColumn(reason)) {
        continue;
      }

      throw new Error(`Supabase registration insert failed: ${response.status} ${reason}`);
    }

    throw new Error('Supabase registration insert failed after exhausting schema fallbacks.');
  }

  const records = readFallbackRegistrations();
  records.push(record);
  writeFallbackRegistrations(records);
  return record;
}

export async function updateRegistrationReservation(id: string, patch: UpdateRegistrationPatch): Promise<RegistrationRecord | null> {
  const updatedAt = new Date().toISOString();

  const current = await getStoredRegistrationById(id);
  if (!current) {
    return null;
  }

  const auditTrail = [
    ...normalizeAuditTrail(current.auditTrail),
    ...normalizeAuditTrail(patch.auditEntries),
    ...(patch.auditEntry ? [patch.auditEntry] : []),
  ];

  const updated = normalizeRecord({
    ...current,
    ...patch,
    mirrorState: mergeMirrorState(current.mirrorState, patch.mirrorState),
    auditTrail,
    updatedAt,
  });

  if (isPersistentRegistrationStoreConfigured()) {
    for (let attempt = 0; attempt <= OPTIONAL_SUPABASE_MUTATION_COLUMNS.size; attempt += 1) {
      const response = await fetch(`${getSupabaseTableUrl()}?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: getSupabaseHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(buildSupabaseUpdatePayload(updated)),
        cache: 'no-store',
      });

      if (response.ok) {
        const rows = await response.json() as SupabaseRegistrationRow[];
        return rows[0] ? fromSupabaseRow(rows[0]) : null;
      }

      const reason = await response.text().catch(() => 'unknown');
      if (response.status === 400 && markUnsupportedSupabaseMutationColumn(reason)) {
        continue;
      }

      throw new Error(`Supabase registration update failed: ${response.status} ${reason}`);
    }

    throw new Error('Supabase registration update failed after exhausting schema fallbacks.');
  }

  const records = readFallbackRegistrations();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) {
    return null;
  }

  records[index] = updated;
  writeFallbackRegistrations(records);
  return updated;
}

export async function countActiveRegistrationsByEventId(eventId: number): Promise<number> {
  if (isPersistentRegistrationStoreConfigured()) {
    const pendingCutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
    const query = buildSupabaseQuery({
      select: 'id',
      event_id: `eq.${eventId}`,
      or: `(status.eq.confirmed,and(status.eq.pending,updated_at.gte.${pendingCutoff}))`,
    });
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

  return readFallbackRegistrations().filter((record) => record.eventId === eventId && isActiveRegistration(record)).length;
}

/** @deprecated Use countActiveRegistrationsByEventId instead */
export async function countActiveRegistrations(location: SignupLocation): Promise<number> {
  if (isPersistentRegistrationStoreConfigured()) {
    const pendingCutoff = new Date(Date.now() - PENDING_TTL_MS).toISOString();
    const query = buildSupabaseQuery({
      select: 'id',
      location: `eq.${location}`,
      or: `(status.eq.confirmed,and(status.eq.pending,updated_at.gte.${pendingCutoff}))`,
    });
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

export async function listStoredRegistrations(filters: RegistrationListFilters): Promise<RegistrationRecord[]> {
  if (isPersistentRegistrationStoreConfigured()) {
    const timestampFilters = [
      filters.createdAfter ? `gte.${filters.createdAfter}` : undefined,
      filters.createdBefore ? `lte.${filters.createdBefore}` : undefined,
    ].filter((value): value is string => Boolean(value));

    const queryParams: Record<string, string | number | Array<string | number> | undefined> = {
      select: '*',
      order: 'created_at.desc',
      limit: filters.limit,
      event_id: filters.eventId ? `eq.${filters.eventId}` : undefined,
      location: filters.location ? `eq.${filters.location}` : undefined,
      status: filters.status ? `eq.${filters.status}` : undefined,
      source: filters.source ? `eq.${filters.source}` : undefined,
      timestamp: timestampFilters.length ? timestampFilters : undefined,
    };

    if (filters.search?.trim()) {
      const token = `*${filters.search.trim()}*`;
      queryParams.or = `(name.ilike.${token},email.ilike.${token},profession.ilike.${token},external_id.ilike.${token},request_id.ilike.${token})`;
    }

    const response = await fetch(buildSupabaseQuery(queryParams), {
      method: 'GET',
      headers: getSupabaseHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => 'unknown');
      throw new Error(`Supabase registration list failed: ${response.status} ${reason}`);
    }

    const rows = await response.json() as SupabaseRegistrationRow[];
    return rows.map((row) => fromSupabaseRow(row));
  }

  const records = filterRegistrations(readFallbackRegistrations(), filters)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return records.slice(0, filters.limit);
}

async function countStoredRegistrations(filters: Omit<RegistrationListFilters, 'limit' | 'search'>): Promise<number> {
  if (isPersistentRegistrationStoreConfigured()) {
    const timestampFilters = [
      filters.createdAfter ? `gte.${filters.createdAfter}` : undefined,
      filters.createdBefore ? `lte.${filters.createdBefore}` : undefined,
    ].filter((value): value is string => Boolean(value));

    const queryParams: Record<string, string | Array<string> | undefined> = {
      select: 'id',
      location: filters.location ? `eq.${filters.location}` : undefined,
      status: filters.status ? `eq.${filters.status}` : undefined,
      source: filters.source ? `eq.${filters.source}` : undefined,
      timestamp: timestampFilters.length ? timestampFilters : undefined,
    };

    const response = await fetch(buildSupabaseQuery(queryParams), {
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

  return filterRegistrations(readFallbackRegistrations(), filters).length;
}

export async function summarizeStoredRegistrations(): Promise<RegistrationAuditSummary> {
  const locations: SignupLocation[] = ['TW', 'NL', 'EN', 'DETOX'];
  const statuses: RegistrationRecordStatus[] = ['pending', 'confirmed', 'cancelled'];

  const byLocation = Object.fromEntries(locations.map((location) => [
    location,
    { total: 0, pending: 0, confirmed: 0, cancelled: 0 },
  ])) as RegistrationAuditSummary['byLocation'];

  const byStatus = { pending: 0, confirmed: 0, cancelled: 0 } satisfies RegistrationAuditSummary['byStatus'];

  await Promise.all(locations.flatMap((location) => statuses.map(async (status) => {
    const count = await countStoredRegistrations({ location, status });
    byLocation[location][status] = count;
    byLocation[location].total += count;
    byStatus[status] += count;
  })));

  const notionMirrored = await countStoredRegistrations({ source: 'notion' });
  const failedMirrors = (await listStoredRegistrations({ limit: 1000 })).filter((record) => record.mirrorState?.notion?.status === 'failed' || record.mirrorState?.tally?.status === 'failed').length;

  return {
    total: byStatus.pending + byStatus.confirmed + byStatus.cancelled,
    byStatus,
    byLocation,
    notionMirrored,
    failedMirrors,
  };
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function serializeRegistrationsCsv(records: RegistrationRecord[]): string {
  const headers = [
    'id',
    'createdAt',
    'updatedAt',
    'timestamp',
    'location',
    'locale',
    'name',
    'email',
    'age',
    'profession',
    'instagram',
    'referral',
    'referralOther',
    'bankAccount',
    'visitorId',
    'requestId',
    'status',
    'source',
    'externalId',
    'notionStatus',
    'tallyStatus',
    'emailStatus',
    'auditTrail',
  ];

  const rows = records.map((record) => [
    record.id,
    record.createdAt,
    record.updatedAt,
    record.timestamp,
    record.location,
    record.locale,
    record.name,
    record.email,
    record.age,
    record.profession,
    record.instagram,
    record.referral,
    record.referralOther,
    record.bankAccount,
    record.visitorId,
    record.requestId,
    record.status,
    record.source,
    record.externalId,
    record.mirrorState?.notion?.status,
    record.mirrorState?.tally?.status,
    record.mirrorState?.email?.status,
    record.auditTrail,
  ]);

  return [headers, ...rows].map((row) => row.map((value) => escapeCsvValue(value)).join(',')).join('\n');
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