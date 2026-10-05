import { formatDate, formatNumber } from './format';
import { intakeRange } from './intake-range';
import { offeringHref, universityHref } from './university-links';

/**
 * A university's courses, as the pages under its country show them.
 *
 * The list and the course page both turn the API's offering rows into the
 * same card, and the list's filters live in its address so a filtered list
 * can be shared, bookmarked and come back from. Both of those are decided
 * here, once, without anything that only runs on a server -- the filter
 * panel and the "Load more" button use the same functions in the browser.
 */

/** The reference shows eighteen courses before "Load more". */
export const COURSE_PAGE_SIZE = 18;

/** The reference's orders, under the design's labels. */
export const COURSE_SORTS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'fee', label: 'Lowest tuition' },
  { value: 'deadline', label: 'Next deadline' },
  { value: 'duration', label: 'Shortest first' },
] as const;

export type CourseFilterKey =
  | 'level'
  | 'subject'
  | 'specialization'
  | 'duration'
  | 'intake'
  | 'studyMode';

/** The filter groups, in the order the panel shows them. */
export const COURSE_FILTER_GROUPS: ReadonlyArray<{
  key: CourseFilterKey;
  label: string;
}> = [
  { key: 'level', label: 'Degree level' },
  { key: 'subject', label: 'Subject' },
  { key: 'specialization', label: 'Specialization' },
  { key: 'duration', label: 'Duration' },
  { key: 'intake', label: 'Intake' },
  { key: 'studyMode', label: 'Study mode' },
];

export type CourseFilters = Record<CourseFilterKey, string[]> & {
  q: string;
  /** Courses with a scholarship recorded against them. The old list took
   *  this in its address, so a link that carries it still narrows. */
  scholarship: boolean;
  sort: string;
  /** How many pages of eighteen the list shows, from the first: "Load
   *  more" writes it into the address and the link that stands in for the
   *  button without script carries it, so a reload or Back from a course
   *  comes to the same place in the list. The university lists read their
   *  `page` the same way. */
  page: number;
};

type Params =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function read(params: Params, key: string): string[] {
  const raw =
    params instanceof URLSearchParams ? params.getAll(key) : params[key];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.flatMap((entry) => String(entry).split(','));
}

function readAll(params: Params, ...keys: string[]) {
  const seen = new Set<string>();
  for (const key of keys)
    for (const value of read(params, key))
      if (value.trim()) seen.add(value.trim());
  return [...seen];
}

/**
 * The filters an address asks for. The names the old list used --
 * `courseLevel`, `subSubject`, `scholarshipAvailable` -- are still read, so
 * a link written before the move lands on the same courses.
 */
