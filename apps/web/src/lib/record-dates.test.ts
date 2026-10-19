import { describe, expect, it } from 'vitest';
import {
  daysToClose,
  employmentLabel,
  employmentSchema,
  eventClock,
  eventClockRange,
  eventDateTime,
  eventDay,
  eventStatus,
  eventTimes,
  formatIn,
  jobClosed,
  jobDay,
  jobStatus,
  remoteRole,
  splitEvents,
  workingLabel,
  zoneAbbreviation,
} from './record-dates';

describe('formatIn -- a bad zone never takes a page down (EV-C3)', () => {
  it('answers in the site zone when an editor typed "Tokyo"', () => {
    expect(() => eventDay('2026-11-20T09:00:00Z', 'Tokyo')).not.toThrow();
    expect(eventDateTime('2026-11-20T09:00:00Z', 'Tokyo')).toBe(eventDateTime('2026-11-20T09:00:00Z', 'Asia/Kolkata'));
    expect(eventClock('2026-11-20T09:00:00Z', 'Tokyo')).toBe('2:30 pm IST');
  });

  it('still uses a valid zone', () => {
    expect(eventDay('2026-10-25T16:00:00Z', 'Asia/Tokyo')).toBe('26 Oct 2026');
    expect(formatIn('2026-10-25T16:00:00Z', { dateStyle: 'medium' }, 'UTC')).toBe('25 Oct 2026');
  });

  it('says nothing for a missing date', () => {
    expect(eventDay(null, 'Asia/Tokyo')).toBeNull();
    expect(eventDay('not a date')).toBeNull();
  });
});

describe('zone names', () => {
  it('prints the short name the zone is known by', () => {
    expect(zoneAbbreviation('2026-11-20T09:00:00Z', 'Asia/Tokyo')).toBe('JST');
    expect(zoneAbbreviation('2026-11-20T09:00:00Z', 'Asia/Kolkata')).toBe('IST');
    expect(zoneAbbreviation('2026-07-20T09:00:00Z', 'Europe/London')).toBe('BST');
    expect(zoneAbbreviation('2026-11-20T09:00:00Z', 'America/New_York')).toBe('EST');
  });

  it('falls back to the offset where no short name exists', () => {
    expect(zoneAbbreviation('2026-11-20T09:00:00Z', 'Asia/Singapore')).toBe('GMT+8');
  });

  it('writes a clock time with its zone', () => {
    expect(eventClock('2026-11-20T09:00:00Z', 'Asia/Tokyo')).toBe('6:00 pm JST');
    expect(eventClockRange('2026-11-20T09:00:00Z', '2026-11-20T10:30:00Z', 'Asia/Tokyo')).toBe('6:00 pm – 7:30 pm JST');
    expect(eventClockRange('2026-11-20T09:00:00Z', null, 'Asia/Tokyo')).toBe('6:00 pm JST');
  });
});

describe('eventStatus (EV-U1) and the upcoming/past split (EV-C1)', () => {
  const now = new Date('2026-10-19T12:00:00Z');

  it('reads upcoming, live, today and ended', () => {
    expect(eventStatus({ startsAt: '2026-10-28T10:00:00Z', endsAt: '2026-10-28T11:00:00Z' }, now)).toBe('upcoming');
    expect(eventStatus({ startsAt: '2026-10-19T11:30:00Z', endsAt: '2026-10-19T14:00:00Z' }, now)).toBe('live');
    /* 15:00 UTC is 20:30 the same day in India. */
    expect(eventStatus({ startsAt: '2026-10-19T15:00:00Z', timezone: 'Asia/Kolkata' }, now)).toBe('today');
    /* The same moment is already the 20th in Tokyo, so not "today" there. */
    expect(eventStatus({ startsAt: '2026-10-19T16:00:00Z', timezone: 'Asia/Tokyo' }, now)).toBe('upcoming');
    expect(eventStatus({ startsAt: '2026-10-10T10:00:00Z', endsAt: '2026-10-10T11:00:00Z' }, now)).toBe('ended');
    /* With no end, the start decides. */
    expect(eventStatus({ startsAt: '2026-10-19T11:00:00Z' }, now)).toBe('ended');
  });

  it('keeps a live event with the upcoming ones, soonest first, and past ones newest first', () => {
    const rows = [
      { id: 'old', startsAt: '2025-06-10T10:00:00Z', endsAt: '2025-06-10T11:00:00Z' },
      { id: 'later', startsAt: '2026-12-01T10:00:00Z' },
      { id: 'live', startsAt: '2026-10-19T11:30:00Z', endsAt: '2026-10-19T14:00:00Z' },
      { id: 'recent', startsAt: '2026-10-10T10:00:00Z', endsAt: '2026-10-10T11:00:00Z' },
      { id: 'soon', startsAt: '2026-10-28T10:00:00Z' },
    ];
    const { upcoming, past } = splitEvents(rows, now);
    expect(upcoming.map((row) => row.id)).toEqual(['live', 'soon', 'later']);
    expect(past.map((row) => row.id)).toEqual(['recent', 'old']);
  });

  it('hands the browser badge only the times, not the whole record', () => {
    const row = { id: 'e', title: 'Fair', description: '<p>Long text</p>', seo: { metaDescription: 'x' }, startsAt: '2026-10-28T10:00:00Z', endsAt: null, timezone: 'Asia/Tokyo' };
    expect(eventTimes(row)).toEqual({ startsAt: '2026-10-28T10:00:00Z', endsAt: null, timezone: 'Asia/Tokyo' });
    expect(eventStatus(eventTimes(row), now)).toBe(eventStatus(row, now));
  });
});

