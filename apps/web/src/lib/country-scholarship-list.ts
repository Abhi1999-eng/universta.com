import {
  benefitLabel,
  toScholarshipCard,
  type ScholarshipCard,
} from './scholarship-card';
import { matchesSubject } from './subject-search';

/**
 * One destination's scholarships, at /study-abroad/<country>/scholarships.
 *
 * The behaviour reference files funding under the destination, beside its
 * subjects and universities, with the same search, filters and "Load more"
 * as its other lists. The guide's Scholarships tab used to leave the
 * destination for the worldwide finder, which never named the country and
 * had no way back.
 *
 * The page reads every award the destination has once and narrows them in
 * the browser, as the destination's universities list does: the counts
 * beside each filter are then true, and no tick costs a round trip. Every
 * choice is kept in the address under the names the worldwide finder
 * already uses -- `degreeLevel`, `type`, `deadline=open`, `sort` -- so a
 * link written for one reads the same on the other.
 */

/** The page's own address. */
export function countryScholarshipsHref(countrySlug: string) {
  return `/study-abroad/${countrySlug}/scholarships`;
}

/** Cards shown first, and added by each "Load more": the reference's step. */
export const SCHOLARSHIP_STEP = 18;

export type CountryScholarshipRow = ScholarshipCard & {
  /** The stored benefit type, as the filter keys it: "FULL_FUNDING". */
  type: string | null;
  /** The study levels the award is attached to through its programmes, by
   * code. Empty when it names no programme, which says nothing either way. */
  levels: string[];
  /** Whether the stored closing date has passed, judged once on the server
   * when the page was read. Null when no closing date is recorded. */
  closed: boolean | null;
  /** The closing date and the publishing date as numbers, for the orders. */
  deadlineAt: number | null;
  addedAt: number | null;
};

const time = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value) return null;
  const at = new Date(value).getTime();
  return Number.isNaN(at) ? null : at;
};

/**
 * The list endpoint's rows as the page holds them.
 *
 * `levels` maps a level's code to the awards the endpoint returned when
 * asked for that level -- the endpoint's own reading of "for Master's",
 * through the programmes an award is attached to -- so the filter here
 * agrees with the one on the worldwide finder. Whether a deadline has passed
 * is judged against `now` here, once, so the server's page and the
 * browser's agree on it.
 */
export function toCountryScholarshipRows(
  records: readonly unknown[],
  levels: ReadonlyMap<string, ReadonlySet<string>>,
  now: Date,
): CountryScholarshipRow[] {
  /* A date column: the award closes at the end of that day, not at its
     first minute. */
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return records.flatMap((record) => {
    const card = toScholarshipCard(record);
    if (!card) return [];
    const raw = record as Record<string, unknown>;
    const deadlineAt = time(raw.deadline);
    const type =
      typeof raw.benefitType === 'string' && raw.benefitType.trim()
        ? raw.benefitType.trim()
        : null;
    return [
      {
        ...card,
        type,
        levels: [...levels.entries()]
          .filter(([, ids]) => ids.has(card.id))
          .map(([code]) => code),
        closed: deadlineAt === null ? null : deadlineAt < today,
        deadlineAt,
        addedAt: time(raw.publishedAt) ?? time(raw.createdAt),
      },
    ];
  });
}

export type ScholarshipSort = 'relevance' | 'deadline' | 'newest' | 'name-asc';

export const SCHOLARSHIP_SORTS: ReadonlyArray<{ value: ScholarshipSort; label: string }> = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'deadline', label: 'Deadline soonest' },
  { value: 'newest', label: 'Recently added' },
  { value: 'name-asc', label: 'Name A-Z' },
];

export type ScholarshipListState = {
  q: string;
  levels: string[];
  types: string[];
  /** Only awards whose closing date has not passed. */
  open: boolean;
  sort: ScholarshipSort;
  /** How many steps of SCHOLARSHIP_STEP are on screen. */
  page: number;
};

/** Every parameter the list reads. Any of them is a slice of a page that is
 * indexed whole, so the server asks search engines not to index it. */
export const SCHOLARSHIP_PARAMS = [
  'q',
  'degreeLevel',
  'type',
  'deadline',
  'sort',
  'page',
] as const;

type Params = { get(name: string): string | null };

