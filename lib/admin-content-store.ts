import 'server-only';

import path from 'node:path';
import { statSync } from 'node:fs';
import { revalidateTag, unstable_cache } from 'next/cache';
import { readJsonFile, resolveWorkspacePath, writeJsonFile } from '@/lib/json-store';

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
const LOCAL_ADMIN_DOCUMENTS_ROOT = '.local/playwright-admin-documents';
const unsupportedAdminDocumentColumns = new Set<string>();

function shouldForceLocalPersistentStores(): boolean {
  return process.env.FORCE_LOCAL_PERSISTENT_STORES === '1';
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

function getEffectiveFallbackFile(fallbackFile: string): string {
  if (!shouldForceLocalPersistentStores()) {
    return fallbackFile;
  }

  return path.join(LOCAL_ADMIN_DOCUMENTS_ROOT, path.basename(fallbackFile));
}

function ensureEffectiveFallbackSeed(fallbackFile: string): string {
  const effectiveFallbackFile = getEffectiveFallbackFile(fallbackFile);
  if (effectiveFallbackFile === fallbackFile) {
    return fallbackFile;
  }

  try {
    statSync(resolveWorkspacePath(effectiveFallbackFile));
    return effectiveFallbackFile;
  } catch {
    writeJsonFile(effectiveFallbackFile, readJsonFile(fallbackFile));
    return effectiveFallbackFile;
  }
}

export function isPersistentAdminStoreConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function resetAdminDocumentSchemaFallbacksForTesting(): void {
  unsupportedAdminDocumentColumns.clear();
}

function getDocumentUrl(key: AdminDocumentKey, includeUpdatedAt = true): string {
  const url = getSupabaseUrl();
  if (!url) {
    throw new Error('SUPABASE_URL is not configured.');
  }

  const select = includeUpdatedAt ? 'value,updated_at' : 'value';
  return `${url}/rest/v1/${SUPABASE_ADMIN_TABLE}?select=${select}&key=eq.${encodeURIComponent(key)}`;
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
  let includeUpdatedAt = !unsupportedAdminDocumentColumns.has('updated_at');

  while (true) {
    const response = await fetch(getDocumentUrl(key, includeUpdatedAt), {
      method: 'GET',
      headers: getSupabaseHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => 'unknown');
      if (includeUpdatedAt && response.status === 400 && /Could not find the 'updated_at' column|column .*updated_at does not exist/i.test(reason)) {
        unsupportedAdminDocumentColumns.add('updated_at');
        includeUpdatedAt = false;
        continue;
      }

      throw new Error(`Supabase document read failed for ${key}: ${response.status} ${reason}`);
    }

    const rows = await response.json() as Array<{ value: T; updated_at?: string | null }>;
    const row = rows[0];
    return row ? { value: row.value, updatedAt: row.updated_at || null } : null;
  }
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
    headers: getSupabaseHeaders({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key, value }]),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Supabase document write failed for ${key}: ${response.status} ${reason}`);
  }

  const savedRecord = await readFromSupabase<T>(key);
  return savedRecord ?? { value, updatedAt: null };
}

type LoaderOptions<T> = {
  key: AdminDocumentKey;
  fallbackFile: string;
  fallbackValue?: T;
};

function getLocalDocumentUpdatedAt(fallbackFile: string): string | null {
  try {
    return statSync(resolveWorkspacePath(ensureEffectiveFallbackSeed(fallbackFile))).mtime.toISOString();
  } catch {
    return null;
  }
}

async function loadDocumentUncached<T>({ key, fallbackFile, fallbackValue }: LoaderOptions<T>): Promise<AdminDocumentRecord<T>> {
  const effectiveFallbackFile = ensureEffectiveFallbackSeed(fallbackFile);

  if (isPersistentAdminStoreConfigured()) {
    const remoteValue = await readFromSupabase<T>(key);
    if (remoteValue !== null) {
      return remoteValue;
    }

    const fileValue = readJsonFile<T>(effectiveFallbackFile);
    return writeToSupabase(key, fileValue);
  }

  if (fallbackValue !== undefined) {
    return { value: fallbackValue, updatedAt: null };
  }

  return { value: readJsonFile<T>(effectiveFallbackFile), updatedAt: getLocalDocumentUpdatedAt(effectiveFallbackFile) };
}

export async function loadAdminDocument<T>(options: LoaderOptions<T>): Promise<T> {
  return (await loadAdminDocumentRecord(options)).value;
}

export async function loadAdminDocumentRecord<T>(options: LoaderOptions<T>): Promise<AdminDocumentRecord<T>> {
  if (
    options.fallbackValue !== undefined ||
    process.env.VITEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development'
  ) {
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
  const effectiveFallbackFile = ensureEffectiveFallbackSeed(fallbackFile);

  if (isPersistentAdminStoreConfigured()) {
    savedRecord = await writeToSupabase(key, value, expectedUpdatedAt);
  } else {
    const currentUpdatedAt = getLocalDocumentUpdatedAt(effectiveFallbackFile);
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== (currentUpdatedAt || null)) {
      throw new AdminDocumentConflictError(`The ${key} document changed on the server. Refresh before saving again.`);
    }

    writeJsonFile(effectiveFallbackFile, value);
    savedRecord = { value, updatedAt: getLocalDocumentUpdatedAt(effectiveFallbackFile) || new Date().toISOString() };
  }

  revalidateTag(ADMIN_DOCUMENTS_CACHE_TAG);
  return savedRecord;
}