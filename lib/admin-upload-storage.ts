import 'server-only';

import { SUPABASE_CONFIG } from '@/lib/env';
import { getSupabaseUrl, getSupabaseServiceRoleKey } from '@/lib/supabase-utils';

const SUPABASE_STORAGE_BUCKET = SUPABASE_CONFIG.STORAGE_BUCKET;

export async function saveAdminUpload(scope: 'books' | 'events', fileName: string, contentType: string, buffer: Buffer): Promise<string> {
  const baseUrl = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  const objectPath = `admin/${scope}/${fileName}`;

  const response = await fetch(`${baseUrl}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: new Uint8Array(buffer),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => 'unknown');
    throw new Error(`Supabase upload failed: ${response.status} ${reason}`);
  }

  return `${baseUrl}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${objectPath}`;
}