const list = (value: string | null) =>
  value
    ? [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
    : [];

export function readScholarshipState(params: Params): ScholarshipListState {
  const sort = params.get('sort');
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    q: (params.get('q') ?? '').trim().slice(0, 100),
    levels: list(params.get('degreeLevel')),
    types: list(params.get('type')),
    open: params.get('deadline') === 'open',
    sort: SCHOLARSHIP_SORTS.some((option) => option.value === sort)
      ? (sort as ScholarshipSort)
      : 'relevance',
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 200) : 1,
  };
}

/** The address of the list in a given state; defaults are left out, so the
 * unfiltered list is its bare path. */
export function scholarshipListHref(
  path: string,
  state: Partial<ScholarshipListState>,
) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.levels?.length) params.set('degreeLevel', state.levels.join(','));
  if (state.types?.length) params.set('type', state.types.join(','));
  if (state.open) params.set('deadline', 'open');
  if (state.sort && state.sort !== 'relevance') params.set('sort', state.sort);
  if (state.page && state.page > 1) params.set('page', String(state.page));
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function isNarrowedScholarshipList(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return SCHOLARSHIP_PARAMS.some((key) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

export type ScholarshipFilterOption = { value: string; label: string; count: number };

const byCount = (a: ScholarshipFilterOption, b: ScholarshipFilterOption) =>
  b.count - a.count || a.label.localeCompare(b.label);

/**
 * What the list can be narrowed by, counted over the destination's awards.
 *
 * Built from the rows, so a funding type no award carries is never offered,
 * and a level is offered only when an award here is attached to it. Level
 * names come from the catalogue's own list, in its academic order.
 */
export function scholarshipOptions(
  rows: readonly CountryScholarshipRow[],
  levelNames: ReadonlyArray<{ code: string; name: string }>,
) {
  const types = new Map<string, ScholarshipFilterOption>();
  for (const row of rows) {
    if (!row.type) continue;
    const entry = types.get(row.type);
    if (entry) entry.count += 1;
    else
      types.set(row.type, {
        value: row.type,
        label: benefitLabel(row.type) ?? row.type,
        count: 1,
      });
  }
  const levels = levelNames
    .map((level) => ({
      value: level.code,
      label: level.name,
      count: rows.filter((row) => row.levels.includes(level.code)).length,
    }))
    .filter((option) => option.count > 0);
  return {
    types: [...types.values()].sort(byCount),
    levels,
    open: rows.filter((row) => row.closed !== true).length,
  };
}

/** Whether ticking the options of a group would change the list at all. */
export function narrowsScholarships(
  options: readonly ScholarshipFilterOption[],
  total: number,
) {
  return options.length > 1 || (options.length === 1 && options[0]!.count < total);
}

/** The words an award is found by: its name, who offers it and what it
 * covers, so "chevening", "commonwealth" and "full funding" all find it. */
function searchText(row: CountryScholarshipRow) {
  return [row.title, row.provider, row.benefit].filter(Boolean).join(' ');
}

/**
 * The awards a state leaves, in the order it asks for.
 *
 * "Most relevant" is the catalogue's own order, which is the editor's. The
 * soonest deadline puts the awards still open first, by date, then those
 * with no closing date recorded, then the ones already closed -- a deadline
 * that has passed is not "soon".
 */
export function filterScholarships(
  rows: readonly CountryScholarshipRow[],
  state: ScholarshipListState,
): CountryScholarshipRow[] {
  const shown = rows.filter((row) => {
    if (!matchesSubject(searchText(row), state.q)) return false;
    if (state.levels.length && !state.levels.some((level) => row.levels.includes(level)))
      return false;
    if (state.types.length && !(row.type && state.types.includes(row.type))) return false;
    if (state.open && row.closed === true) return false;
    return true;
  });
  const sorted = [...shown];
  switch (state.sort) {
    case 'deadline': {
      const rank = (row: CountryScholarshipRow) =>
        row.closed === true ? 2 : row.deadlineAt === null ? 1 : 0;
      sorted.sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.deadlineAt ?? 0) - (b.deadlineAt ?? 0) ||
          a.title.localeCompare(b.title),
      );
      break;
    }
    case 'newest':
      sorted.sort(
        (a, b) =>
          (b.addedAt ?? 0) - (a.addedAt ?? 0) || a.title.localeCompare(b.title),
      );
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    default:
      break;
  }
  return sorted;
}

/** The number of filters ticked, for the badge on the phone's Filters button. */
export function activeScholarshipFilters(state: ScholarshipListState) {
  return state.levels.length + state.types.length + (state.open ? 1 : 0);
}
