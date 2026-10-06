import { formatNumber } from './format';
import { intakeRange } from './intake-range';
import { offeringHref, universityHref } from './university-links';

/**
 * Programmes -- a course as one university teaches it -- as the pages show
 * them: a university's own list, the course finder, a destination's subject
 * pages and each programme's page.
 *
 * They all turn the API's offering rows into the same card, and every list
 * keeps its filters in its address so a filtered list can be shared,
 * bookmarked and come back from. Both of those are decided here, once,
 * without anything that only runs on a server -- the filter panel and the
 * "Load more" button use the same functions in the browser.
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

/** The finder's orders: the reference's, and "Recently added", which the
 *  course finder offered before it listed programmes. */
export const PROGRAMME_SORTS = [
  ...COURSE_SORTS,
  { value: 'newest', label: 'Recently added' },
] as const;

/* The reference's sort names, and the course finder's old ones, as ours. */
const SORT_ALIASES: Record<string, string> = {
  title: 'name',
  'tuition-low': 'fee',
  featured: 'relevance',
};

/* The reference's study-level words as our level codes. "Postgraduate" and
   "short course" name no one level of ours, so they are left as written and
   the API leaves them out. */
const LEVEL_WORDS: Record<string, string> = {
  undergraduate: 'UG',
  masters: 'PG',
  mba: 'MBA',
  phd: 'PHD',
  diploma: 'DIPLOMA',
  certificate: 'CERTIFICATE',
  foundation: 'FOUNDATION',
  pathway: 'PATHWAY',
};

export type CourseFilterKey =
  | 'country'
  | 'university'
  | 'city'
  | 'course'
  | 'level'
  | 'subject'
  | 'specialization'
  | 'duration'
  | 'intake'
  | 'studyMode'
  | 'englishTest'
  | 'status';

/**
 * Every filter that takes a list of values, in the order an address spells
 * them. Which of them a list's panel offers is the list's own choice: a
 * university's list has no use for a University filter.
 */
export const COURSE_FILTER_GROUPS: ReadonlyArray<{
  key: CourseFilterKey;
  label: string;
}> = [
  { key: 'country', label: 'Country' },
  { key: 'university', label: 'University' },
  { key: 'city', label: 'City' },
  { key: 'course', label: 'Course' },
  { key: 'level', label: 'Degree level' },
  { key: 'subject', label: 'Subject' },
  { key: 'specialization', label: 'Specialization' },
  { key: 'duration', label: 'Duration' },
  { key: 'intake', label: 'Intake' },
  { key: 'studyMode', label: 'Study mode' },
  { key: 'englishTest', label: 'English test' },
  { key: 'status', label: 'Application status' },
];

/** What a panel can hold besides the lists of options. */
export type CoursePanelGroup = CourseFilterKey | 'tuition' | 'scores' | 'extras';

/** A university's own list: the six filters it has always offered. */
export const UNIVERSITY_COURSE_GROUPS: readonly CoursePanelGroup[] = [
  'level',
  'subject',
  'specialization',
  'duration',
  'intake',
  'studyMode',
];

/**
 * The finder's panel, in the design's order -- Country, Degree level,
 * Subject, Specialization, University, Annual tuition, Duration, Intake,
 * City, Study mode -- then the reference's English and application-status
 * filters and the extras the course finder already had. The design's
 * Language group is left out: no programme records the language it is
 * taught in. A course is chosen from its guide, never from the panel.
 */
export const PROGRAMME_COURSE_GROUPS: readonly CoursePanelGroup[] = [
  'country',
  'level',
  'subject',
  'specialization',
  'university',
  'tuition',
  'duration',
  'intake',
  'city',
  'studyMode',
  'englishTest',
  'scores',
  'status',
  'extras',
];

/** The English tests a "my score" can be given for, with the scores the
 *  reference offers for each. */
