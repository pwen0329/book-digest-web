import { describe, expect, it } from 'vitest';
import { formatEventDate, localTimeToUTC } from '@/lib/date-formatter';
import { getTimezoneForVenue, getVenueLocation } from '@/lib/venue-locations';

describe('venue-locations', () => {
  it('should return correct timezone for TW', () => {
    expect(getTimezoneForVenue('TW')).toBe('Asia/Taipei');
  });

  it('should return correct timezone for NL', () => {
    expect(getTimezoneForVenue('NL')).toBe('Europe/Amsterdam');
  });

  it('should return correct timezone for ONLINE', () => {
    expect(getTimezoneForVenue('ONLINE')).toBe('UTC');
  });

  it('should return UTC for unknown location', () => {
    expect(getTimezoneForVenue('UNKNOWN')).toBe('UTC');
  });

  it('should return venue location config', () => {
    const tw = getVenueLocation('TW');
    expect(tw).toBeDefined();
    expect(tw?.code).toBe('TW');
    expect(tw?.displayName).toBe('Taiwan');
    expect(tw?.displayNameZh).toBe('台灣');
    expect(tw?.timezone).toBe('Asia/Taipei');
    expect(tw?.hasDST).toBe(false);
  });
});

describe('date-formatter', () => {
  describe('formatEventDate', () => {
    it('should format UTC time to TW local time (zh)', () => {
      // 2026-05-01 11:00 UTC = 2026-05-01 19:00 TW (UTC+8)
      const formatted = formatEventDate('2026-05-01T11:00:00Z', 'zh', 'TW');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('5');
      expect(formatted).toContain('1');
      expect(formatted).toContain('19:00');
    });

    it('should format UTC time to TW local time (en)', () => {
      // 2026-05-01 11:00 UTC = 2026-05-01 19:00 TW (UTC+8)
      const formatted = formatEventDate('2026-05-01T11:00:00Z', 'en', 'TW');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('May');
      expect(formatted).toContain('7:00 PM');
    });

    it('should format UTC time to NL local time during summer (CEST, UTC+2)', () => {
      // 2026-06-01 11:00 UTC = 2026-06-01 13:00 NL (CEST, UTC+2 due to DST)
      const formatted = formatEventDate('2026-06-01T11:00:00Z', 'en', 'NL');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('June');
      expect(formatted).toContain('1:00 PM');
    });

    it('should format UTC time to NL local time during winter (CET, UTC+1)', () => {
      // 2026-01-01 11:00 UTC = 2026-01-01 12:00 NL (CET, UTC+1, no DST)
      const formatted = formatEventDate('2026-01-01T11:00:00Z', 'en', 'NL');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('January');
      expect(formatted).toContain('12:00 PM');
    });

    it('should keep UTC time for ONLINE events', () => {
      const formatted = formatEventDate('2026-05-01T11:00:00Z', 'en', 'ONLINE');
      expect(formatted).toContain('11:00 AM');
    });
  });

  describe('localTimeToUTC', () => {
    it('should convert TW local time to UTC', () => {
      // 2026-05-01 19:00 TW = 2026-05-01 11:00 UTC (UTC+8)
      const utc = localTimeToUTC('2026-05-01T19:00:00', 'TW');
      expect(utc).toBe('2026-05-01T11:00:00.000Z');
    });

    it('should convert NL summer time to UTC (CEST)', () => {
      // 2026-06-01 13:00 NL = 2026-06-01 11:00 UTC (CEST, UTC+2)
      const utc = localTimeToUTC('2026-06-01T13:00:00', 'NL');
      expect(utc).toBe('2026-06-01T11:00:00.000Z');
    });

    it('should convert NL winter time to UTC (CET)', () => {
      // 2026-01-01 12:00 NL = 2026-01-01 11:00 UTC (CET, UTC+1)
      const utc = localTimeToUTC('2026-01-01T12:00:00', 'NL');
      expect(utc).toBe('2026-01-01T11:00:00.000Z');
    });

    it('should handle ONLINE events (already UTC)', () => {
      const utc = localTimeToUTC('2026-05-01T11:00:00', 'ONLINE');
      expect(utc).toBe('2026-05-01T11:00:00.000Z');
    });

    it('should throw error for invalid date format', () => {
      expect(() => localTimeToUTC('invalid', 'TW')).toThrow('Invalid date format');
    });
  });
});
