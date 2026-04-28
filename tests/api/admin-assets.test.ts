import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, DELETE } from '@/app/api/admin/assets/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

vi.mock('@/lib/admin-asset-manager', () => ({
  buildManagedAssetReport: vi.fn(),
  pruneOrphanedManagedAssets: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  logServerError: vi.fn(),
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

const { isAuthorizedAdminRequest } = await import('@/lib/admin-auth');
const { buildManagedAssetReport, pruneOrphanedManagedAssets } = await import('@/lib/admin-asset-manager');

describe('GET /api/admin/assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authorized', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/admin/assets');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return asset report with default grace period', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(buildManagedAssetReport).mockResolvedValue({
      generatedAt: '2026-04-28T00:00:00Z',
      gracePeriodHours: 168,
      referencedCount: 10,
      storedCount: 12,
      orphanedCount: 2,
      missingReferencedCount: 0,
      orphaned: [],
      missingReferenced: [],
    });

    const request = new NextRequest('http://localhost:3000/api/admin/assets');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.gracePeriodHours).toBe(168);
    expect(data.referencedCount).toBe(10);
    expect(data.storedCount).toBe(12);
    expect(buildManagedAssetReport).toHaveBeenCalledWith(168);
  });

  it('should use custom grace period from query params', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(buildManagedAssetReport).mockResolvedValue({
      generatedAt: '2026-04-28T00:00:00Z',
      gracePeriodHours: 72,
      referencedCount: 5,
      storedCount: 5,
      orphanedCount: 0,
      missingReferencedCount: 0,
      orphaned: [],
      missingReferenced: [],
    });

    const request = new NextRequest('http://localhost:3000/api/admin/assets?gracePeriodHours=72');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(buildManagedAssetReport).toHaveBeenCalledWith(72);
  });

  it('should enforce minimum grace period of 1 hour', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(buildManagedAssetReport).mockResolvedValue({
      generatedAt: '2026-04-28T00:00:00Z',
      gracePeriodHours: 1,
      referencedCount: 0,
      storedCount: 0,
      orphanedCount: 0,
      missingReferencedCount: 0,
      orphaned: [],
      missingReferenced: [],
    });

    const request = new NextRequest('http://localhost:3000/api/admin/assets?gracePeriodHours=0');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(buildManagedAssetReport).toHaveBeenCalledWith(1);
  });

  it('should enforce maximum grace period of 90 days', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(buildManagedAssetReport).mockResolvedValue({
      generatedAt: '2026-04-28T00:00:00Z',
      gracePeriodHours: 2160,
      referencedCount: 0,
      storedCount: 0,
      orphanedCount: 0,
      missingReferencedCount: 0,
      orphaned: [],
      missingReferenced: [],
    });

    const request = new NextRequest('http://localhost:3000/api/admin/assets?gracePeriodHours=5000');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(buildManagedAssetReport).toHaveBeenCalledWith(2160);
  });

  it('should default to 168 hours for invalid grace period', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(buildManagedAssetReport).mockResolvedValue({
      generatedAt: '2026-04-28T00:00:00Z',
      gracePeriodHours: 168,
      referencedCount: 0,
      storedCount: 0,
      orphanedCount: 0,
      missingReferencedCount: 0,
      orphaned: [],
      missingReferenced: [],
    });

    const request = new NextRequest('http://localhost:3000/api/admin/assets?gracePeriodHours=invalid');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(buildManagedAssetReport).toHaveBeenCalledWith(168);
  });

  it('should return 500 on error', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(buildManagedAssetReport).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/admin/assets');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Unable to build asset report.');
  });
});

describe('DELETE /api/admin/assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authorized', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(false);

    const request = new NextRequest('http://localhost:3000/api/admin/assets', { method: 'DELETE' });
    const response = await DELETE(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should prune orphaned assets successfully', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(pruneOrphanedManagedAssets).mockResolvedValue({
      deleted: [
        {
          url: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/books/old.webp',
          scope: 'books',
          fileName: 'old.webp',
          storage: 'supabase',
        },
      ],
      skipped: [],
    });

    const request = new NextRequest('http://localhost:3000/api/admin/assets', { method: 'DELETE' });
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.deleted).toHaveLength(1);
    expect(data.skipped).toHaveLength(0);
  });

  it('should use custom grace period for pruning', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(pruneOrphanedManagedAssets).mockResolvedValue({
      deleted: [],
      skipped: [],
    });

    const request = new NextRequest('http://localhost:3000/api/admin/assets?gracePeriodHours=48', {
      method: 'DELETE',
    });
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    expect(pruneOrphanedManagedAssets).toHaveBeenCalledWith(48);
  });

  it('should return 500 on error', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(pruneOrphanedManagedAssets).mockRejectedValue(new Error('Storage error'));

    const request = new NextRequest('http://localhost:3000/api/admin/assets', { method: 'DELETE' });
    const response = await DELETE(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Unable to prune orphaned assets.');
  });

  it('should report skipped assets', async () => {
    vi.mocked(isAuthorizedAdminRequest).mockResolvedValue(true);
    vi.mocked(pruneOrphanedManagedAssets).mockResolvedValue({
      deleted: [],
      skipped: [
        {
          url: 'https://test.supabase.co/storage/v1/object/public/test-bucket/admin/events/recent.webp',
          scope: 'events',
          fileName: 'recent.webp',
          storage: 'supabase',
        },
      ],
    });

    const request = new NextRequest('http://localhost:3000/api/admin/assets', { method: 'DELETE' });
    const response = await DELETE(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.deleted).toHaveLength(0);
    expect(data.skipped).toHaveLength(1);
  });
});
