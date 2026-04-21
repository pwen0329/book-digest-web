import 'server-only';

import type { Venue, VenueRow } from '@/types/venue';
import { venueFromRow, venueToRow } from '@/types/venue';
import {
  fetchRows,
  fetchSingleRow,
  insertRow,
  updateRow,
  deleteRow,
} from '@/lib/supabase-utils';
import { SUPABASE_CONFIG } from '@/lib/env';

const TABLE_NAME = SUPABASE_CONFIG.TABLES.VENUES;

// Get all venues
export async function getAllVenues(): Promise<Venue[]> {
  const rows = await fetchRows<VenueRow>(TABLE_NAME, '*', 'order=name.asc');
  return rows.map(venueFromRow);
}

// Get venue by ID
export async function getVenueById(id: number): Promise<Venue | undefined> {
  const row = await fetchSingleRow<VenueRow>(TABLE_NAME, '*', `id=eq.${id}`);
  return row ? venueFromRow(row) : undefined;
}

// Create venue
export async function createVenue(
  venue: Omit<Venue, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Venue> {
  const row = venueToRow(venue);
  const result = await insertRow<VenueRow>(TABLE_NAME, row);
  return venueFromRow(result);
}

// Update venue
export async function updateVenue(
  id: number,
  updates: Partial<Omit<Venue, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Venue> {
  const row = venueToRow(updates);
  const result = await updateRow<VenueRow>(TABLE_NAME, `id=eq.${id}`, row);
  return venueFromRow(result);
}

// Delete venue (will fail if events reference it due to FK constraint)
export async function deleteVenue(id: number): Promise<void> {
  await deleteRow(TABLE_NAME, `id=eq.${id}`);
}
