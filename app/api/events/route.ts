import { NextRequest, NextResponse } from 'next/server';
import { runWithRequestTrace } from '@/lib/observability';
import { getAllEvents } from '@/lib/events';
import type { VenueLocation } from '@/types/venue';

export const dynamic = 'force-dynamic';

// GET /api/events - Get all published events (public endpoint)
// Query params: ?venueLocation=TW|NL|ONLINE
// NOTE: isPublished is ALWAYS true and cannot be overridden via URL params
export async function GET(request: NextRequest) {
  return runWithRequestTrace(request, 'events.get_all', async () => {
    const { searchParams } = new URL(request.url);
    const venueLocation = searchParams.get('venueLocation') as VenueLocation | null;

    // Validate venueLocation if provided
    if (venueLocation && !['TW', 'NL', 'ONLINE'].includes(venueLocation)) {
      return NextResponse.json(
        { error: 'Invalid venueLocation. Must be TW, NL, or ONLINE.' },
        { status: 400 }
      );
    }

    const events = await getAllEvents({
      venueLocation: venueLocation || undefined,
      isPublished: true, // ALWAYS true - cannot be overridden from URL params
      includeVenue: true,
      includeBook: true,
    });

    return NextResponse.json({ events }, { status: 200 });
  });
}
