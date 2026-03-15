import 'server-only';

import { unlink } from 'node:fs/promises';
import type { Book } from '@/types/book';
import type { EventContentMap } from '@/types/event-content';
import { resolveLocalAdminUploadPath } from '@/lib/admin-upload-storage';

type UploadScope = 'books' | 'events';

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

function extractEventAssetUrls(events: EventContentMap): Set<string> {
  const urls = new Set<string>();
  for (const event of Object.values(events)) {
    if (event.posterSrc) {
      urls.add(event.posterSrc);
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