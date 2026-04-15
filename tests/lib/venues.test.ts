import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockFetchRows, mockFetchSingleRow, mockInsertRow, mockUpdateRow, mockDeleteRow } = vi.hoisted(() => ({
  mockFetchRows: vi.fn(),
  mockFetchSingleRow: vi.fn(),
  mockInsertRow: vi.fn(),
  mockUpdateRow: vi.fn(),
  mockDeleteRow: vi.fn(),
}));

vi.mock('@/lib/supabase-utils', () => ({
  fetchRows: mockFetchRows,
  fetchSingleRow: mockFetchSingleRow,
  insertRow: mockInsertRow,
  updateRow: mockUpdateRow,
  deleteRow: mockDeleteRow,
}));

import {
  getAllVenues,
  getVenueById,
  createVenue,
  updateVenue,
  deleteVenue,
} from '@/lib/venues';
import type { Venue, VenueRow } from '@/types/venue';

describe('venues', () => {
  const mockVenueRow: VenueRow = {
    id: 1,
    name: 'Test Venue TW',
    location: 'TW',
    address: '123 Test Street, Taipei',
    max_capacity: 20,
    is_virtual: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllVenues', () => {
    it('fetches all venues sorted by name', async () => {
      mockFetchRows.mockResolvedValueOnce([
        mockVenueRow,
        { ...mockVenueRow, id: 2, name: 'Another Venue', location: 'NL' },
      ]);

      const venues = await getAllVenues();

      expect(mockFetchRows).toHaveBeenCalledWith('venues', '*', 'order=name.asc');
      expect(venues).toHaveLength(2);
      expect(venues[0].id).toBe(1);
      expect(venues[1].id).toBe(2);
    });

    it('returns empty array when no venues exist', async () => {
      mockFetchRows.mockResolvedValueOnce([]);

      const venues = await getAllVenues();

      expect(venues).toEqual([]);
    });
  });

  describe('getVenueById', () => {
    it('fetches venue by ID', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(mockVenueRow);

      const venue = await getVenueById(1);

      expect(mockFetchSingleRow).toHaveBeenCalledWith('venues', '*', 'id=eq.1');
      expect(venue?.id).toBe(1);
      expect(venue?.name).toBe('Test Venue TW');
      expect(venue?.location).toBe('TW');
    });

    it('returns undefined when venue not found', async () => {
      mockFetchSingleRow.mockResolvedValueOnce(null);

      const venue = await getVenueById(999);

      expect(venue).toBeUndefined();
    });
  });

  describe('createVenue', () => {
    it('creates a new venue', async () => {
      const newVenue: Omit<Venue, 'id' | 'createdAt' | 'updatedAt'> = {
        name: 'New Venue',
        location: 'NL',
        address: '456 New Street, Amsterdam',
        maxCapacity: 15,
        isVirtual: false,
      };

      mockInsertRow.mockResolvedValueOnce({
        ...mockVenueRow,
        id: 3,
        name: 'New Venue',
        location: 'NL',
      });

      const createdVenue = await createVenue(newVenue);

      expect(mockInsertRow).toHaveBeenCalledWith(
        'venues',
        expect.objectContaining({
          name: 'New Venue',
          location: 'NL',
          max_capacity: 15,
        })
      );
      expect(createdVenue.id).toBe(3);
      expect(createdVenue.name).toBe('New Venue');
    });

    it('creates venue with all required fields', async () => {
      const newVenue: Omit<Venue, 'id' | 'createdAt' | 'updatedAt'> = {
        name: 'Venue Without EN',
        location: 'TW',
        address: 'Test Address',
        maxCapacity: 10,
        isVirtual: false,
      };

      mockInsertRow.mockResolvedValueOnce(mockVenueRow);

      await createVenue(newVenue);

      expect(mockInsertRow).toHaveBeenCalled();
    });
  });

  describe('updateVenue', () => {
    it('updates an existing venue', async () => {
      const updates = {
        name: 'Updated Venue Name',
        maxCapacity: 25,
      };

      mockUpdateRow.mockResolvedValueOnce({
        ...mockVenueRow,
        name: 'Updated Venue Name',
        max_capacity: 25,
      });

      const updatedVenue = await updateVenue(1, updates);

      expect(mockUpdateRow).toHaveBeenCalledWith(
        'venues',
        'id=eq.1',
        expect.objectContaining({
          name: 'Updated Venue Name',
          max_capacity: 25,
        })
      );
      expect(updatedVenue.name).toBe('Updated Venue Name');
      expect(updatedVenue.maxCapacity).toBe(25);
    });

    it('updates venue with partial fields', async () => {
      mockUpdateRow.mockResolvedValueOnce(mockVenueRow);

      await updateVenue(1, { address: 'New Address' });

      expect(mockUpdateRow).toHaveBeenCalled();
    });
  });

  describe('deleteVenue', () => {
    it('deletes a venue by ID', async () => {
      mockDeleteRow.mockResolvedValueOnce(undefined);

      await deleteVenue(1);

      expect(mockDeleteRow).toHaveBeenCalledWith('venues', 'id=eq.1');
    });

    it('fails when venue has foreign key constraints', async () => {
      mockDeleteRow.mockRejectedValueOnce(
        new Error('FK constraint violation')
      );

      await expect(deleteVenue(1)).rejects.toThrow();
    });
  });
});
