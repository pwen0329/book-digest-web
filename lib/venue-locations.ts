import type { VenueLocation } from '@/types/event';

/**
 * Venue location configuration with display names and timezone info
 */
export type VenueLocationConfig = {
  code: string;
  displayName: string;
  displayNameZh: string;
  timezone: string; // IANA timezone identifier
  hasDST: boolean;  // Whether this location observes daylight saving time
};

export const VENUE_LOCATIONS: Record<string, VenueLocationConfig> = {
  TW: {
    code: 'TW',
    displayName: 'Taiwan',
    displayNameZh: '台灣',
    timezone: 'Asia/Taipei',
    hasDST: false,
  },
  NL: {
    code: 'NL',
    displayName: 'Netherlands',
    displayNameZh: '荷蘭',
    timezone: 'Europe/Amsterdam',
    hasDST: true,
  },
  ONLINE: {
    code: 'ONLINE',
    displayName: 'Online',
    displayNameZh: '線上',
    timezone: 'UTC',
    hasDST: false,
  },
};

/**
 * Get venue location configuration by code
 */
export function getVenueLocation(locationCode: string): VenueLocationConfig | null {
  return VENUE_LOCATIONS[locationCode] || null;
}

/**
 * Get timezone for a venue location code
 */
export function getTimezoneForVenue(locationCode: string): string {
  const location = getVenueLocation(locationCode);
  return location?.timezone || 'UTC';
}

/**
 * Get all valid venue locations
 */
export function getVenueLocations(): VenueLocation[] {
  return Object.keys(VENUE_LOCATIONS) as VenueLocation[];
}
