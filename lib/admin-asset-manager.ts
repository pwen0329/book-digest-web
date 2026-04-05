import 'server-only';

import path from 'node:path';
import { readdir, stat, unlink } from 'node:fs/promises';
import type { Book } from '@/types/book';
import type { Event } from '@/types/event';
import { getAllBooksFromDB } from '@/lib/books-db';
import { getEvents } from '@/lib/events';
import { isPersistentUploadStoreConfigured, resolveLocalAdminUploadPath } from '@/lib/admin-upload-storage';

type UploadScope = 'books' | 'events';

export type ManagedAssetRecord = {
  url: string;
  scope: UploadScope;
  fileName: string;
  storage: 'local' | 'supabase';
  modifiedAt?: string;
};

export type ManagedAssetReport = {
  generatedAt: string;
  gracePeriodHours: number;
  referencedCount: number;
  storedCount: number;
  orphanedCount: number;
  missingReferencedCount: number;
  orphaned: ManagedAssetRecord[];
  missingReferenced: Array<{ url: string; scope: UploadScope; fileName: string }>;
};

type AssetCleanupInput = {
  previousBooks: Book[];
  nextBooks: Book[];
  previousEvents: EventContentMap;
  nextEvents: EventContentMap;
};

function getSupabaseUrl(): string | null {
  return process.env.SUPABASE_URL || null;
}

function getSupabaseServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function getStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'admin-assets';
}

type ParsedManagedAsset = {
  scope: UploadScope;
  fileName: string;
  objectPath?: string;
};

