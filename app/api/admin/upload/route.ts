import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { resolveWorkspacePath } from '@/lib/json-store';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
]);

function sanitizeFileSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'upload';
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scope = request.nextUrl.searchParams.get('scope');
  if (scope !== 'books' && scope !== 'events') {
    return NextResponse.json({ error: 'Invalid upload scope.' }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
  }

  const extension = ALLOWED_MIME_TYPES.get(file.type);
  if (!extension) {
    return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File is too large.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = sanitizeFileSegment(file.name.replace(/\.[^.]+$/, ''));
  const relativeDirectory = path.join('public', 'uploads', 'admin', scope);
  const absoluteDirectory = resolveWorkspacePath(relativeDirectory);
  mkdirSync(absoluteDirectory, { recursive: true });

  const fileName = `${Date.now()}-${baseName}${extension}`;
  const relativePath = path.join(relativeDirectory, fileName);
  const absolutePath = resolveWorkspacePath(relativePath);
  writeFileSync(absolutePath, buffer);

  return NextResponse.json({ ok: true, src: `/uploads/admin/${scope}/${fileName}` }, { status: 201 });
}