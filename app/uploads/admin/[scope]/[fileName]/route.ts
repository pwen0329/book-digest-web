import { readFile } from 'node:fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { resolveLocalAdminUploadPath } from '@/lib/admin-upload-storage';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES = new Map([
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.avif', 'image/avif'],
]);

function getContentType(fileName: string): string {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return CONTENT_TYPES.get(extension) || 'application/octet-stream';
}

export async function GET(_request: NextRequest, context: { params: Promise<{ scope: string; fileName: string }> }) {
  const { scope, fileName } = await context.params;
  if ((scope !== 'books' && scope !== 'events') || !fileName) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const fileBuffer = await readFile(resolveLocalAdminUploadPath(scope, fileName));
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': getContentType(fileName),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}