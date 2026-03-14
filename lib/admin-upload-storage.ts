import 'server-only';

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveWorkspacePath } from '@/lib/json-store';

const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'admin-assets';

export function isPersistentUploadStoreConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function saveAdminUpload(scope: 'books' | 'events', fileName: string, contentType: string, buffer: Buffer): Promise<string> {
  if (isPersistentUploadStoreConfigured()) {
    const baseUrl = process.env.SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

  const relativeDirectory = path.join('public', 'uploads', 'admin', scope);
  const absoluteDirectory = resolveWorkspacePath(relativeDirectory);
  mkdirSync(absoluteDirectory, { recursive: true });

  const relativePath = path.join(relativeDirectory, fileName);
  const absolutePath = resolveWorkspacePath(relativePath);
  writeFileSync(absolutePath, buffer);
  return `/uploads/admin/${scope}/${fileName}`;
}