export function readCourseFilters(params: Params): CourseFilters {
  const sort = readAll(params, 'sort')[0] ?? '';
  const page = Number(readAll(params, 'page')[0]);
  return {
    q: (readAll(params, 'q')[0] ?? '').slice(0, 100),
    level: readAll(params, 'level', 'courseLevel'),
    subject: readAll(params, 'subject'),
    specialization: readAll(params, 'specialization', 'subSubject'),
    duration: readAll(params, 'duration'),
    intake: readAll(params, 'intake'),
    studyMode: readAll(params, 'studyMode'),
    scholarship: readAll(params, 'scholarship', 'scholarshipAvailable').includes(
      'true',
    ),
    sort: COURSE_SORTS.some((option) => option.value === sort)
      ? sort
      : 'relevance',
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

/** How many filters narrow the list (search and sort are not filters). */
export function activeFilterCount(filters: CourseFilters) {
  return (
    COURSE_FILTER_GROUPS.reduce(
      (sum, group) => sum + filters[group.key].length,
      0,
    ) + (filters.scholarship ? 1 : 0)
  );
}

/**
 * The query string for a list, in one canonical spelling: several values
 * of a filter joined by commas, the default sort and the first page left
 * out, so the same list always has the same address.
 */
export function courseListSearch(
  filters: CourseFilters,
  change: Partial<CourseFilters> = {},
): string {
  const next = { ...filters, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.q.trim()) params.set('q', next.q.trim());
  for (const group of COURSE_FILTER_GROUPS)
    if (next[group.key].length) params.set(group.key, next[group.key].join(','));
  if (next.scholarship) params.set('scholarship', 'true');
  if (next.sort && next.sort !== 'relevance') params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** The same filters, as the course API names them: one page of eighteen. */
export function courseApiParams(
  filters: CourseFilters,
  page = filters.page,
): Record<string, string> {
  const params: Record<string, string> = {
    limit: String(COURSE_PAGE_SIZE),
    page: String(page),
  };
  if (filters.q.trim()) params.q = filters.q.trim();
  for (const group of COURSE_FILTER_GROUPS)
    if (filters[group.key].length)
      params[group.key] = filters[group.key].join(',');
  if (filters.scholarship) params.scholarshipAvailable = 'true';
  if (filters.sort !== 'relevance') params.sort = filters.sort;
  return params;
}

/** Every page the address asks for, from the first, in one answer. */
export function courseRunParams(filters: CourseFilters): Record<string, string> {
  return {
    ...courseApiParams(filters, 1),
    limit: String(COURSE_PAGE_SIZE * filters.page),
  };
}

export type FacetOption = { value: string; label: string; count: number };
export type CourseFacets = Record<CourseFilterKey, FacetOption[]>;

type Row = Record<string, unknown>;
const record = (value: unknown): Row | null =>
  value && typeof value === 'object' ? (value as Row) : null;
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export type CourseListMeta = {
  /** How many pages of eighteen are shown. */
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** The API's count, told in the list's own pages of eighteen. */
export function courseRunMeta(raw: unknown, filters: CourseFilters): CourseListMeta {
  const total = count(record(raw)?.total);
  const totalPages = Math.ceil(total / COURSE_PAGE_SIZE);
  return {
    page: Math.max(1, Math.min(filters.page, totalPages)),
    limit: COURSE_PAGE_SIZE,
    total,
    totalPages,
  };
}

/** "FULL_TIME" -> "Full time". */
export function humanise(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function options(
  raw: unknown,
  label: (option: Row) => string = (option) => String(option.label ?? ''),
): FacetOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const option = record(entry);
    const value = text(option?.value);
    if (!option || !value) return [];
    return [{ value, label: label(option) || value, count: count(option.count) }];
  });
}

/** The API's facet lists, labelled for a reader. */
export function toCourseFacets(raw: unknown): CourseFacets {
  const facets = record(raw) ?? {};
  return {
    level: options(facets.levels),
    subject: options(facets.subjects),
    specialization: options(facets.specializations),
    duration: options(facets.durations),
    intake: options(facets.intakes, (option) =>
      intakeRange({
        startMonth: option.startMonth as number | null,
        endMonth: option.endMonth as number | null,
        shortLabel: option.shortLabel as string | null,
        name: option.label as string | null,
      }),
    ),
    studyMode: options(facets.studyModes, (option) =>
      humanise(String(option.value)),
    ),
  };
}

export type ActiveChip = {
  key: CourseFilterKey | 'q' | 'scholarship';
  value: string;
  label: string;
  /** The list without this one filter: everything else, sort included, stays. */
  search: string;
};

/**
 * One removable chip per filter in force, as the reference shows them above
 * its results -- each a link to the same list without that one value.
 */
export function activeChips(
  filters: CourseFilters,
  facets: CourseFacets,
): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.q.trim())
    chips.push({
      key: 'q',
      value: filters.q,
      label: `“${filters.q.trim()}”`,
      search: courseListSearch(filters, { q: '' }),
    });
  for (const group of COURSE_FILTER_GROUPS)
    for (const value of filters[group.key]) {
      const option = facets[group.key].find((entry) => entry.value === value);
      chips.push({
        key: group.key,
        value,
        label: option?.label ?? value,
        search: courseListSearch(filters, {
          [group.key]: filters[group.key].filter((entry) => entry !== value),
        }),
      });
    }
  if (filters.scholarship)
    chips.push({
      key: 'scholarship',
      value: 'true',
      label: 'With scholarships',
      search: courseListSearch(filters, { scholarship: false }),
    });
  return chips;
}

