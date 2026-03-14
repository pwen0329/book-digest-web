import 'server-only';

import sharp from 'sharp';

export type ProcessedAdminImage = {
  buffer: Buffer;
  contentType: 'image/webp';
  extension: '.webp';
  width: number;
  height: number;
};

const MAX_IMAGE_DIMENSION = 1800;
const WEBP_QUALITY = 82;

export async function processAdminImageUpload(input: Buffer): Promise<ProcessedAdminImage> {
  const pipeline = sharp(input, { failOn: 'error' }).rotate();
  const metadata = await pipeline.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read the uploaded image dimensions.');
  }

  const resized = pipeline.resize({
    width: metadata.width > metadata.height ? MAX_IMAGE_DIMENSION : undefined,
    height: metadata.height >= metadata.width ? MAX_IMAGE_DIMENSION : undefined,
    fit: 'inside',
    withoutEnlargement: true,
  });

  const output = await resized.webp({ quality: WEBP_QUALITY, effort: 5 }).toBuffer({ resolveWithObject: true });

  return {
    buffer: output.data,
    contentType: 'image/webp',
    extension: '.webp',
    width: output.info.width,
    height: output.info.height,
  };
}