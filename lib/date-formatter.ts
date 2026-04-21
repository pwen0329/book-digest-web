import 'server-only';
import { fromZonedTime } from 'date-fns-tz';
import { getTimezoneForVenue } from '@/lib/venue-locations';

/**
 * Format a TIMESTAMPTZ string to human-readable local time format
 * Converts from UTC to the venue's local timezone
 *
 * @param dateString ISO 8601 timestamp in UTC (e.g., "2026-05-01T11:00:00Z")
 * @param locale 'zh' for Chinese format, 'en' for English format
 * @param venueLocation Venue location code (e.g., 'TW', 'NL', 'ONLINE')
 * @returns Formatted date string in local time
 *
 * Examples:
 * - zh + TW: "2026年5月1日 星期四 19:00" (UTC+8)
 * - en + NL: "Thursday, May 1, 2026 at 1:00 PM" (CET/CEST with DST)
 */
export function formatEventDate(
  dateString: string,
  locale: 'zh' | 'en',
  venueLocation: string
): string {
  const date = new Date(dateString);
  const timezone = getTimezoneForVenue(venueLocation);

  if (locale === 'zh') {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    };
    return date.toLocaleString('zh-TW', options);
  } else {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    };
    return date.toLocaleString('en-US', options);
  }
}

/**
 * Convert local time to UTC timestamp for storage
 * Used when admin creates/edits events with local time input
 *
 * @param localDateString Date string in local format (e.g., "2026-05-01T19:00:00")
 * @param venueLocation Venue location code (e.g., 'TW', 'NL', 'ONLINE')
 * @returns ISO 8601 timestamp in UTC (e.g., "2026-05-01T11:00:00Z")
 *
 * Example: "2026-05-01T19:00:00" in TW (UTC+8) -> "2026-05-01T11:00:00Z"
 */
export function localTimeToUTC(localDateString: string, venueLocation: string): string {
  const timezone = getTimezoneForVenue(venueLocation);

  // Parse the local time components
  const match = localDateString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error(`Invalid date format: ${localDateString}`);
  }

  // Parse as a local date in the target timezone, then convert to UTC
  // fromZonedTime treats the input as if it's in the specified timezone
  const localDate = new Date(localDateString);
  const utcDate = fromZonedTime(localDate, timezone);

  return utcDate.toISOString();
}
