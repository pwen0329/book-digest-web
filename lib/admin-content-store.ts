import 'server-only';

import { readJsonFile, writeJsonFile } from '@/lib/json-store';

export type AdminDocumentKey = 'books' | 'events' | 'capacity' | 'registration-success-email';

const SUPABASE_ADMIN_TABLE = process.env.SUPABASE_ADMIN_DOCUMENTS_TABLE || 'admin_documents';

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

  return `${url}/rest/v1/${SUPABASE_ADMIN_TABLE}?select=value&key=eq.${encodeURIComponent(key)}`;
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

async function readFromSupabase<T>(key: AdminDocumentKey): Promise<T | null> {
  const response = await fetch(getDocumentUrl(key), {
    method: 'GET',
    headers: getSupabaseHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Supabase document read failed for ${key}: ${response.status} ${reason}`);
  }

  const rows = await response.json() as Array<{ value: T }>;
  return rows[0]?.value ?? null;
}

async function writeToSupabase<T>(key: AdminDocumentKey, value: T): Promise<T> {
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

  const rows = await response.json() as Array<{ value: T }>;
  return rows[0]?.value ?? value;
}

type LoaderOptions<T> = {
  key: AdminDocumentKey;
  fallbackFile: string;
  fallbackValue?: T;
};

async function loadDocumentUncached<T>({ key, fallbackFile, fallbackValue }: LoaderOptions<T>): Promise<T> {
  if (isPersistentAdminStoreConfigured()) {
    const remoteValue = await readFromSupabase<T>(key);
    if (remoteValue !== null) {
      return remoteValue;
    }

    const fileValue = readJsonFile<T>(fallbackFile);
    await writeToSupabase(key, fileValue);
    return fileValue;
  }

  if (fallbackValue !== undefined) {
    return fallbackValue;
  }

  return readJsonFile<T>(fallbackFile);
}

export async function loadAdminDocument<T>(options: LoaderOptions<T>): Promise<T> {
  return loadDocumentUncached(options);
}

export async function saveAdminDocument<T>({ key, fallbackFile }: LoaderOptions<T>, value: T): Promise<T> {
  if (isPersistentAdminStoreConfigured()) {
    return writeToSupabase(key, value);
  }

  writeJsonFile(fallbackFile, value);
  return value;
}