export const ENGLISH_SCORES = [
  { key: 'ielts', label: 'IELTS', scores: ['5', '5.5', '6', '6.5', '7', '7.5', '8'] },
  { key: 'toefl', label: 'TOEFL', scores: ['60', '70', '80', '90', '100', '110'] },
  { key: 'pte', label: 'PTE', scores: ['50', '55', '60', '65', '70', '75', '80'] },
] as const;
export type ScoreKey = (typeof ENGLISH_SCORES)[number]['key'];
const SCORE_RANGE: Record<ScoreKey, [number, number]> = {
  ielts: [0, 9],
  toefl: [0, 120],
  pte: [10, 90],
};

export type CourseFilters = Record<CourseFilterKey, string[]> & {
  q: string;
  /** Courses with a live scholarship recorded against them. The old list
   *  took this in its address, so a link that carries it still narrows. */
  scholarship: boolean;
  /** Courses in a country that lets graduates stay on to work. */
  postStudyWork: boolean;
  /** "My score": the English score a student holds, per test, as typed in
   *  the address. Empty when not given. */
  ielts: string;
  toefl: string;
  pte: string;
  /** A fee range, which only means something inside one country. */
  tuitionMin: string;
  tuitionMax: string;
  sort: string;
  /** How many pages of eighteen the list shows, from the first: "Load
   *  more" writes it into the address and the link that stands in for the
   *  button without script carries it, so a reload or Back from a course
   *  comes to the same place in the list. The university lists read their
   *  `page` the same way. */
  page: number;
};

/**
 * The filters a list is fixed to by where it sits: a university's list is
 * that university's, a destination's subject page is that country and that
 * subject. They are sent to the API but never offered, chipped or written
 * into the address, which already carries them in its path.
 */
export type CourseScope = Partial<Record<CourseFilterKey, string[]>>;

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

const unique = (list: string[]) => [...new Set(list)];

/** A number within a range, as the address wrote it; empty otherwise. */
function figure(raw: string | undefined, min: number, max = Infinity) {
  if (!raw) return '';
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? raw : '';
}

/**
 * The filters an address asks for. The names the old lists used --
 * `courseLevel`, `subSubject`, `scholarshipAvailable`, `minTuition` -- and
 * the reference's own -- `study_mode`, `pg`, its level words and its sort
 * names -- are all read, so a link written for any of them lands on the
 * same courses.
 */
