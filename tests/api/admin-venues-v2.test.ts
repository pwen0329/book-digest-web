import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/venues-v2/route';

vi.mock('@/lib/admin-auth', () => ({
  isAuthorizedAdminRequest: vi.fn(),
}));

vi.mock('@/lib/observability', () => ({
  runWithRequestTrace: vi.fn((req, name, fn) => fn()),
}));

vi.mock('@/lib/venues', () => ({
  getAllVenues: vi.fn(),
}));

import { isAuthorizedAdminRequest } from '@/lib/admin-auth';
import { getAllVenues } from '@/lib/venues';
import type { Venue } from '@/types/venue';

describe('/api/admin/venues-v2', () => {
  const mockVenues: Venue[] = [
    {
      id: 1,
      name: 'Venue TW',
      nameEn: 'Venue TW EN',
      location: 'TW',
      address: 'Taipei Address',
      maxCapacity: 20,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'Venue NL',
      nameEn: 'Venue NL EN',
      location: 'NL',
      address: 'Amsterdam Address',
      maxCapacity: 15,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns 401 when not authorized', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(false);

      const request = new NextRequest('http://localhost/api/admin/venues-v2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns all venues when authorized', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(getAllVenues).mockResolvedValueOnce(mockVenues);

      const request = new NextRequest('http://localhost/api/admin/venues-v2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.venues).toHaveLength(2);
      expect(data.venues[0].location).toBe('TW');
      expect(data.venues[1].location).toBe('NL');
    });

    it('returns empty array when no venues exist', async () => {
      vi.mocked(isAuthorizedAdminRequest).mockResolvedValueOnce(true);
      vi.mocked(getAllVenues).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost/api/admin/venues-v2');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.venues).toEqual([]);
    });
  });
});
