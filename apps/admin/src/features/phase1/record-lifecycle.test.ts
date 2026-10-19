import { describe, expect, it } from 'vitest';
import { formatDateTime, lifecycle, testimonialName } from './record-lifecycle';

const NOW = new Date('2026-10-19T12:00:00Z');
const labels = (resource: string, row: Parameters<typeof lifecycle>[1]) =>
  lifecycle(resource, row, NOW).notes.map((note) => note.label);

describe('a row’s lifecycle in the admin list', () => {
  /* SS-C8. "Published" with a View on site link that answered 404. */
  it('says a published record is scheduled, and that it is not live yet', () => {
    const result = lifecycle('success-stories', { status: 'PUBLISHED', publishStartsAt: '2026-12-01T04:30:00.000Z' }, NOW);
    expect(result.notes).toEqual([{ label: 'Scheduled (goes live 1 Dec 2026, 10:00)', tone: 'scheduled' }]);
    expect(result.live).toBe(false);
  });

  it('says a published record whose window has closed has expired', () => {
    const result = lifecycle('scholarships', { status: 'PUBLISHED', publishEndsAt: '2026-10-01T00:00:00.000Z' }, NOW);
    expect(result.notes.map((note) => note.label)).toEqual(['Expired']);
    expect(result.live).toBe(false);
  });

  it('leaves a live record and a draft alone', () => {
    expect(lifecycle('events', { status: 'PUBLISHED', publishStartsAt: '2026-10-01T00:00:00.000Z' }, NOW)).toEqual({ notes: [], live: true });
    expect(lifecycle('events', { status: 'DRAFT', publishStartsAt: '2026-12-01T00:00:00.000Z' }, NOW)).toEqual({ notes: [], live: false });
  });

  /* JOB-C1. A role is open through the whole of its closing day (UTC). */
  it('marks a role closed from the day after its closing date, and keeps it viewable', () => {
    expect(labels('jobs', { status: 'PUBLISHED', expiryDate: '2026-10-19T00:00:00.000Z' })).toEqual([]);
    const closed = lifecycle('jobs', { status: 'PUBLISHED', expiryDate: '2026-10-18T00:00:00.000Z' }, NOW);
    expect(closed.notes.map((note) => note.label)).toEqual(['Closed']);
    expect(closed.live).toBe(true);
  });

  /* EV-M8. Ended once it has finished: its end, or its start without one. */
  it('marks an event ended only once it has finished', () => {
    expect(labels('events', { status: 'PUBLISHED', startsAt: '2026-10-19T11:30:00.000Z', endsAt: '2026-10-19T14:00:00.000Z' })).toEqual([]);
    expect(labels('events', { status: 'PUBLISHED', startsAt: '2026-10-19T09:00:00.000Z', endsAt: '2026-10-19T11:00:00.000Z' })).toEqual(['Ended']);
    expect(labels('events', { status: 'DRAFT', startsAt: '2026-10-10T09:00:00.000Z' })).toEqual(['Ended']);
  });

  it('writes a date and time in the zone given', () => {
    expect(formatDateTime('2026-11-05T09:00:00.000Z', 'Asia/Tokyo')).toBe('5 Nov 2026, 18:00');
    expect(formatDateTime('2026-11-05T09:00:00.000Z', 'not a zone')).toBe('5 Nov 2026, 14:30');
  });
});

describe('a testimonial’s name in a list', () => {
  /* T-C10. Rows read as the first 48 characters of a quote, with no name. */
  it('is the opening of its quote and who said it', () => {
    expect(testimonialName('They answered every question I had.', 'Asha')).toBe('They answered every question I had. — Asha');
    expect(testimonialName('A'.repeat(80), null)).toBe(`${'A'.repeat(57)}…`);
  });
});
