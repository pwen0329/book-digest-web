import 'server-only';

import type { EventType, EventTypeRow } from '@/types/event-type';
import { eventTypeFromRow } from '@/types/event-type';
import { fetchRows, fetchSingleRow } from '@/lib/supabase-utils';
import { SUPABASE_CONFIG } from '@/lib/env';

const TABLE_NAME = SUPABASE_CONFIG.TABLES.EVENT_TYPES;

// Get all event types
export async function getEventTypes(): Promise<EventType[]> {
  const rows = await fetchRows<EventTypeRow>(TABLE_NAME, '*', 'order=code.asc');
  return rows.map(eventTypeFromRow);
}

// Get event type by code
export async function getEventTypeByCode(code: string): Promise<EventType | null> {
  const row = await fetchSingleRow<EventTypeRow>(TABLE_NAME, '*', `code=eq.${code}`);
  return row ? eventTypeFromRow(row) : null;
}
