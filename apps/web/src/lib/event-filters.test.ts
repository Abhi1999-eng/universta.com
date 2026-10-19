import { describe, expect, it } from 'vitest';
import {
  activeEventFilters,
  eventFilterOptions,
  eventFiltersHref,
  eventFormat,
  filterEvents,
  readEventFilters,
  type EventFilterState,
  type EventItem,
} from './event-filters';

const now = Date.parse('2026-10-19T12:00:00Z');
const blank: EventFilterState = { q: '', formats: [], countries: [], when: '', show: '', sort: 'soonest' };

const item = (key: string, startsAt: string, extra: Partial<EventItem> = {}): EventItem => ({
  key,
  title: key,
  text: key,
  startsAt,
  endsAt: null,
  timezone: 'Asia/Kolkata',
  format: { value: 'ONLINE', label: 'Online' },
  country: null,
  ...extra,
});

const items = [
  item('old', '2025-06-10T10:00:00Z'),
  item('live', '2026-10-19T11:00:00Z', { endsAt: '2026-10-19T14:00:00Z' }),
  item('this week', '2026-10-22T10:00:00Z', { format: { value: 'OFFLINE', label: 'In person' }, country: { value: 'japan', label: 'Japan' } }),
  item('next month', '2026-11-15T10:00:00Z', { text: 'next month Tokyo fair' }),
  item('far', '2027-03-01T10:00:00Z', { country: { value: 'japan', label: 'Japan' } }),
];

describe('eventFormat', () => {
  it('names the format the way a reader says it', () => {
    expect(eventFormat('OFFLINE')).toEqual({ value: 'OFFLINE', label: 'In person' });
    expect(eventFormat('info session')).toEqual({ value: 'INFO_SESSION', label: 'Info session' });
    expect(eventFormat(null, 'https://meet.example.test')).toEqual({ value: 'ONLINE', label: 'Online' });
    expect(eventFormat(null)).toBeNull();
  });
});

describe('filterEvents (EV-U2)', () => {
  it('lists upcoming events soonest first, a live one among them, and past ones newest first', () => {
    const { upcoming, past } = filterEvents(items, blank, now);
    expect(upcoming.map((entry) => entry.key)).toEqual(['live', 'this week', 'next month', 'far']);
    expect(past.map((entry) => entry.key)).toEqual(['old']);
  });

  it('narrows by the When windows, which hold only events still to come', () => {
    expect(filterEvents(items, { ...blank, when: 'week' }, now).upcoming.map((entry) => entry.key)).toEqual(['live', 'this week']);
    expect(filterEvents(items, { ...blank, when: 'month' }, now).upcoming.map((entry) => entry.key)).toEqual(['live', 'this week', 'next month']);
    expect(filterEvents(items, { ...blank, when: 'week' }, now).past).toEqual([]);
  });

  it('narrows by format, country, search words and upcoming or past', () => {
    expect(filterEvents(items, { ...blank, formats: ['OFFLINE'] }, now).upcoming.map((entry) => entry.key)).toEqual(['this week']);
    expect(filterEvents(items, { ...blank, countries: ['japan'] }, now).upcoming.map((entry) => entry.key)).toEqual(['this week', 'far']);
    expect(filterEvents(items, { ...blank, q: 'TOKYO fair' }, now).upcoming.map((entry) => entry.key)).toEqual(['next month']);
    expect(filterEvents(items, { ...blank, show: 'past' }, now).upcoming).toEqual([]);
    expect(filterEvents(items, { ...blank, show: 'upcoming' }, now).past).toEqual([]);
  });
});

describe('the filters in the address', () => {
  it('reads what it wrote, and ignores what it does not know', () => {
    const state: EventFilterState = { q: 'fair', formats: ['ONLINE', 'HYBRID'], countries: ['japan'], when: 'month', show: 'upcoming', sort: 'title' };
    const href = eventFiltersHref('/events', state);
    expect(href).toBe('/events?q=fair&format=ONLINE%2CHYBRID&country=japan&when=month&show=upcoming&sort=title');
    expect(readEventFilters(new URL(href, 'http://x').searchParams)).toEqual(state);
    expect(readEventFilters(new URLSearchParams('when=yesterday&show=all&sort=random'))).toEqual(blank);
    expect(eventFiltersHref('/events', blank)).toBe('/events');
    expect(activeEventFilters(state)).toBe(5);
  });
});

describe('eventFilterOptions', () => {
  it('counts each choice, and the upcoming and past events', () => {
    const options = eventFilterOptions(items, now);
    expect(options.formats).toEqual([
      { value: 'OFFLINE', label: 'In person', count: 1 },
      { value: 'ONLINE', label: 'Online', count: 4 },
    ]);
    expect(options.countries).toEqual([{ value: 'japan', label: 'Japan', count: 2 }]);
    expect(options.upcoming).toBe(4);
    expect(options.past).toBe(1);
    expect(options.windows.map((window) => window.count)).toEqual([2, 3, 3]);
  });
});
