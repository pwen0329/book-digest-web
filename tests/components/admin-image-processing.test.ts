import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('server-only', () => ({}));

import { processAdminImageUpload } from '@/lib/admin-image-processing';

describe('admin image processing', () => {
  it('converts uploaded images into optimized webp output', async () => {
    const input = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: { r: 255, g: 120, b: 40 },
      },
    }).png().toBuffer();

    const output = await processAdminImageUpload(input);

    expect(output.contentType).toBe('image/webp');
    expect(output.extension).toBe('.webp');
    expect(output.width).toBeLessThanOrEqual(1200);
    expect(output.height).toBeLessThanOrEqual(800);
    expect(output.buffer.byteLength).toBeGreaterThan(0);
  });
});