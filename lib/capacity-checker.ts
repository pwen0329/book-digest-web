import 'server-only';

import { getEventById } from '@/lib/events';
import { countRows } from '@/lib/supabase-utils';
import { SUPABASE_CONFIG } from '@/lib/env';

const REGISTRATIONS_TABLE = SUPABASE_CONFIG.TABLES.REGISTRATIONS;

export type CapacityStatus = {
  total: number;
  registered: number;
  available: number;
  isFull: boolean;
  percentageFull: number;
};

// Check capacity for a specific event
export async function checkEventCapacity(eventId: number): Promise<CapacityStatus> {
  const event = await getEventById(eventId);
  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }

  const registered = await countRows(REGISTRATIONS_TABLE, `event_id=eq.${eventId}`);

  return {
    total: event.venueCapacity,
    registered,
    available: Math.max(0, event.venueCapacity - registered),
    isFull: registered >= event.venueCapacity,
    percentageFull: (registered / event.venueCapacity) * 100,
  };
}

// Check if event has available capacity
export async function hasAvailableCapacity(eventId: number): Promise<boolean> {
  const status = await checkEventCapacity(eventId);
  return !status.isFull;
}

// Get capacity status for multiple events
export async function checkMultipleEventsCapacity(
  eventIds: number[]
): Promise<Map<number, CapacityStatus>> {
  const results = new Map<number, CapacityStatus>();

  await Promise.all(
    eventIds.map(async (eventId) => {
      try {
        const status = await checkEventCapacity(eventId);
        results.set(eventId, status);
      } catch (error) {
        // Skip events that fail to load
        console.error(`Failed to check capacity for event ${eventId}:`, error);
      }
    })
  );

  return results;
}
