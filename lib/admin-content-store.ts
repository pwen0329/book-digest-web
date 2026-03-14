import 'server-only';

import { revalidateTag, unstable_cache } from 'next/cache';
import { readJsonFile, writeJsonFile } from '@/lib/json-store';

export type AdminDocumentKey = 'books' | 'events' | 'capacity' | 'registration-success-email';

export type AdminDocumentRecord<T> = {
  value: T;
  updatedAt: string | null;
};

export class AdminDocumentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminDocumentConflictError';
  }
}

const SUPABASE_ADMIN_TABLE = process.env.SUPABASE_ADMIN_DOCUMENTS_TABLE || 'admin_documents';
const ADMIN_DOCUMENTS_CACHE_TAG = 'admin-documents';

function getSupabaseUrl(): string | null {
  return process.env.SUPABASE_URL || null;
}

function getSupabaseServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function isPersistentAdminStoreConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

function getDocumentUrl(key: AdminDocumentKey): string {
  const url = getSupabaseUrl();
  if (!url) {
    throw new Error('SUPABASE_URL is not configured.');
  }

  return `${url}/rest/v1/${SUPABASE_ADMIN_TABLE}?select=value,updated_at&key=eq.${encodeURIComponent(key)}`;
}

function getTableUrl(): string {
  const url = getSupabaseUrl();
  if (!url) {
    throw new Error('SUPABASE_URL is not configured.');
  }

  return `${url}/rest/v1/${SUPABASE_ADMIN_TABLE}`;
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

async function readFromSupabase<T>(key: AdminDocumentKey): Promise<AdminDocumentRecord<T> | null> {
  const response = await fetch(getDocumentUrl(key), {
    method: 'GET',
    headers: getSupabaseHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Supabase document read failed for ${key}: ${response.status} ${reason}`);
  }

  const rows = await response.json() as Array<{ value: T; updated_at?: string | null }>;
  const row = rows[0];
  return row ? { value: row.value, updatedAt: row.updated_at || null } : null;
}

async function writeToSupabase<T>(key: AdminDocumentKey, value: T, expectedUpdatedAt?: string | null): Promise<AdminDocumentRecord<T>> {
  if (expectedUpdatedAt !== undefined) {
    const current = await readFromSupabase<T>(key);
    if ((current?.updatedAt || null) !== (expectedUpdatedAt || null)) {
      throw new AdminDocumentConflictError(`The ${key} document changed on the server. Refresh before saving again.`);
    }
  }

  const response = await fetch(getTableUrl(), {
    method: 'POST',
    headers: getSupabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify([{ key, value }]),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Supabase document write failed for ${key}: ${response.status} ${reason}`);
  }

  const rows = await response.json() as Array<{ value: T; updated_at?: string | null }>;
  return {
    value: rows[0]?.value ?? value,
    updatedAt: rows[0]?.updated_at || new Date().toISOString(),
  };
}

type LoaderOptions<T> = {
  key: AdminDocumentKey;
  fallbackFile: string;
  fallbackValue?: T;
};

async function loadDocumentUncached<T>({ key, fallbackFile, fallbackValue }: LoaderOptions<T>): Promise<AdminDocumentRecord<T>> {
  if (isPersistentAdminStoreConfigured()) {
    const remoteValue = await readFromSupabase<T>(key);
    if (remoteValue !== null) {
      return remoteValue;
    }

    const fileValue = readJsonFile<T>(fallbackFile);
    return writeToSupabase(key, fileValue);
  }

  if (fallbackValue !== undefined) {
    return { value: fallbackValue, updatedAt: null };
  }

  return { value: readJsonFile<T>(fallbackFile), updatedAt: null };
}

export async function loadAdminDocument<T>(options: LoaderOptions<T>): Promise<T> {
  return (await loadAdminDocumentRecord(options)).value;
}

export async function loadAdminDocumentRecord<T>(options: LoaderOptions<T>): Promise<AdminDocumentRecord<T>> {
  if (options.fallbackValue !== undefined || process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return loadDocumentUncached(options);
  }

  const cachedLoader = unstable_cache(
    async (key: AdminDocumentKey, fallbackFile: string) => loadDocumentUncached<T>({ key, fallbackFile }),
    [ADMIN_DOCUMENTS_CACHE_TAG],
    { tags: [ADMIN_DOCUMENTS_CACHE_TAG], revalidate: 3600 }
  );

  return cachedLoader(options.key, options.fallbackFile);
}

export async function saveAdminDocument<T>({ key, fallbackFile }: LoaderOptions<T>, value: T, expectedUpdatedAt?: string | null): Promise<T> {
  return (await saveAdminDocumentRecord({ key, fallbackFile }, value, expectedUpdatedAt)).value;
}

export async function saveAdminDocumentRecord<T>({ key, fallbackFile }: LoaderOptions<T>, value: T, expectedUpdatedAt?: string | null): Promise<AdminDocumentRecord<T>> {
  let savedRecord: AdminDocumentRecord<T>;

  if (isPersistentAdminStoreConfigured()) {
    savedRecord = await writeToSupabase(key, value, expectedUpdatedAt);
  } else {
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== null) {
      throw new AdminDocumentConflictError(`The ${key} document changed on the server. Refresh before saving again.`);
    }

    writeJsonFile(fallbackFile, value);
    savedRecord = { value, updatedAt: new Date().toISOString() };
  }

  revalidateTag(ADMIN_DOCUMENTS_CACHE_TAG);
  return savedRecord;
}