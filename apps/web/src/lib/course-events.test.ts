import { describe, expect, it } from 'vitest';
import {
  eventDate,
  eventEnded,
  eventFormat,
  eventTime,
  eventWhere,
  eventZone,
  SITE_TIME_ZONE,
  toStripEvent,
} from './course-events';

describe('an event’s date and time on /courses', () => {
  it('is read in the event’s own zone, not UTC', () => {
    expect(eventDate('2026-10-25T16:00:00Z', 'Asia/Tokyo')).toBe('26 Oct 2026');
    expect(eventTime('2026-10-25T16:00:00Z', 'Asia/Tokyo')).toBe('1:00 am JST');
    expect(eventTime('2026-10-25T12:30:00Z', 'Asia/Kolkata')).toBe('6:00 pm IST');
  });

  it('falls back to the site’s zone for a zone an editor mistyped, never throwing', () => {
    expect(eventZone('Tokyo')).toBe(SITE_TIME_ZONE);
    expect(eventZone('')).toBe(SITE_TIME_ZONE);
    expect(() => eventDate('2026-10-25T16:00:00Z', 'Tokyo')).not.toThrow();
    expect(eventTime('2026-10-25T12:30:00Z', 'GMT+05:30')).toBe('6:00 pm IST');
  });

  it('prints nothing for a missing or broken start', () => {
    expect(eventDate(null, 'Asia/Tokyo')).toBeNull();
    expect(eventTime('not a date', 'Asia/Tokyo')).toBeNull();
  });
});

describe('an event’s format and place', () => {
  it('names the format from its type, and Online for an untyped one with a link', () => {
    expect(eventFormat('INFO_SESSION')).toBe('Info session');
    expect(eventFormat(null, 'https://meet.example')).toBe('Online');
    expect(eventFormat(null)).toBeNull();
  });

  it('says the venue, city and state once each, leaving the country to its chip', () => {
    expect(
      eventWhere({ venue: 'Tokyo', city: { name: 'Tokyo' }, state: { name: 'Kanto' } }),
    ).toBe('Tokyo, Kanto');
    expect(eventWhere({ venue: 'Japan', country: { name: 'Japan' } })).toBeNull();
    expect(eventWhere({ onlineUrl: 'https://meet.example' })).toBe('Online');
  });
});

describe('whether an event can still be registered for', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');

  it('has ended once its end, or its start when it has none, has passed', () => {
    expect(eventEnded({ startsAt: '2026-10-19T11:00:00Z', endsAt: '2026-10-19T13:00:00Z' }, now)).toBe(false);
    expect(eventEnded({ startsAt: '2026-10-19T09:00:00Z', endsAt: '2026-10-19T10:00:00Z' }, now)).toBe(true);
    expect(eventEnded({ startsAt: '2026-10-18T09:00:00Z' }, now)).toBe(true);
  });

  it('offers only an http(s) registration link, and only before the end', () => {
    const row = { title: 'A', slug: 'a', startsAt: '2026-11-01T10:00:00Z' };
    expect(toStripEvent({ ...row, registrationUrl: 'https://example.invalid/r' }, now).registerUrl).toBe(
      'https://example.invalid/r',
    );
    expect(toStripEvent({ ...row, registrationUrl: 'javascript:alert(1)' }, now).registerUrl).toBeNull();
    expect(
      toStripEvent({ ...row, startsAt: '2026-01-01T10:00:00Z', registrationUrl: 'https://example.invalid/r' }, now)
        .registerUrl,
    ).toBeNull();
  });
});
