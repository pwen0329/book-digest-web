// Venue type - physical or virtual locations where events are held

export type VenueLocation = 'TW' | 'NL' | 'ONLINE';

/**
 * Get all supported venue locations.
 * This centralized list replaces hardcoded ['TW', 'NL', 'ONLINE'] arrays
 * scattered throughout the codebase.
 *
 * @returns Array of supported VenueLocation values
 */
export function getVenueLocations(): VenueLocation[] {
  return ['TW', 'NL', 'ONLINE'];
}

export type Venue = {
  id: number;
  name: string;
  location: VenueLocation;
  address?: string;
  maxCapacity: number;
  isVirtual: boolean;
  createdAt: string;
  updatedAt: string;
};

// Database column names (snake_case) for Supabase queries
export type VenueRow = {
  id: number;
  name: string;
  location: string;
  address: string | null;
  max_capacity: number;
  is_virtual: boolean;
  created_at: string;
  updated_at: string;
};

// Convert database row to application type
export function venueFromRow(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    location: row.location as VenueLocation,
    address: row.address ?? undefined,
    maxCapacity: row.max_capacity,
    isVirtual: row.is_virtual,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Convert application type to database row (for inserts/updates)
export function venueToRow(venue: Partial<Venue>): Partial<VenueRow> {
  const row: Partial<VenueRow> = {};
  if (venue.name !== undefined) row.name = venue.name;
  if (venue.location !== undefined) row.location = venue.location;
  if (venue.address !== undefined) row.address = venue.address ?? null;
  if (venue.maxCapacity !== undefined) row.max_capacity = venue.maxCapacity;
  if (venue.isVirtual !== undefined) row.is_virtual = venue.isVirtual;
  return row;
}