describe('jobClosed (JOB-M3-web) -- the closing day is open all day, in UTC', () => {
  const expiry = '2026-10-19T00:00:00.000Z';

  it('is open at 00:30 and at 23:30 UTC on the closing day', () => {
    expect(jobClosed(expiry, new Date('2026-10-19T00:30:00Z'))).toBe(false);
    expect(jobClosed(expiry, new Date('2026-10-19T23:30:00Z'))).toBe(false);
    expect(jobStatus(expiry, new Date('2026-10-19T23:30:00Z'))).toBe('soon');
  });

  it('is closed from the next UTC day', () => {
    expect(jobClosed(expiry, new Date('2026-10-20T00:00:01Z'))).toBe(true);
    expect(jobStatus(expiry, new Date('2026-10-20T00:30:00Z'))).toBe('closed');
  });

  it('is closing soon within 21 days, open beyond, and has no status without a date', () => {
    const now = new Date('2026-10-19T12:00:00Z');
    expect(daysToClose('2026-11-09T00:00:00Z', now)).toBe(21);
    expect(jobStatus('2026-11-09T00:00:00Z', now)).toBe('soon');
    expect(jobStatus('2026-11-10T00:00:00Z', now)).toBe('open');
    expect(jobStatus(null, now)).toBeNull();
    expect(jobClosed(null, now)).toBe(false);
  });

  it('prints the closing day as the date it is stored as', () => {
    expect(jobDay('2025-01-01T00:00:00.000Z')).toBe('1 Jan 2025');
  });
});

describe('employment type and working pattern (JOB-C5-web, JOB-M1)', () => {
  it("maps the seeded roles' values to schema.org", () => {
    expect(employmentSchema('Part time')).toBe('PART_TIME');
    expect(employmentSchema('Full time')).toBe('FULL_TIME');
    expect(employmentSchema('Contract')).toBe('CONTRACTOR');
    expect(employmentSchema('Internship')).toBe('INTERN');
    expect(employmentSchema('FULL_TIME')).toBe('FULL_TIME');
    expect(employmentSchema('Full-time')).toBe('FULL_TIME');
    expect(employmentSchema('Temporary')).toBe('TEMPORARY');
  });

  it('leaves an unknown type out of the JSON-LD', () => {
    expect(employmentSchema('Volunteer')).toBeUndefined();
    expect(employmentSchema(null)).toBeUndefined();
  });

  it('reads one label for each type however it was typed', () => {
    expect(employmentLabel('FULL_TIME')).toBe('Full time');
    expect(employmentLabel('Full-time')).toBe('Full time');
    expect(employmentLabel('part time')).toBe('Part time');
    expect(employmentLabel('Volunteer')).toBe('Volunteer');
    expect(workingLabel('REMOTE')).toBe('Remote');
    expect(workingLabel('On-site')).toBe('On site');
    expect(workingLabel('HYBRID')).toBe('Hybrid');
  });

  it('treats remote as remote in any case', () => {
    expect(remoteRole('Remote')).toBe(true);
    expect(remoteRole('REMOTE')).toBe(true);
    expect(remoteRole('Hybrid')).toBe(false);
  });
});
