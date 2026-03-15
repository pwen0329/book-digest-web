import { readFile, stat } from 'node:fs/promises';
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

async function buildFileResponse(scope: string, fileName: string, method: 'GET' | 'HEAD') {
  const filePath = resolveLocalAdminUploadPath(scope as 'books' | 'events', fileName);
  const fileInfo = await stat(filePath);
  const headers = {
    'Content-Type': getContentType(fileName),
    'Content-Length': String(fileInfo.size),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Disposition': 'inline',
  };

  if (method === 'HEAD') {
    return new NextResponse(null, { status: 200, headers });
  }

  const fileBuffer = await readFile(filePath);
  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers,
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ scope: string; fileName: string }> }) {
  const { scope, fileName } = await context.params;
  if ((scope !== 'books' && scope !== 'events') || !fileName) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    return await buildFileResponse(scope, fileName, 'GET');
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export async function HEAD(_request: NextRequest, context: { params: Promise<{ scope: string; fileName: string }> }) {
  const { scope, fileName } = await context.params;
  if ((scope !== 'books' && scope !== 'events') || !fileName) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    return await buildFileResponse(scope, fileName, 'HEAD');
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}