function parseManagedAssetUrl(url: string): ParsedManagedAsset | null {
  const localMatch = url.match(/^\/uploads\/admin\/(books|events)\/([^/?#]+)$/);
  if (localMatch) {
    return {
      scope: localMatch[1] as UploadScope,
      fileName: localMatch[2],
    };
  }

  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    return null;
  }

  const escapedBase = supabaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const remotePattern = new RegExp(`^${escapedBase}/storage/v1/object/public/${getStorageBucket()}/admin/(books|events)/([^/?#]+)$`);
  const remoteMatch = url.match(remotePattern);
  if (!remoteMatch) {
    return null;
  }

  return {
    scope: remoteMatch[1] as UploadScope,
    fileName: remoteMatch[2],
    objectPath: `admin/${remoteMatch[1]}/${remoteMatch[2]}`,
  };
}

function extractBookAssetUrls(books: Book[]): Set<string> {
  const urls = new Set<string>();

  for (const book of books) {
    [book.coverUrl, book.coverUrlEn, ...(book.coverUrls || []), ...(book.coverUrlsEn || [])]
      .filter((value): value is string => Boolean(value))
      .forEach((value) => urls.add(value));
  }

  return urls;
}

function extractEventAssetUrls(events: Event[]): Set<string> {
  const urls = new Set<string>();
  for (const event of events) {
    if (event.coverUrl) {
      urls.add(event.coverUrl);
    }
    if (event.coverUrlEn) {
      urls.add(event.coverUrlEn);
    }
  }
  return urls;
}

async function deleteManagedAsset(url: string) {
  const parsed = parseManagedAssetUrl(url);
  if (!parsed) {
    return;
  }

  if (!parsed.objectPath) {
    await unlink(resolveLocalAdminUploadPath(parsed.scope, parsed.fileName)).catch(() => undefined);
    return;
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return;
  }

  await fetch(`${supabaseUrl}/storage/v1/object/${getStorageBucket()}/${parsed.objectPath}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: 'no-store',
  }).catch(() => undefined);
}

export async function cleanupRemovedAdminAssets({ previousBooks, nextBooks, previousEvents, nextEvents }: AssetCleanupInput) {
  const previousAssets = new Set<string>([
    ...extractBookAssetUrls(previousBooks),
    ...extractEventAssetUrls(previousEvents),
  ]);
  const nextAssets = new Set<string>([
    ...extractBookAssetUrls(nextBooks),
    ...extractEventAssetUrls(nextEvents),
  ]);

  const orphanedAssets = [...previousAssets].filter((url) => !nextAssets.has(url));
  await Promise.all(orphanedAssets.map((url) => deleteManagedAsset(url)));
}

async function listLocalAssets(scope: UploadScope): Promise<ManagedAssetRecord[]> {
  const directory = path.dirname(resolveLocalAdminUploadPath(scope, 'placeholder.txt'));
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const assets = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
    const entryStat = await stat(resolveLocalAdminUploadPath(scope, entry.name)).catch(() => null);
    return {
      url: `/uploads/admin/${scope}/${entry.name}`,
      scope,
      fileName: entry.name,
      storage: 'local' as const,
      modifiedAt: entryStat?.mtime.toISOString(),
    };
  }));

  return assets;
}

async function listSupabaseAssets(scope: UploadScope): Promise<ManagedAssetRecord[]> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return [];
  }

  const bucket = getStorageBucket();
  const assets: ManagedAssetRecord[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: `admin/${scope}`,
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      break;
    }

    const batch = await response.json() as Array<{ name?: string; updated_at?: string; created_at?: string }>;
    if (!batch.length) {
      break;
    }

    assets.push(...batch
      .filter((entry) => entry.name)
      .map((entry) => ({
        url: `${supabaseUrl}/storage/v1/object/public/${bucket}/admin/${scope}/${entry.name}`,
        scope,
        fileName: entry.name!,
        storage: 'supabase' as const,
        modifiedAt: entry.updated_at || entry.created_at,
      })));

    if (batch.length < limit) {
      break;
    }

    offset += batch.length;
  }

  return assets;
}

async function listStoredAssets(): Promise<ManagedAssetRecord[]> {
  const [bookAssets, eventAssets] = await Promise.all([
    isPersistentUploadStoreConfigured() ? listSupabaseAssets('books') : listLocalAssets('books'),
    isPersistentUploadStoreConfigured() ? listSupabaseAssets('events') : listLocalAssets('events'),
  ]);

  return [...bookAssets, ...eventAssets];
}

function getReferencedAssets(books: Book[], events: Event[]): ManagedAssetRecord[] {
  const urls = [
    ...extractBookAssetUrls(books),
    ...extractEventAssetUrls(events),
  ];

  return [...urls]
    .map((url) => {
      const parsed = parseManagedAssetUrl(url);
      if (!parsed) {
        return null;
      }

      return {
        url,
        scope: parsed.scope,
        fileName: parsed.fileName,
        storage: parsed.objectPath ? 'supabase' : 'local',
      } satisfies ManagedAssetRecord;
    })
    .filter((item): item is ManagedAssetRecord => Boolean(item));
}

export async function buildManagedAssetReport(gracePeriodHours = 168): Promise<ManagedAssetReport> {
  const [books, events, storedAssets] = await Promise.all([
    getAllBooksFromDB(),
    getEvents(),
    listStoredAssets(),
  ]);

  const referencedAssets = getReferencedAssets(books, events);
  const storedByUrl = new Map(storedAssets.map((asset) => [asset.url, asset]));
  const referencedByUrl = new Map(referencedAssets.map((asset) => [asset.url, asset]));

  const orphaned = storedAssets.filter((asset) => !referencedByUrl.has(asset.url));
  const missingReferenced = referencedAssets
    .filter((asset) => !storedByUrl.has(asset.url))
    .map((asset) => ({ url: asset.url, scope: asset.scope, fileName: asset.fileName }));

  return {
    generatedAt: new Date().toISOString(),
    gracePeriodHours,
    referencedCount: referencedAssets.length,
    storedCount: storedAssets.length,
    orphanedCount: orphaned.length,
    missingReferencedCount: missingReferenced.length,
    orphaned,
    missingReferenced,
  };
}

export async function pruneOrphanedManagedAssets(gracePeriodHours = 168): Promise<{ deleted: ManagedAssetRecord[]; skipped: ManagedAssetRecord[] }> {
  const report = await buildManagedAssetReport(gracePeriodHours);
  const cutoff = Date.now() - gracePeriodHours * 60 * 60 * 1000;

  const deletable = report.orphaned.filter((asset) => {
    if (!asset.modifiedAt) {
      return false;
    }

    return new Date(asset.modifiedAt).getTime() <= cutoff;
  });

  const skipped = report.orphaned.filter((asset) => !deletable.includes(asset));
  await Promise.all(deletable.map((asset) => deleteManagedAsset(asset.url)));

  return { deleted: deletable, skipped };
}