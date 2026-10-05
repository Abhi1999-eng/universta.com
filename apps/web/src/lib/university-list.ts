/**
 * The university lists: the worldwide directory at /universities and one
 * destination's list at /study-abroad/<country>/universities.
 *
 * Both narrow the same rows the same way, and both keep every choice in the
 * address -- the search, each filter, the order and how far the reader has
 * loaded -- so a shared link, a refresh and the back button all land on the
 * list the reader was looking at. Everything here is plain data in and out,
 * so the rules are the same on the server, which renders the first view,
 * and in the browser, which takes over from there.
 */

/** A university as the lists hold it: what a card prints and what a
 * filter reads, and nothing else, because every row is sent to the browser. */
export type UniversityListRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  institutionType: string | null;
  qsRanking: number | null;
  totalStudents: number | null;
  internationalStudentsPercent: number | null;
  programmes: number;
  /** Active campuses on record. Zero is "none recorded", not "none". */
  campuses: number;
  /** The main campus's city, printed on the card. */
  city: string | null;
  /** Every campus city, which the city filter matches against. */
  cities: string[];
  country: { name: string; slug: string; iso2Code: string | null } | null;
  /** The subjects it teaches, most published programmes first. */
  subjects: Array<{ slug: string; name: string }>;
};

/** How many cards a list shows first, and how many each "Load more" adds --
 * the behaviour reference's own step. */
export const PAGE_STEP = 18;

export type UniversitySort = 'ranking' | 'name' | 'programs';

/** "Ranked first" leads because it is the order the list opens in. */
export const UNIVERSITY_SORTS: ReadonlyArray<{ value: UniversitySort; label: string }> = [
  { value: 'ranking', label: 'Ranked first' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'programs', label: 'Most programmes' },
];

export type UniversityListState = {
  q: string;
  countries: string[];
  types: string[];
  cities: string[];
  subjects: string[];
  ranked: boolean;
  sort: UniversitySort;
  /** How many steps of PAGE_STEP are on screen. */
  page: number;
};

/** The parameters a list reads. Any of them makes a view the search engines
 * are asked not to index: it is a slice of a page that is already indexed. */
export const LIST_PARAMS = [
  'q',
  'country',
  'type',
  'city',
  'subject',
  'ranking',
  'sort',
  'page',
] as const;

type Params = { get(name: string): string | null };

const list = (value: string | null) =>
  value
    ? [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
    : [];

export function readListState(params: Params): UniversityListState {
  const sort = params.get('sort');
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    q: (params.get('q') ?? '').trim(),
    countries: list(params.get('country')),
    types: list(params.get('type')),
    cities: list(params.get('city')),
    subjects: list(params.get('subject')),
    ranked: params.get('ranking') === 'ranked',
    sort: sort === 'name' || sort === 'programs' ? sort : 'ranking',
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 500) : 1,
  };
}

/** The address of a list in a given state. Defaults are left out, so the
 * unfiltered list is its bare path and nothing else. */
export function listHref(path: string, state: Partial<UniversityListState>) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.countries?.length) params.set('country', state.countries.join(','));
  if (state.types?.length) params.set('type', state.types.join(','));
  if (state.cities?.length) params.set('city', state.cities.join(','));
  if (state.subjects?.length) params.set('subject', state.subjects.join(','));
  if (state.ranked) params.set('ranking', 'ranked');
  if (state.sort && state.sort !== 'ranking') params.set('sort', state.sort);
  if (state.page && state.page > 1) params.set('page', String(state.page));
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/** Whether a request carries any list parameter, read on the server for the
 * robots rule. Values are not judged: a slice is a slice. */
