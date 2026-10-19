import { eventEnded, toInstant, type EventTimes } from './record-dates';

/**
 * The /events filters, as the zip's scholarship finder draws them: a search
 * box, then Format, Country, When and Upcoming/Past, and a sort. They narrow
 * the events the page has already loaded, in the browser, and every choice
 * is written into the address so a shared link, a refresh and the back
 * button come back to the same list.
 */

export type EventWindow = '' | 'week' | 'month' | 'quarter';
export type EventShow = '' | 'upcoming' | 'past';
export type EventSort = 'soonest' | 'title';

export type EventFilterState = {
  q: string;
  formats: string[];
  countries: string[];
  when: EventWindow;
  show: EventShow;
  sort: EventSort;
};

/** One event as the filters read it, with its card drawn on the server. */
export type EventItem = EventTimes & {
  key: string;
  title: string;
  /** Title, summary, venue, city, country: what the search box matches. */
  text: string;
  format: { value: string; label: string } | null;
  country: { value: string; label: string } | null;
};

/** The zip's windows: this week, this month, the next three months. */
export const EVENT_WINDOWS: ReadonlyArray<{ value: Exclude<EventWindow, ''>; label: string; days: number }> = [
  { value: 'week', label: 'This week', days: 7 },
  { value: 'month', label: 'This month', days: 31 },
  { value: 'quarter', label: 'Next 3 months', days: 92 },
];

export const EVENT_SORTS: ReadonlyArray<{ value: EventSort; label: string }> = [
  { value: 'soonest', label: 'Soonest first' },
  { value: 'title', label: 'Title A–Z' },
];

const FORMAT_LABELS: Record<string, string> = {
  ONLINE: 'Online',
  OFFLINE: 'In person',
  HYBRID: 'Hybrid',
  WEBINAR: 'Webinar',
  FAIR: 'Fair',
  WORKSHOP: 'Workshop',
  INFO_SESSION: 'Info session',
};

/** The event's format for its badge and the Format filter: "In person" for OFFLINE. */
export function eventFormat(eventType: unknown, onlineUrl?: unknown): { value: string; label: string } | null {
  const raw = typeof eventType === 'string' ? eventType.trim().toUpperCase().replace(/[\s-]+/g, '_') : '';
  if (raw) {
    return {
      value: raw,
      label: FORMAT_LABELS[raw] ?? raw.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
    };
  }
  return typeof onlineUrl === 'string' && onlineUrl.trim() ? { value: 'ONLINE', label: 'Online' } : null;
}

const list = (value: string | null) =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 20);

export function readEventFilters(params: { get(name: string): string | null }): EventFilterState {
  const when = params.get('when') ?? '';
  const show = params.get('show') ?? '';
  const sort = params.get('sort') ?? '';
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    formats: list(params.get('format')),
    countries: list(params.get('country')),
    when: EVENT_WINDOWS.some((window) => window.value === when) ? (when as EventWindow) : '',
    show: show === 'upcoming' || show === 'past' ? show : '',
    sort: sort === 'title' ? 'title' : 'soonest',
  };
}

export function eventFiltersHref(path: string, state: EventFilterState) {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.formats.length) params.set('format', state.formats.join(','));
  if (state.countries.length) params.set('country', state.countries.join(','));
  if (state.when) params.set('when', state.when);
  if (state.show) params.set('show', state.show);
  if (state.sort !== 'soonest') params.set('sort', state.sort);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** How many choices narrow the list, for the mobile Filters button. */
export const activeEventFilters = (state: EventFilterState) =>
  state.formats.length + state.countries.length + (state.when ? 1 : 0) + (state.show ? 1 : 0);

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * The events the choices leave, as the page shows them: upcoming soonest
 * first, then past newest first (or both A–Z by title). An event counts as
 * upcoming until it ends, so one that is running stays with the upcoming.
 */
export function filterEvents<T extends EventItem>(items: readonly T[], state: EventFilterState, now: number) {
  const words = fold(state.q).split(/\s+/).filter(Boolean);
  const window = EVENT_WINDOWS.find((entry) => entry.value === state.when);
  const shown = items.filter((item) => {
    if (words.length && !words.every((word) => fold(item.text).includes(word))) return false;
    if (state.formats.length && !(item.format && state.formats.includes(item.format.value))) return false;
    if (state.countries.length && !(item.country && state.countries.includes(item.country.value))) return false;
    if (window) {
      const starts = toInstant(item.startsAt)?.getTime();
      if (starts === undefined || eventEnded(item, now) || starts > now + window.days * 86_400_000) return false;
    }
    return true;
  });
  const time = (item: T) => toInstant(item.startsAt)?.getTime() ?? 0;
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title, 'en-GB', { sensitivity: 'base' });
  const upcoming = state.show === 'past' ? [] : shown.filter((item) => !eventEnded(item, now));
  const past = state.show === 'upcoming' ? [] : shown.filter((item) => eventEnded(item, now));
  upcoming.sort(state.sort === 'title' ? byTitle : (a, b) => time(a) - time(b));
  past.sort(state.sort === 'title' ? byTitle : (a, b) => time(b) - time(a));
  return { upcoming, past };
}

export type EventOption = { value: string; label: string; count: number };

/** The choices the loaded events offer, each with how many it holds. */
export function eventFilterOptions(items: readonly EventItem[], now: number) {
  const tally = (pick: (item: EventItem) => { value: string; label: string } | null) => {
    const options = new Map<string, EventOption>();
    for (const item of items) {
      const option = pick(item);
      if (!option) continue;
      const seen = options.get(option.value);
      options.set(option.value, { ...option, count: (seen?.count ?? 0) + 1 });
    }
    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label, 'en-GB'));
  };
  const upcoming = items.filter((item) => !eventEnded(item, now)).length;
  return {
    formats: tally((item) => item.format),
    countries: tally((item) => item.country),
    upcoming,
    past: items.length - upcoming,
    windows: EVENT_WINDOWS.map((window) => ({
      ...window,
      count: items.filter((item) => {
        const starts = toInstant(item.startsAt)?.getTime();
        return starts !== undefined && !eventEnded(item, now) && starts <= now + window.days * 86_400_000;
      }).length,
    })),
  };
}