export function readCourseFilters(params: Params): CourseFilters {
  const rawSort = readAll(params, 'sort')[0] ?? '';
  const sort = SORT_ALIASES[rawSort] ?? rawSort;
  const page = Number(readAll(params, 'page', 'pg')[0]);
  const flag = (...keys: string[]) => readAll(params, ...keys).includes('true');
  const score = (key: ScoreKey) =>
    figure(readAll(params, key)[0], ...SCORE_RANGE[key]);
  return {
    q: (readAll(params, 'q')[0] ?? '').slice(0, 100),
    country: readAll(params, 'country'),
    university: readAll(params, 'university'),
    city: readAll(params, 'city'),
    course: readAll(params, 'course'),
    level: unique(
      readAll(params, 'level', 'courseLevel').map(
        (value) => LEVEL_WORDS[value.toLowerCase()] ?? value,
      ),
    ),
    subject: readAll(params, 'subject'),
    specialization: readAll(params, 'specialization', 'subSubject'),
    duration: readAll(params, 'duration'),
    intake: readAll(params, 'intake'),
    /* "full-time", as the reference writes it, is our FULL_TIME. */
    studyMode: unique(
      readAll(params, 'studyMode', 'study_mode').map((value) =>
        /[a-z-]/.test(value) ? value.toUpperCase().replace(/[\s-]+/g, '_') : value,
      ),
    ),
    englishTest: unique(
      readAll(params, 'englishTest').map((value) => value.toUpperCase()),
    ),
    status: readAll(params, 'status').filter(
      (value) => value === 'open' || value === 'closed',
    ),
    scholarship: flag('scholarship', 'scholarshipAvailable'),
    postStudyWork: flag('postStudyWork', 'postStudyWorkAvailable'),
    ielts: score('ielts'),
    toefl: score('toefl'),
    pte: score('pte'),
    tuitionMin: figure(readAll(params, 'tuitionMin', 'minTuition')[0], 0),
    tuitionMax: figure(readAll(params, 'tuitionMax', 'maxTuition')[0], 0),
    sort: PROGRAMME_SORTS.some((option) => option.value === sort)
      ? sort
      : 'relevance',
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

/** Every filter cleared: the change that turns a list back into the whole
 *  list, its search and its order kept. */
export const NO_FILTERS: Partial<CourseFilters> = {
  ...Object.fromEntries(COURSE_FILTER_GROUPS.map((group) => [group.key, []])),
  scholarship: false,
  postStudyWork: false,
  ielts: '',
  toefl: '',
  pte: '',
  tuitionMin: '',
  tuitionMax: '',
};

/** The same filters with the ones a list is fixed to taken out: the path
 *  already says them, so the address must not say them again. */
export function withoutScope(
  filters: CourseFilters,
  scope: CourseScope = {},
): CourseFilters {
  const next = { ...filters };
  for (const key of Object.keys(scope) as CourseFilterKey[])
    if (scope[key]?.length) next[key] = [];
  return next;
}

/** How many filters narrow the list (search and sort are not filters). */
export function activeFilterCount(filters: CourseFilters) {
  return (
    COURSE_FILTER_GROUPS.reduce(
      (sum, group) => sum + filters[group.key].length,
      0,
    ) +
    (filters.scholarship ? 1 : 0) +
    (filters.postStudyWork ? 1 : 0) +
    ENGLISH_SCORES.filter((test) => filters[test.key]).length +
    (filters.tuitionMin ? 1 : 0) +
    (filters.tuitionMax ? 1 : 0)
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
    if (group.key !== 'status' && next[group.key].length)
      params.set(group.key, next[group.key].join(','));
  if (next.scholarship) params.set('scholarship', 'true');
  if (next.postStudyWork) params.set('postStudyWork', 'true');
  for (const test of ENGLISH_SCORES)
    if (next[test.key]) params.set(test.key, next[test.key]);
  if (next.status.length) params.set('status', next.status.join(','));
  if (next.tuitionMin) params.set('tuitionMin', next.tuitionMin);
  if (next.tuitionMax) params.set('tuitionMax', next.tuitionMax);
  if (next.sort && next.sort !== 'relevance') params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  const search = params.toString();
  return search ? `?${search}` : '';
}

/**
 * Whether an address asks for a slice of the list rather than the list:
 * searched, filtered, sorted or loaded further. The behaviour reference
 * keeps such a view out of the index while following its links, and so do
 * this site's own university lists. Read through the canonical spelling,
 * so `?sort=relevance` or `?page=1` -- the bare list under another
 * address -- still names the bare list as its canonical instead.
 */
export function isNarrowedCourseList(params: Params): boolean {
  const filters = readCourseFilters(params);
  return courseListSearch(filters, { page: filters.page }) !== '';
}

/**
 * The same filters, as the course API names them: one page of eighteen.
 * A list fixed to part of the catalogue sends that part too, and names it
 * in `within` so the programmes API counts its options over that part
 * rather than over everything.
 */
export function courseApiParams(
  filters: CourseFilters,
  page = filters.page,
  scope: CourseScope = {},
): Record<string, string> {
  const params: Record<string, string> = {
    limit: String(COURSE_PAGE_SIZE),
    page: String(page),
  };
  if (filters.q.trim()) params.q = filters.q.trim();
  const fixed: CourseFilterKey[] = [];
  for (const group of COURSE_FILTER_GROUPS) {
    const pinned = scope[group.key] ?? [];
    if (pinned.length) fixed.push(group.key);
    const values = pinned.length ? pinned : filters[group.key];
    if (values.length) params[group.key] = values.join(',');
  }
  if (filters.scholarship) params.scholarshipAvailable = 'true';
  if (filters.postStudyWork) params.postStudyWork = 'true';
  for (const test of ENGLISH_SCORES)
    if (filters[test.key]) params[test.key] = filters[test.key];
  if (filters.tuitionMin) params.tuitionMin = filters.tuitionMin;
  if (filters.tuitionMax) params.tuitionMax = filters.tuitionMax;
  if (filters.sort !== 'relevance') params.sort = filters.sort;
  if (fixed.length) params.within = fixed.join(',');
  return params;
}

/** Every page the address asks for, from the first, in one answer. */
export function courseRunParams(
  filters: CourseFilters,
  scope: CourseScope = {},
): Record<string, string> {
  return {
    ...courseApiParams(filters, 1, scope),
    limit: String(COURSE_PAGE_SIZE * filters.page),
  };
}

export type FacetOption = { value: string; label: string; count: number };
export type CourseFacets = Record<CourseFilterKey, FacetOption[]> & {
  /** "With scholarships" and "Post-study work", each with its count. */
  extras: FacetOption[];
  /** The fee range, offered inside one country only, in the currency its
   *  programmes record. */
  tuition: { currencyCode: string | null; count: number } | null;
};

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

/**
 * "2 August 2027": how a university's pages write a date -- its profile,
 * its course list and each course page -- so the same deadline reads the
 * same way on all three. The site's medium form ("Aug 2, 2027") is left to
 * the other pages. Fixed to UTC so the server and the browser agree.
 */
export function dateLabel(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
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
  const tuition = record(facets.tuition);
  return {
    country: options(facets.countries),
    university: options(facets.universities),
    city: options(facets.cities),
    course: options(facets.courses),
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
    englishTest: options(facets.englishTests),
    status: options(facets.status),
    extras: options(facets.extras),
    tuition: tuition
      ? { currencyCode: text(tuition.currencyCode), count: count(tuition.count) }
      : null,
  };
}

/** The finder's headline figures, catalogue-wide, as the API counts them. */
export type ProgrammeSummary = {
  programmes: number;
  universities: number;
  cities: number;
  intakeMonths: number;
  countries: number;
};

export function toProgrammeSummary(raw: unknown): ProgrammeSummary {
  const summary = record(raw) ?? {};
  return {
    programmes: count(summary.programmes),
    universities: count(summary.universities),
    cities: count(summary.cities),
    intakeMonths: count(summary.intakeMonths),
    countries: count(summary.countries),
  };
}

export type ActiveChip = {
  key:
    | CourseFilterKey
    | 'q'
    | 'scholarship'
    | 'postStudyWork'
    | ScoreKey
    | 'tuitionMin'
    | 'tuitionMax';
  value: string;
  label: string;
  /** The list without this one filter: everything else, sort included, stays. */
  search: string;
};

/**
 * One removable chip per filter in force, as the reference shows them above
 * its results -- each a link to the same list without that one value. A
 * value nothing carries keeps its chip, as on the reference, so the way out
 * of an empty list is always on the page.
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
  if (filters.postStudyWork)
    chips.push({
      key: 'postStudyWork',
      value: 'true',
      label: 'Post-study work',
      search: courseListSearch(filters, { postStudyWork: false }),
    });
  for (const test of ENGLISH_SCORES)
    if (filters[test.key])
      chips.push({
        key: test.key,
        value: filters[test.key],
        label: `${test.label} score ${filters[test.key]}`,
        search: courseListSearch(filters, { [test.key]: '' }),
      });
  const currency = facets.tuition?.currencyCode;
  const money = (value: string) =>
    `${currency ? `${currency} ` : ''}${formatNumber(Number(value))}`;
  if (filters.tuitionMin)
    chips.push({
      key: 'tuitionMin',
      value: filters.tuitionMin,
      label: `Tuition from ${money(filters.tuitionMin)}`,
      search: courseListSearch(filters, { tuitionMin: '' }),
    });
  if (filters.tuitionMax)
    chips.push({
      key: 'tuitionMax',
      value: filters.tuitionMax,
      label: `Tuition up to ${money(filters.tuitionMax)}`,
      search: courseListSearch(filters, { tuitionMax: '' }),
    });
  return chips;
}

/** A requirement a course lists, as far as a card reads one. */
export type RequirementLike = {
  category: string;
  title: string;
  minimumScore: string | null;
};

/**
 * What the course's own requirements say about the language it is taught
 * in: an English test means English, with the score each test asks for --
 * "IELTS 6.5 minimum". Nothing else is read as a language, and nothing is
 * borrowed from the country: plenty of courses in Germany or the
 * Netherlands are taught in English, so a country's language would misstate
 * them. The course page, its card and the comparison all read it here, so
 * they cannot disagree.
 */
export function teachingLanguage(
  requirements: RequirementLike[],
): { value: string; note: string | null } | null {
  const tests = requirements.filter((requirement) =>
    /ENGLISH/.test(requirement.category.toUpperCase()),
  );
  if (!tests.length) return null;
  const note = tests
    .map((test) =>
      test.minimumScore ? `${test.title} ${test.minimumScore} minimum` : test.title,
    )
    .join(' · ');
  return { value: 'English', note: note || null };
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

/** An English test a course asks for, and the score it asks, as listed. */
export type EnglishTestEntry = {
  test: 'IELTS' | 'TOEFL' | 'PTE' | null;
  title: string;
  minimum: string | null;
};

export type OfferingCardData = {
  id: string;
  /** The offering's own id, which a student's saved list is keyed by;
   *  null for a row that does not carry one. */
  offeringId: string | null;
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
  /** The language it is taught in, read the way its page reads it: from an
   *  English requirement it lists, with that evidence; null when it lists
   *  none, which is "Not listed", never a guess. */
  language: { value: string; note: string | null } | null;
  /** The English tests it lists, for the card's entry line. */
  englishTests: EnglishTestEntry[];
  /** The course guide it is an instance of. */
  genericCourse: { name: string; slug: string } | null;
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

/** The requirements a row lists, as the card reads them. */
function requirementsOf(row: Row): RequirementLike[] {
  return (Array.isArray(row.requirements) ? row.requirements : []).flatMap(
    (entry) => {
      const requirement = record(entry);
      const title = text(requirement?.title);
      if (!requirement || !title) return [];
      const score = requirement.minimumScore;
      return [
        {
          category: text(requirement.category) ?? 'OTHER',
          title,
          minimumScore:
            score === null || score === undefined || score === ''
              ? null
              : String(Number(score)),
        },
      ];
    },
  );
}

/* A requirement filed as an English test, by the test its title names. A
   title that names none -- some records hold a placeholder -- is kept with
   no test, so the card can still show what was written. */
function englishTestsOf(requirements: RequirementLike[]): EnglishTestEntry[] {
  return requirements
    .filter(
      (requirement) => requirement.category.trim().toUpperCase() === 'ENGLISH_TEST',
    )
    .map((requirement) => ({
      test:
        (['IELTS', 'TOEFL', 'PTE'] as const).find((test) =>
          new RegExp(`\\b${test}\\b`, 'i').test(requirement.title),
        ) ?? null,
      title: requirement.title,
      minimum: requirement.minimumScore,
    }));
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
  const requirements = requirementsOf(row);
  return {
    id: String(row.id ?? slug),
    offeringId: text(row.id),
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
    nextDeadline: dateLabel(upcoming(intakes)),
    courseCode: text(row.courseCode),
    language: teachingLanguage(requirements),
    englishTests: englishTestsOf(requirements),
    genericCourse: slugName(generic),
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
 * The programmes API's answer as a results block draws it: the cards, the
 * counts beside the filters, the count told in pages of eighteen, the
 * headline figures, the order applied and what the API left out of the
 * request -- which a page can drop from its address.
 */
export function toProgrammeList(raw: unknown, filters: CourseFilters) {
  const result = record(raw) ?? {};
  const meta = record(result.meta) ?? {};
  return {
    cards: toOfferingCards(result.data),
    facets: toCourseFacets(result.facets),
    meta: courseRunMeta(meta, filters),
    summary: toProgrammeSummary(result.summary),
    sort: text(meta.sort) ?? 'relevance',
    ignored: (Array.isArray(meta.ignored) ? meta.ignored : []).filter(
      (entry): entry is string => typeof entry === 'string',
    ),
  };
}
export type ProgrammeList = ReturnType<typeof toProgrammeList>;

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
