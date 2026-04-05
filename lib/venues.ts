import 'server-only';

import path from 'node:path';
import { statSync } from 'node:fs';
import type { Venue, VenueRow } from '@/types/venue';
import { venueFromRow, venueToRow } from '@/types/venue';
import {
  fetchRows,
  fetchSingleRow,
  insertRow,
  updateRow,
  deleteRow,
  isSupabaseConfigured,
  shouldForceLocalPersistentStores,
} from '@/lib/supabase-utils';
import { readJsonFile, resolveWorkspacePath, writeJsonFile } from '@/lib/json-store';

const TABLE_NAME = process.env.SUPABASE_VENUES_TABLE || 'venues';
const LOCAL_VENUES_ROOT = '.local/playwright-admin-documents';
const FALLBACK_VENUES_FILE = 'data/venues.json';

function getEffectiveFallbackFile(fallbackFile: string): string {
  if (!shouldForceLocalPersistentStores()) {
    return fallbackFile;
  }
  return path.join(LOCAL_VENUES_ROOT, path.basename(fallbackFile));
}

function ensureEffectiveFallbackSeed(fallbackFile: string): string {
  const effectiveFallbackFile = getEffectiveFallbackFile(fallbackFile);
  if (effectiveFallbackFile === fallbackFile) {
    return fallbackFile;
  }

  try {
    statSync(resolveWorkspacePath(effectiveFallbackFile));
    return effectiveFallbackFile;
  } catch {
    // Seed the local file from the fallback file
    const seedData = readJsonFile<Venue[]>(fallbackFile);
    writeJsonFile(effectiveFallbackFile, seedData);
    return effectiveFallbackFile;
  }
}

// Read all venues from file
function readVenuesFromFile(): Venue[] {
  const effectiveFallbackFile = ensureEffectiveFallbackSeed(FALLBACK_VENUES_FILE);
  return readJsonFile<Venue[]>(effectiveFallbackFile);
}

// Write all venues to file
function writeVenuesToFile(venues: Venue[]): void {
  const effectiveFallbackFile = ensureEffectiveFallbackSeed(FALLBACK_VENUES_FILE);
  writeJsonFile(effectiveFallbackFile, venues);
}

// Get next ID from file-backed venues
function getNextIdFromFile(venues: Venue[]): number {
  if (venues.length === 0) {
    return 1;
  }
  return Math.max(...venues.map(v => v.id)) + 1;
}

// Get all venues
export async function getAllVenues(): Promise<Venue[]> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    return readVenuesFromFile();
  }

  const rows = await fetchRows<VenueRow>(TABLE_NAME, '*', 'order=name.asc');
  return rows.map(venueFromRow);
}

// Get venue by ID
export async function getVenueById(id: number): Promise<Venue | null> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const venues = readVenuesFromFile();
    return venues.find(v => v.id === id) || null;
  }

  const row = await fetchSingleRow<VenueRow>(TABLE_NAME, '*', `id=eq.${id}`);
  return row ? venueFromRow(row) : null;
}

// Create venue
export async function createVenue(
  venue: Omit<Venue, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Venue> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const venues = readVenuesFromFile();
    const now = new Date().toISOString();
    const newVenue: Venue = {
      ...venue,
      id: getNextIdFromFile(venues),
      createdAt: now,
      updatedAt: now,
    };
    writeVenuesToFile([...venues, newVenue]);
    return newVenue;
  }

  const row = venueToRow(venue);
  const result = await insertRow<VenueRow>(TABLE_NAME, row);
  return venueFromRow(result);
}

// Update venue
export async function updateVenue(
  id: number,
  updates: Partial<Omit<Venue, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Venue> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const venues = readVenuesFromFile();
    const index = venues.findIndex(v => v.id === id);
    if (index === -1) {
      throw new Error(`Venue with id ${id} not found`);
    }
    const updatedVenue: Venue = {
      ...venues[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    venues[index] = updatedVenue;
    writeVenuesToFile(venues);
    return updatedVenue;
  }

  const row = venueToRow(updates);
  const result = await updateRow<VenueRow>(TABLE_NAME, `id=eq.${id}`, row);
  return venueFromRow(result);
}

// Delete venue (will fail if events reference it due to FK constraint)
export async function deleteVenue(id: number): Promise<void> {
  if (!isSupabaseConfigured()) {
    // File-backed fallback
    const venues = readVenuesFromFile();
    const filtered = venues.filter(v => v.id !== id);
    if (filtered.length === venues.length) {
      throw new Error(`Venue with id ${id} not found`);
    }
    writeVenuesToFile(filtered);
    return;
  }

  await deleteRow(TABLE_NAME, `id=eq.${id}`);
}
