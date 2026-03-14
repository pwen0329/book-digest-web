import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { processAdminImageUpload } from '@/lib/admin-image-processing';
import { saveAdminUpload } from '@/lib/admin-upload-storage';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

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

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File is too large.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = sanitizeFileSegment(file.name.replace(/\.[^.]+$/, ''));

  let processedImage;
  try {
    processedImage = await processAdminImageUpload(buffer);
  } catch (error) {
    console.error('[api/admin/upload] Image processing failed', { scope, fileName: file.name, error });
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to process this image.',
    }, { status: 400 });
  }

  const fileName = `${Date.now()}-${baseName}${processedImage.extension}`;

  let src: string;
  try {
    src = await saveAdminUpload(scope, fileName, processedImage.contentType, processedImage.buffer);
  } catch (error) {
    console.error('[api/admin/upload] Image storage failed', { scope, fileName, error });
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to store this image.',
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    src,
    width: processedImage.width,
    height: processedImage.height,
    format: 'webp',
  }, { status: 201 });
}