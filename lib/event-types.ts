import 'server-only';

import type { EventType, EventTypeRow } from '@/types/event-type';
import { eventTypeFromRow } from '@/types/event-type';
import { fetchRows, fetchSingleRow, isSupabaseConfigured } from '@/lib/supabase-utils';
import { readJsonFile, writeJsonFile } from '@/lib/json-store';

const TABLE_NAME = process.env.SUPABASE_EVENT_TYPES_TABLE || 'event_types';
const FALLBACK_EVENT_TYPES_FILE = 'data/event-types.json';

// Read event types from file
function readEventTypesFromFile(): EventType[] {
  return readJsonFile<EventType[]>(FALLBACK_EVENT_TYPES_FILE);
}

// Write event types to file
function writeEventTypesToFile(eventTypes: EventType[]): void {
  writeJsonFile(FALLBACK_EVENT_TYPES_FILE, eventTypes);
}

// Get all event types
export async function getAllEventTypes(): Promise<EventType[]> {
  if (!isSupabaseConfigured()) {
    return readEventTypesFromFile();
  }

  const rows = await fetchRows<EventTypeRow>(TABLE_NAME, '*', 'order=code.asc');
  return rows.map(eventTypeFromRow);
}

// Get event type by code
export async function getEventTypeByCode(code: string): Promise<EventType | null> {
  if (!isSupabaseConfigured()) {
    const eventTypes = readEventTypesFromFile();
    return eventTypes.find(et => et.code === code) || null;
  }

  const row = await fetchSingleRow<EventTypeRow>(TABLE_NAME, '*', `code=eq.${code}`);
  return row ? eventTypeFromRow(row) : null;
}
