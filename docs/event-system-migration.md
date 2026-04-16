# Event System Migration - Implementation Summary

**Date:** 2026-04-06
**Status:** Completed

## Overview

Successfully migrated from location-based events navigation to a venue-based events system with event type filtering. The new system provides better UX by organizing events first by venue location, then by event type.

## Key Changes

### 1. Navigation Structure
- **Before:** Single `/events` page with location tabs
- **After:** Events dropdown in header with venue options (Taiwan, Netherlands, Online)
- **Routes:** `/[locale]/events/[venueLocation]` (e.g., `/en/events/TW`)

### 2. Event Types
Split BOOK_CLUB into language-specific types:
- `MANDARIN_BOOK_CLUB` - Chinese language book club
- `ENGLISH_BOOK_CLUB` - English language book club
- `FAMILY_READING_CLUB` - Family reading events (unchanged)
- `DETOX` - Digital detox events (unchanged)

### 3. Page Structure
Each venue page now displays:
- **Statistics counters** (reading days, clubs held, readers joined) - calculated server-side using time-based formulas
- **Event type tabs** for filtering (Mandarin Book Club, English Book Club, etc.)
- **Event cards** displayed chronologically, sorted by event date
- **Registration status** (Open, Coming Soon, Closed)

### 4. Header Component
- Events nav link converted to dropdown menu
- Dropdown opens on hover (desktop) with venue options
- Maintains hover-sensitive area with padding instead of margin
- Z-index hierarchy: Header (100), Dropdown (101), Language toggle (102)

### 5. Image Error Handling
- **Server-side:** Validates image URLs, replaces invalid URLs with default image
- **Client-side:** `onError` handler with fallback UI showing icon + message
- **Image optimization:** Added `unoptimized` prop to prevent Next.js optimization errors

### 6. Locale Switching
- Fixed Next.js 15 async params handling
- Updated `params` type to `Promise<{ locale, venueLocation }>`
- Properly awaits params before extracting locale
- Passes explicit locale to `getTranslations`

## Files Modified

### Core Application Files
- `app/[locale]/events/[venueLocation]/page.tsx` - New venue-specific events page (server component)
- `app/[locale]/events/[venueLocation]/client.tsx` - Event type filtering and display (client component)
- `components/Header.tsx` - Events dropdown with hover interaction
- `components/FloatingLangToggle.tsx` - Z-index update for proper stacking

### Data Files
- `data/event-types.json` - Added MANDARIN_BOOK_CLUB and ENGLISH_BOOK_CLUB
- `data/events.json` - Fixed typo: `MARDARIN_BOOK_CLUB` → `MANDARIN_BOOK_CLUB`

### Translation Files
- `messages/en.json` - Added `imageNotAvailable`, venue labels, location label
- `messages/zh.json` - Added corresponding Chinese translations

### Admin Components
- `components/admin/EventManager.tsx` - Fixed default event type typo
- `lib/db/migrations/006_create_event_types.sql` - Updated to reflect new event types

### Library Functions
- `lib/event-types.ts` - Renamed `getAllEventTypes` → `getEventTypes`
- `app/api/admin/event-types/route.ts` - Updated to use renamed function

### Documentation
- `docs/design.md` - Updated with event-based system architecture, routing, data models, and sequence diagrams

## Technical Implementation Details

### Server-Side Image Validation
```typescript
const isValidImagePath = (url: string | null | undefined): boolean => {
  return !!url && typeof url === 'string' && url.startsWith('/');
};

const events = rawEvents.map(event => ({
  ...event,
  coverUrl: isValidImagePath(event.coverUrl) ? event.coverUrl : DEFAULT_IMAGE,
  coverUrlEn: isValidImagePath(event.coverUrlEn) ? event.coverUrlEn : null,
}));
```

### Statistics Calculation
Time-based formula (same as original):
```typescript
const startDate = new Date('2020-07-31');
const readingDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

const baseDate = new Date('2026-03-01');
const monthsDiff = (now.getFullYear() - baseDate.getFullYear()) * 12 + (now.getMonth() - baseDate.getMonth());
const safeMonthsDiff = Math.max(0, monthsDiff);

const clubsHeld = 78 + safeMonthsDiff * 2;
const readersJoined = 300 + safeMonthsDiff * 15;
```

### Dropdown Hover Interaction
```typescript
<div
  onMouseEnter={() => setEventsDropdownOpen(true)}
  onMouseLeave={() => setEventsDropdownOpen(false)}
>
  <button>Events</button>
  {eventsDropdownOpen && (
    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-[101]">
      {/* pt-2 instead of mt-2 to maintain hover area */}
      <div className="bg-white shadow-lg rounded-md">
        {/* Dropdown content */}
      </div>
    </div>
  )}
</div>
```

### Next.js 15 Async Params
```typescript
type Props = {
  params: Promise<{ locale: string; venueLocation: string }>;
};

export default async function VenueEventsPage({ params }: Props) {
  const { locale, venueLocation } = await params;
  const t = await getTranslations({ locale, namespace: 'events' });
  // ...
}
```

## Benefits

1. **Better UX:** Users select venue first (in navigation), then filter by event type
2. **Clearer Organization:** Events grouped by location with secondary type filtering
3. **Language-Specific Events:** Separate types for Mandarin and English book clubs
4. **Graceful Degradation:** Invalid images handled without crashing the page
5. **Proper Internationalization:** Locale switching works correctly with async params
6. **Clean Navigation:** Dropdown hover interaction feels natural and responsive

## Migration Notes

### For Admins
- Existing events with `BOOK_CLUB` type need manual update to either `MANDARIN_BOOK_CLUB` or `ENGLISH_BOOK_CLUB`
- Event image URLs should start with `/` (local paths) - invalid URLs will be replaced with default

### For Database Migration
- Run updated migration `006_create_event_types.sql` to populate new event types
- Update existing event records to use new event type codes

## Known Issues Resolved

1. ✅ Fixed typo: `MARDARIN_BOOK_CLUB` → `MANDARIN_BOOK_CLUB`
2. ✅ Fixed dropdown disappearing when moving mouse (padding vs margin)
3. ✅ Fixed z-index conflicts (book covers hiding dropdown)
4. ✅ Fixed locale toggle not updating content (async params)
5. ✅ Fixed page crash on invalid image URLs (server + client validation)
6. ✅ Fixed stats calculation (restored time-based formula)

## Testing Recommendations

### Manual Testing
- [ ] Navigate to each venue page (TW, NL, ONLINE)
- [ ] Test event type tab filtering on each venue page
- [ ] Test language toggle between EN/ZH on venue pages
- [ ] Test events dropdown hover interaction (desktop)
- [ ] Test events dropdown click interaction (mobile)
- [ ] Test with invalid event image URLs
- [ ] Verify statistics display correctly

### Automated Testing
- [ ] Update E2E tests for new routing structure
- [ ] Add tests for venue dropdown navigation
- [ ] Add tests for event type filtering
- [ ] Add tests for locale switching on venue pages
- [ ] Add tests for image error handling

## Future Enhancements

1. **Event Search:** Add search functionality across all venues
2. **Event Calendar View:** Alternative view showing events in calendar format
3. **Past Events Archive:** Separate section for historical events
4. **Event Capacity:** Display remaining spots for events
5. **Waitlist:** Allow users to join waitlist when events are full
