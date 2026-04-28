import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  SUPABASE_CONFIG: {
    STORAGE_BUCKET: 'test-bucket',
  },
}));

vi.mock('@/lib/supabase-utils', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseServiceRoleKey: vi.fn(() => 'test-service-role-key'),
}));

const { saveAdminUpload } = await import('@/lib/admin-upload-storage');

describe('admin-upload-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('saveAdminUpload', () => {
    it('should upload book image successfully', async () => {
      const testBuffer = Buffer.from('test-image-data');

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const url = await saveAdminUpload('books', 'test-image.webp', 'image/webp', testBuffer);

      expect(url).toBe('https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/test-image.webp');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.supabase.co/storage/v1/object/test-bucket/admin/books/test-image.webp',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            apikey: 'test-service-role-key',
            Authorization: 'Bearer test-service-role-key',
            'Content-Type': 'image/webp',
            'x-upsert': 'true',
          }),
        })
      );
    });

    it('should upload event image successfully', async () => {
      const testBuffer = Buffer.from('test-event-image');

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const url = await saveAdminUpload('events', 'event-cover.webp', 'image/webp', testBuffer);

      expect(url).toBe('https://test.supabase.co/storage/v1/object/public/test-bucket/admin/events/event-cover.webp');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://test.supabase.co/storage/v1/object/test-bucket/admin/events/event-cover.webp',
        expect.any(Object)
      );
    });

    it('should handle upload failure', async () => {
      const testBuffer = Buffer.from('test-image-data');

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      } as Response);

      await expect(saveAdminUpload('books', 'test.webp', 'image/webp', testBuffer))
        .rejects.toThrow('Supabase upload failed: 500 Internal server error');
    });

    it('should handle upload failure with no error message', async () => {
      const testBuffer = Buffer.from('test-image-data');

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
        text: vi.fn().mockRejectedValue(new Error('Cannot read text')),
      } as any);

      await expect(saveAdminUpload('books', 'test.webp', 'image/webp', testBuffer))
        .rejects.toThrow('Supabase upload failed: 403 unknown');
    });

    it('should use upsert flag to overwrite existing files', async () => {
      const testBuffer = Buffer.from('updated-image-data');

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await saveAdminUpload('books', 'existing.webp', 'image/webp', testBuffer);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-upsert': 'true',
          }),
        })
      );
    });

    it('should send buffer as Uint8Array', async () => {
      const testBuffer = Buffer.from([1, 2, 3, 4, 5]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      await saveAdminUpload('books', 'test.webp', 'image/webp', testBuffer);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.any(Uint8Array),
        })
      );
    });
  });
});