/**
 * An offering is named for the catalogue it sits in -- "MSc Data Science at
 * Elmswood University" -- which is the right name in a search result and a
 * redundant one on a card that names the university underneath.
 */
export function programmeName(name: string, university: string | null) {
  const suffix = university ? ` at ${university}` : '';
  return suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

function amount(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * How long a course runs: the offering's own figures where it states them,
 * the course's otherwise -- the university page reads it the same way. The
 * unit is said once, at the end: "3 years", "1–2 years".
 */
export function durationText(row: Row): string | null {
  const generic = record(row.genericCourse) ?? {};
  const own = amount(row.durationMin) ?? amount(row.durationMax);
  const source = own !== null ? row : generic;
  const min = amount(source.durationMin);
  const max = amount(source.durationMax);
  const unit = text(source.durationUnit)?.toLowerCase();
  if (min === null && max === null) return null;
  const low = min ?? max!;
  const high = max ?? min!;
  const figure = low === high ? String(low) : `${low}–${high}`;
  if (!unit) return figure;
  return `${figure} ${high === 1 ? unit.replace(/s$/, '') : unit}`;
}

/** "GBP 30,000/yr", or a range. Null when no fee is recorded. */
export function tuitionText(row: Row): string | null {
  const min = amount(row.tuitionMin);
  const max = amount(row.tuitionMax);
  /* A range whose ends are both zero is a field nobody filled in, not a
     course that costs nothing. */
  if ((min === null || min === 0) && (max === null || max === 0)) return null;
  const code = text(row.currencyCode);
  const figure =
    min !== null && max !== null && min !== max
      ? `${formatNumber(min)}–${formatNumber(max)}`
      : formatNumber(min ?? max);
  const period = row.tuitionPeriod === 'PER_YEAR' ? '/yr' : '';
  return `${code ? `${code} ` : ''}${figure}${period}`;
}

export type CountryRef = { name: string; slug: string; iso2Code: string | null };

export type OfferingCardData = {
  id: string;
  slug: string;
  /** The name with the university's own name taken off the end. */
  name: string;
  href: string;
  level: { code: string | null; name: string } | null;
  qualification: string | null;
  studyMode: string | null;
  subject: { name: string; slug: string } | null;
  specialization: { name: string; slug: string } | null;
  campus: { name: string; city: string | null } | null;
  duration: string | null;
  tuition: string | null;
  intakes: string[];
  nextDeadline: string | null;
  courseCode: string | null;
  university: {
    name: string;
    slug: string;
    href: string;
    country: CountryRef | null;
    /** "Oxford, United Kingdom", or the country alone. */
    location: string | null;
  };
};

export function toCountry(value: unknown): CountryRef | null {
  const country = record(value);
  const name = text(country?.name);
  const slug = text(country?.slug);
  return name && slug
    ? { name, slug, iso2Code: text(country?.iso2Code) }
    : null;
}

/** The first campus city a university records, for "City, Country". */
export function firstCity(university: Row | null): string | null {
  const campuses = Array.isArray(university?.campuses)
    ? (university!.campuses as unknown[])
    : [];
  for (const campus of campuses) {
    const city = text(record(campus)?.city);
    if (city) return city;
  }
  return null;
}

export function place(city: string | null, country: CountryRef | null) {
  return [city, country?.name].filter(Boolean).join(', ') || null;
}

function slugName(value: unknown) {
  const entry = record(value);
  const name = text(entry?.name);
  const slug = text(entry?.slug);
  return name && slug ? { name, slug } : null;
}

function upcoming(intakes: Row[], today = new Date()) {
  const floor = today.toISOString().slice(0, 10);
  return (
    intakes
      .map((entry) => text(entry.deadline)?.slice(0, 10) ?? null)
      .filter((deadline): deadline is string => Boolean(deadline && deadline >= floor))
      .sort()[0] ?? null
  );
}

/**
 * An API offering row as a card. A row that names its own university (the
 * related courses on a course page) uses it; a row from a university's own
 * list is handed that university.
 */
export function toOfferingCard(
  raw: unknown,
  owner?: { name: string; slug: string; country: CountryRef | null; city: string | null },
): OfferingCardData | null {
  const row = record(raw);
  const slug = text(row?.slug);
  const name = text(row?.name);
  if (!row || !slug || !name) return null;
  const university = record(row.university);
  const uni = owner ?? {
    name: text(university?.name) ?? '',
    slug: text(university?.slug) ?? '',
    country: toCountry(university?.country),
    city: firstCity(university),
  };
  if (!uni.slug || !uni.country) return null;
  const generic = record(row.genericCourse) ?? {};
  const level = record(row.courseLevel) ?? record(generic.courseLevel);
  const campus = record(row.campus);
  const intakes = (Array.isArray(row.intakes) ? row.intakes : [])
    .map(record)
    .filter((entry): entry is Row => Boolean(entry));
  const campusCity = text(campus?.city);
  return {
    id: String(row.id ?? slug),
    slug,
    name: programmeName(name, uni.name),
    href: offeringHref(uni.country.slug, uni.slug, slug),
    level: text(level?.name)
      ? { code: text(level?.code), name: text(level?.name)! }
      : null,
    qualification: text(generic.qualificationName) ?? text(generic.shortName),
    studyMode: text(row.studyMode) ? humanise(String(row.studyMode)) : null,
    subject: slugName(generic.subject),
    specialization: slugName(generic.subSubject),
    campus: text(campus?.name)
      ? { name: text(campus?.name)!, city: campusCity }
      : null,
    duration: durationText(row),
    tuition: tuitionText(row),
    intakes: [
      ...new Set(
        intakes.flatMap((entry) => {
          const intake = record(entry.intake);
          return intake
            ? [
                intakeRange({
                  startMonth: intake.startMonth as number | null,
                  endMonth: intake.endMonth as number | null,
                  shortLabel: intake.shortLabel as string | null,
                  name: intake.name as string | null,
                }),
              ]
            : [];
        }),
      ),
    ],
    nextDeadline: formatDate(upcoming(intakes)) || null,
    courseCode: text(row.courseCode),
    university: {
      name: uni.name,
      slug: uni.slug,
      href: universityHref(uni.slug),
      country: uni.country,
      location: place(campusCity ?? uni.city, uni.country),
    },
  };
}

export function toOfferingCards(
  raw: unknown,
  owner?: Parameters<typeof toOfferingCard>[1],
): OfferingCardData[] {
  return (Array.isArray(raw) ? raw : []).flatMap((entry) => {
    const card = toOfferingCard(entry, owner);
    return card ? [card] : [];
  });
}

/**
 * Where a redirect sends a request, with the query it arrived with. A link
 * to an old or misspelt address may carry a list's filters or a campaign's
 * tags, and neither should be lost on the way to the page that answers it.
 */
export function withQuery(
  path: string,
  query: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value])
      params.append(key, entry);
  const search = params.toString();
  if (!search) return path;
  const [address, hash] = path.split('#', 2);
  return `${address}${address!.includes('?') ? '&' : '?'}${search}${
    hash === undefined ? '' : `#${hash}`
  }`;
}

/**
 * The address a stored canonical should give way to. The catalogue's SEO
 * defaults still name the old flat course address, which now only
 * redirects here; an editor's own choice of anywhere else is kept.
 */
export function offeringCanonical(stored: unknown, nested: string) {
  const value = text(stored);
  if (!value || /^\/universities\/[^/]+\/courses(\/|$)/.test(value))
    return nested;
  return value;
}