export function isNarrowedList(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return LIST_PARAMS.some((key) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

/** A city as the address carries it: "New Delhi" is `new-delhi`. */
export function cityKey(city: string) {
  return city
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function institutionTypeLabel(value: string | null | undefined) {
  return value
    ? value
        .toLowerCase()
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((word) => word[0]!.toUpperCase() + word.slice(1))
        .join(' ')
    : null;
}

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const positive = (value: unknown) => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number > 0
    ? number
    : null;
};

/** One row of the universities list endpoint, as the lists hold it. */
export function toUniversityListRow(record: unknown): UniversityListRow {
  const row = (record ?? {}) as Record<string, unknown>;
  const counts = row._count as { offerings?: unknown } | undefined;
  const campuses = Array.isArray(row.campuses)
    ? (row.campuses as Array<Record<string, unknown>>)
    : [];
  const cities = [
    ...new Set(campuses.map((campus) => text(campus.city)).filter((city): city is string => Boolean(city))),
  ];
  const country = row.country as Record<string, unknown> | undefined;
  const subjects = Array.isArray(row.subjects)
    ? (row.subjects as Array<Record<string, unknown>>)
        .map((subject) => ({ slug: text(subject.slug), name: text(subject.name) }))
        .filter((subject): subject is { slug: string; name: string } =>
          Boolean(subject.slug && subject.name),
        )
    : [];
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortDescription: text(row.shortDescription),
    institutionType: text(row.institutionType),
    qsRanking: positive(row.qsRanking),
    totalStudents: positive(row.totalStudents),
    internationalStudentsPercent: positive(row.internationalStudentsPercent),
    programmes: typeof counts?.offerings === 'number' ? counts.offerings : 0,
    campuses: campuses.length,
    city: text(campuses[0]?.city),
    cities,
    country: text(country?.name)
      ? {
          name: String(country!.name),
          slug: String(country!.slug ?? ''),
          iso2Code: text(country!.iso2Code),
        }
      : null,
    subjects,
  };
}

export type FilterOption = { value: string; label: string; count: number };

const byCount = (a: FilterOption, b: FilterOption) =>
  b.count - a.count || a.label.localeCompare(b.label);

function tally(
  rows: UniversityListRow[],
  pick: (row: UniversityListRow) => Array<{ value: string; label: string }>,
) {
  const seen = new Map<string, FilterOption>();
  for (const row of rows) {
    /* Once per university, however many campuses share a city. */
    const own = new Map(pick(row).map((option) => [option.value, option]));
    for (const option of own.values()) {
      const entry = seen.get(option.value) ?? { ...option, count: 0 };
      entry.count += 1;
      seen.set(option.value, entry);
    }
  }
  return [...seen.values()].sort(byCount);
}

/**
 * What each filter group can offer, built from the rows themselves, so no
 * option can promise a university the list does not hold.
 *
 * The destination is the outer choice. Once one is ticked -- or the list is
 * one destination's to begin with -- every other group counts within it,
 * which is what makes a city list mean anything: the cities of the country
 * chosen, not every city in the catalogue.
 */
export function listOptions(rows: UniversityListRow[], countries: string[]) {
  const destinations = tally(rows, (row) =>
    row.country ? [{ value: row.country.slug, label: row.country.name }] : [],
  );
  const chosen = new Set(
    countries.filter((slug) => destinations.some((option) => option.value === slug)),
  );
  const scope = chosen.size
    ? rows.filter((row) => row.country && chosen.has(row.country.slug))
    : rows;
  return {
    destinations,
    /** Of the rows in reach of the chosen destinations. */
    scope,
    types: tally(scope, (row) =>
      row.institutionType
        ? [{ value: row.institutionType, label: institutionTypeLabel(row.institutionType)! }]
        : [],
    ),
    cities: tally(scope, (row) =>
      row.cities.map((city) => ({ value: cityKey(city), label: city })),
    ).sort((a, b) => a.label.localeCompare(b.label)),
    subjects: tally(scope, (row) =>
      row.subjects.map((subject) => ({ value: subject.slug, label: subject.name })),
    ),
    ranked: scope.filter((row) => row.qsRanking).length,
  };
}

/** Whether a group would change anything if used: more than one choice, or
 * one that not every row shares. */
export function narrows(options: FilterOption[], total: number) {
  return options.length > 1 || (options.length === 1 && options[0]!.count < total);
}

/** Only the chosen values a group still offers. A city left over from a
 * destination that is no longer ticked, or a value typed into the address
 * by hand, is set aside rather than allowed to empty the list. */
export function effectiveFilters(
  state: UniversityListState,
  options: ReturnType<typeof listOptions>,
) {
  const keep = (chosen: string[], offered: FilterOption[]) =>
    chosen.filter((value) => offered.some((option) => option.value === value));
  return {
    countries: keep(state.countries, options.destinations),
    types: keep(state.types, options.types),
    cities: keep(state.cities, options.cities),
    subjects: keep(state.subjects, options.subjects),
    ranked: state.ranked && options.ranked > 0,
  };
}

export type EffectiveFilters = ReturnType<typeof effectiveFilters>;

export function activeFilterCount(filters: EffectiveFilters) {
  return (
    filters.countries.length +
    filters.types.length +
    filters.cities.length +
    filters.subjects.length +
    (filters.ranked ? 1 : 0)
  );
}

/**
 * Ranked universities by their published position, then the rest A to Z.
 * The unranked are not worst, they are unmeasured, so they follow in their
 * own order rather than being given a position they do not have.
 */
export function rankedThenName(a: UniversityListRow, b: UniversityListRow) {
  if (a.qsRanking && b.qsRanking && a.qsRanking !== b.qsRanking)
    return a.qsRanking - b.qsRanking;
  if (a.qsRanking && !b.qsRanking) return -1;
  if (b.qsRanking && !a.qsRanking) return 1;
  return a.name.localeCompare(b.name);
}

/** The rows a list shows, in the order it shows them. */
export function filterUniversities(
  rows: UniversityListRow[],
  filters: EffectiveFilters,
  query: string,
  sort: UniversitySort,
) {
  const term = query.trim().toLowerCase();
  const matched = rows.filter((row) => {
    if (filters.countries.length && !filters.countries.includes(row.country?.slug ?? ''))
      return false;
    if (filters.types.length && !filters.types.includes(row.institutionType ?? ''))
      return false;
    if (
      filters.cities.length &&
      !row.cities.some((city) => filters.cities.includes(cityKey(city)))
    )
      return false;
    if (
      filters.subjects.length &&
      !row.subjects.some((subject) => filters.subjects.includes(subject.slug))
    )
      return false;
    if (filters.ranked && !row.qsRanking) return false;
    if (!term) return true;
    /* Wider than the reference's name-only search: a reader who types a
       country or a city is asking for the universities there. */
    return (
      row.name.toLowerCase().includes(term) ||
      (row.country?.name ?? '').toLowerCase().includes(term) ||
      row.cities.some((city) => city.toLowerCase().includes(term)) ||
      (row.shortDescription ?? '').toLowerCase().includes(term)
    );
  });
  const sorted = [...matched];
  if (sort === 'programs')
    sorted.sort((a, b) => b.programmes - a.programmes || a.name.localeCompare(b.name));
  else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else sorted.sort(rankedThenName);
  return sorted;
}
