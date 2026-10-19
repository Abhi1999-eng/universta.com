import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_ZONE,
  isTimeZone,
  timeZoneNames,
  utcIsoToWallTime,
  wallTimeToUtcIso,
  zoneOrDefault,
} from './zoned-time';

describe('wall time in a zone', () => {
  it('reads 18:00 in Tokyo as 09:00 UTC, and back', () => {
    expect(wallTimeToUtcIso('2026-11-05T18:00', 'Asia/Tokyo')).toBe(
      '2026-11-05T09:00:00.000Z',
    );
    expect(utcIsoToWallTime('2026-11-05T09:00:00.000Z', 'Asia/Tokyo')).toBe(
      '2026-11-05T18:00',
    );
  });

  it('reads India’s half-hour offset', () => {
    expect(wallTimeToUtcIso('2026-12-01T10:00', 'Asia/Kolkata')).toBe(
      '2026-12-01T04:30:00.000Z',
    );
    expect(utcIsoToWallTime('2026-12-01T04:30:00.000Z', 'Asia/Kolkata')).toBe(
      '2026-12-01T10:00',
    );
  });

  it('follows a clock change: London in summer and in winter', () => {
    expect(wallTimeToUtcIso('2026-07-01T09:00', 'Europe/London')).toBe(
      '2026-07-01T08:00:00.000Z',
    );
    expect(wallTimeToUtcIso('2026-12-01T09:00', 'Europe/London')).toBe(
      '2026-12-01T09:00:00.000Z',
    );
  });

  it('round-trips every stored instant unchanged', () => {
    for (const zone of ['Asia/Kolkata', 'Asia/Tokyo', 'America/New_York', 'UTC'])
      for (const iso of [
        '2026-01-15T23:45:00.000Z',
        '2026-03-29T01:30:00.000Z',
        '2026-10-25T00:15:00.000Z',
      ])
        expect(wallTimeToUtcIso(utcIsoToWallTime(iso, zone), zone)).toBe(iso);
  });

  it('falls back to India for a zone it does not know', () => {
    expect(isTimeZone('Tokyo')).toBe(false);
    expect(isTimeZone('Asia/Tokyo')).toBe(true);
    expect(zoneOrDefault('Tokyo')).toBe(DEFAULT_TIME_ZONE);
    expect(zoneOrDefault('')).toBe(DEFAULT_TIME_ZONE);
    expect(wallTimeToUtcIso('2026-12-01T10:00', 'Tokyo')).toBe(
      '2026-12-01T04:30:00.000Z',
    );
  });

  it('leaves empty and unreadable values for the API to judge', () => {
    expect(wallTimeToUtcIso('', 'Asia/Tokyo')).toBe('');
    expect(wallTimeToUtcIso('next Tuesday', 'Asia/Tokyo')).toBe('next Tuesday');
    expect(utcIsoToWallTime(null, 'Asia/Tokyo')).toBe('');
    expect(utcIsoToWallTime('soon', 'Asia/Tokyo')).toBe('');
  });

  it('lists the zones with India’s among them', () => {
    const names = timeZoneNames();
    expect(names).toContain('Asia/Tokyo');
    expect(names).toContain(DEFAULT_TIME_ZONE);
  });
});
