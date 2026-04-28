import { describe, it, expect } from 'vitest';
import { processAdminImageUpload } from '@/lib/admin-image-processing';
import sharp from 'sharp';

describe('admin-image-processing', () => {
  describe('processAdminImageUpload', () => {
    it('should process a valid image', async () => {
      const testImageBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
        'base64'
      );

      const result = await processAdminImageUpload(testImageBuffer);

      expect(result.contentType).toBe('image/webp');
      expect(result.extension).toBe('.webp');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.blurDataURL).toMatch(/^data:image\/webp;base64,/);
    });

    it('should resize large images', async () => {
      const largeImage = await sharp({
        create: {
          width: 3000,
          height: 2000,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await processAdminImageUpload(largeImage);

      expect(result.width).toBeLessThanOrEqual(1800);
      expect(result.height).toBeLessThanOrEqual(1800);
      expect(result.contentType).toBe('image/webp');
    });

    it('should not enlarge small images', async () => {
      const smallImage = await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await processAdminImageUpload(smallImage);

      expect(result.width).toBeLessThanOrEqual(400);
      expect(result.height).toBeLessThanOrEqual(300);
    });

    it('should handle portrait images', async () => {
      const portraitImage = await sharp({
        create: {
          width: 1000,
          height: 2000,
          channels: 4,
          background: { r: 0, g: 0, b: 255, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await processAdminImageUpload(portraitImage);

      expect(result.height).toBeLessThanOrEqual(1800);
      expect(result.contentType).toBe('image/webp');
    });

    it('should handle landscape images', async () => {
      const landscapeImage = await sharp({
        create: {
          width: 2400,
          height: 1200,
          channels: 4,
          background: { r: 255, g: 255, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await processAdminImageUpload(landscapeImage);

      expect(result.width).toBeLessThanOrEqual(1800);
      expect(result.contentType).toBe('image/webp');
    });

    it('should auto-rotate images based on EXIF', async () => {
      const imageWithExif = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 4,
          background: { r: 128, g: 128, b: 128, alpha: 1 },
        },
      })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer();

      const result = await processAdminImageUpload(imageWithExif);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.contentType).toBe('image/webp');
    });

    it('should generate blur data URL', async () => {
      const testImage = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 4,
          background: { r: 100, g: 150, b: 200, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await processAdminImageUpload(testImage);

      expect(result.blurDataURL).toMatch(/^data:image\/webp;base64,/);
      const base64Data = result.blurDataURL.split(',')[1];
      expect(base64Data.length).toBeGreaterThan(0);

      const blurBuffer = Buffer.from(base64Data, 'base64');
      const blurMetadata = await sharp(blurBuffer).metadata();
      expect(blurMetadata.width).toBeLessThanOrEqual(24);
    });

    it('should throw error for invalid image', async () => {
      const invalidBuffer = Buffer.from('not an image');

      await expect(processAdminImageUpload(invalidBuffer))
        .rejects.toThrow();
    });

    it('should throw error for empty buffer', async () => {
      const emptyBuffer = Buffer.from([]);

      await expect(processAdminImageUpload(emptyBuffer))
        .rejects.toThrow();
    });

    it('should handle JPEG images', async () => {
      const jpegImage = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 3,
          background: { r: 255, g: 128, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await processAdminImageUpload(jpegImage);

      expect(result.contentType).toBe('image/webp');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle PNG images with transparency', async () => {
      const pngImage = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0.5 },
        },
      })
        .png()
        .toBuffer();

      const result = await processAdminImageUpload(pngImage);

      expect(result.contentType).toBe('image/webp');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle WebP images', async () => {
      const webpImage = await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 4,
          background: { r: 50, g: 100, b: 150, alpha: 1 },
        },
      })
        .webp()
        .toBuffer();

      const result = await processAdminImageUpload(webpImage);

      expect(result.contentType).toBe('image/webp');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });
  });
});
