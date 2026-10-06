import type { CourseFilterOptions } from './catalog';
import {
  COURSE_FILTER_GROUPS,
  isNarrowedCourseList,
  readCourseFilters,
  type CourseFilterKey,
  type CourseFilters,
} from './university-courses';

/**
 * The address of /courses, read for its two views.
 *
 * The page is the reference's "Find a Course": by default it lists
 * programmes -- a course as one university teaches it -- and the programmes
 * block reads its own filters (`readCourseFilters`). The generic course
 * search the page had before is kept beside it as "Course guides"
 * (?view=guides), with its own filters, its own address names and its own
 * pager. Both views read the same address, so a link written for either --
 * or for the reference, or for the page as it used to be -- lands on the
 * same choice in whichever view opens.
 *
 * The course guides' API refuses a value it does not know with a 400, which
 * used to replace the whole page with "Courses are temporarily
 * unavailable". So the guides' filters are checked here against the
 * catalogue's own options before they are sent: a destination, subject,
 * specialization or intake that matches nothing narrows the list to
 * nothing and keeps its chip, as on the reference, and any other value the
 * list cannot take is dropped.
 */

export type CoursesView = 'programmes' | 'guides';

type Params = Record<string, string | string[] | undefined>;

function first(params: Params, ...keys: string[]): string {
  for (const key of keys) {
    const raw = params[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value) return value;
  }
  return '';
}

/** The view the address names, if it names one. */
export function requestedView(params: Params): CoursesView | null {
  const view = first(params, 'view').toLowerCase();
  return view === 'guides' || view === 'programmes' ? view : null;
}

/**
 * Which view the page opens on. Programmes, unless the address asks for
 * the guides -- or unless the catalogue has no programme at all, as the
 * live site has while its import sheets create none: then the page opens
 * on the course guides, offers no programmes view, and shows what it
 * showed before.
 */
export function chooseView(
  requested: CoursesView | null,
  programmes: number,
): CoursesView {
  if (programmes <= 0) return 'guides';
  return requested ?? 'programmes';
}

/**
 * "Load more" counts pages of eighteen in the address, and the programmes
 * API answers at most 360 rows at once: twenty pages. A further page in
 * the address is read as the last one that can be drawn whole -- by the
 * server, and by the list in the browser, which would otherwise go on
 * asking for pages the server never draws.
 */
export const PROGRAMME_MAX_PAGES = 20;

/* The API echoes what it left out as `key=value`, under whichever of a
   filter's names the request used. */
const IGNORED_KEYS: Record<string, CourseFilterKey> = {
  courseLevel: 'level',
  subSubject: 'specialization',
  study_mode: 'studyMode',
};

/**
 * The programme filters without what the API said it ignored -- a level,
 * a sort or a score it does not know, a fee range across currencies -- so
 * none of them shows as a chip, a ticked box or a part of the address the
 * page writes. Every other value stays, including a place nothing matches,
 * which narrows the list to nothing and keeps its chip.
 */
export function withoutIgnored(
  filters: CourseFilters,
  ignored: readonly string[],
): CourseFilters {
  const next = { ...filters };
  for (const entry of ignored) {
    const at = entry.indexOf('=');
    if (at < 1) continue;
    const name = entry.slice(0, at);
    const value = entry.slice(at + 1).toLowerCase();
    if (name === 'sort') next.sort = 'relevance';
    else if (name === 'tuitionMin' || name === 'minTuition') next.tuitionMin = '';
    else if (name === 'tuitionMax' || name === 'maxTuition') next.tuitionMax = '';
    else if (name === 'ielts' || name === 'toefl' || name === 'pte') next[name] = '';
    else if (name === 'page' || name === 'pg') next.page = 1;
    else {
      const key = IGNORED_KEYS[name] ?? name;
      if (COURSE_FILTER_GROUPS.some((group) => group.key === key)) {
        const group = key as CourseFilterKey;
        next[group] = next[group].filter((entry) => entry.toLowerCase() !== value);
      }
    }
  }
  return next;
}

/* ------------------------------------------------------------------ guides */

/** The guides' filters that take several values, comma-joined in the URL. */
export const GUIDE_MULTI_KEYS = [
  'level',
  'country',
  'subject',
  'subSubject',
  'studyMode',
  'intake',
  'englishTest',
] as const;
export type GuideMultiKey = (typeof GUIDE_MULTI_KEYS)[number];

/** The guides' filters that name a place or a field: a value nothing
 *  matches narrows the list to nothing rather than being dropped. */
const GUIDE_SLUG_KEYS = ['country', 'subject', 'subSubject', 'intake'] as const;
export type GuideSlugKey = (typeof GUIDE_SLUG_KEYS)[number];

/** How many values of each the guides' API accepts at once. */
const GUIDE_MAX: Record<GuideMultiKey, number> = {
  level: 20,
  country: 30,
  subject: 20,
  subSubject: 40,
  studyMode: 20,
  intake: 20,
  englishTest: 4,
};

const ENGLISH_TESTS = ['IELTS', 'TOEFL', 'PTE', 'DUOLINGO'];

/** The guides' orders, as their API names them. */
const GUIDE_SORTS = ['featured', 'name', 'newest', 'tuition-low', 'popularity'];
/* The reference's and the programmes' sort names, as the guides'. */
const GUIDE_SORT_ALIASES: Record<string, string> = {
  relevance: 'featured',
  title: 'name',
  fee: 'tuition-low',
};
/** The guides' default order, left out of the address. */
export const GUIDE_DEFAULT_SORT = 'featured';

/**
 * The programmes' filters the course guides have no counterpart for: a
 * university, a city or a course is where a programme is taught, and a
 * duration band, an application status and an English score are read from
 * each programme's own record. The guides cannot apply them, so they never
 * narrow the guides or count towards them; they ride along in the guides'
 * address instead, so a reader who looks at the guides and comes back finds
 * the programmes as they left them.
 */
export const PROGRAMME_ONLY_KEYS = [
  'university',
  'city',
  'course',
  'duration',
  'status',
  'ielts',
  'toefl',
  'pte',
] as const;
export type ProgrammeOnlyFilters = Pick<
  CourseFilters,
  (typeof PROGRAMME_ONLY_KEYS)[number]
>;

const NO_PROGRAMME_ONLY: ProgrammeOnlyFilters = {
  university: [],
  city: [],
  course: [],
  duration: [],
  status: [],
  ielts: '',
  toefl: '',
  pte: '',
};

/** Whether any filter the course guides cannot apply is in force. */
export function hasProgrammeOnly(filters: ProgrammeOnlyFilters): boolean {
  return PROGRAMME_ONLY_KEYS.some((key) => filters[key].length > 0);
}

/** Those filters as an address writes them, several values comma-joined. */
export function programmeOnlyEntries(
  filters: ProgrammeOnlyFilters = NO_PROGRAMME_ONLY,
): Array<[string, string]> {
  return PROGRAMME_ONLY_KEYS.flatMap((key): Array<[string, string]> => {
    const value = filters[key];
    const written = Array.isArray(value) ? value.join(',') : value;
    return written ? [[key, written]] : [];
  });
}

/** The guides' own page size, and the most their API returns at once. */
export const GUIDE_PAGE_SIZE = 12;
export const GUIDE_MAX_PAGE_SIZE = 100;

/* An amount the API accepts: whole, or with up to two decimals. */
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export type GuideFilters = Record<GuideMultiKey, string[]> & {
  q: string;
  scholarshipAvailable: boolean;
  postStudyWorkAvailable: boolean;
  minTuition: string;
  maxTuition: string;
  /** Empty for the default order. */
  sort: string;
  page: number;
  /** The page size the reader chose; null when they chose none. */
  pageSize: number | null;
  /** The programmes' own filters, carried through the guides' address
   *  untouched and never applied to the guides. */
  programmeOnly: ProgrammeOnlyFilters;
};

export const NO_GUIDE_FILTERS: GuideFilters = {
  q: '',
  level: [],
  country: [],
  subject: [],
  subSubject: [],
  studyMode: [],
  intake: [],
  englishTest: [],
  scholarshipAvailable: false,
  postStudyWorkAvailable: false,
  minTuition: '',
  maxTuition: '',
  sort: '',
  page: 1,
  pageSize: null,
  programmeOnly: NO_PROGRAMME_ONLY,
};

/**
 * The guides' filters as the address writes them, under every name the
 * page has answered to: the programme list's (`specialization`,
 * `scholarship`, `tuitionMin`), the reference's (`study_mode`, `pg`, its
 * level words and its sort names) and the guides' own (`subSubject`,
 * `scholarshipAvailable`, `minTuition`, `pageSize`). The programmes' own
 * filters are read too, to be carried. Nothing is checked against the
 * catalogue here; `checkGuideFilters` does that.
 */
export function readGuideFilters(params: Params): GuideFilters {
  const shared = readCourseFilters(params);
  const rawSort = first(params, 'sort').toLowerCase();
  const sort = GUIDE_SORT_ALIASES[rawSort] ?? rawSort;
  const size = Number(first(params, 'pageSize'));
  const lower = (values: string[]) => [...new Set(values.map((value) => value.toLowerCase()))];
  return {
    q: shared.q.trim(),
    level: shared.level.map((value) => value.toUpperCase()),
    country: lower(shared.country),
    subject: lower(shared.subject),
    subSubject: lower(shared.specialization),
    studyMode: shared.studyMode.map((value) => value.toUpperCase()),
    intake: lower(shared.intake),
    englishTest: shared.englishTest,
    scholarshipAvailable: shared.scholarship,
    postStudyWorkAvailable: shared.postStudyWork,
    minTuition: DECIMAL.test(shared.tuitionMin) ? shared.tuitionMin : '',
    maxTuition: DECIMAL.test(shared.tuitionMax) ? shared.tuitionMax : '',
    sort: GUIDE_SORTS.includes(sort) && sort !== GUIDE_DEFAULT_SORT ? sort : '',
    page: shared.page,
    pageSize:
      Number.isInteger(size) && size >= 1 ? Math.min(size, GUIDE_MAX_PAGE_SIZE) : null,
    programmeOnly: Object.fromEntries(
      PROGRAMME_ONLY_KEYS.map((key) => [key, shared[key]]),
    ) as ProgrammeOnlyFilters,
  };
}

export type GuideUnknown = Partial<Record<GuideSlugKey, string[]>>;

export type CheckedGuideFilters = {
  /** What the page shows and writes: every value it can apply, and the
   *  places and fields that match nothing, which keep their chips. */
  filters: GuideFilters;
  /** What is sent to the API: only values it accepts. */
  api: GuideFilters;
  /** The values in `filters` that match nothing in the catalogue. */
  unknown: GuideUnknown;
  /** True when a filter matches nothing at all, so the list is empty
   *  whatever else is chosen. */
  nothing: boolean;
};

/**
 * The guides' filters checked against the catalogue's own options -- the
 * filter options asked for with no filter, which lists every value any
 * published course carries.
 *
 * Within a filter the values are alternatives, so one that matches nothing
 * adds nothing: it stays in the address with its chip and is left out of
 * the request. A filter none of whose values matches anything narrows the
 * list to nothing. A level, a study mode, an English test or a sort the
 * list cannot take is dropped, as the reference ignores an option it does
 * not have; so are a fee range and the fee order unless exactly one
 * destination is chosen, because fees are only comparable in one currency.
 * An intake may be given as a month number, as the reference writes it.
 */
export function checkGuideFilters(
  filters: GuideFilters,
  options: CourseFilterOptions,
): CheckedGuideFilters {
  const known: Record<GuideMultiKey, Set<string>> = {
    level: new Set(options.levels.map((option) => option.value)),
    country: new Set(options.countries.map((option) => option.value)),
    subject: new Set(options.subjects.map((option) => option.value)),
    subSubject: new Set(options.subSubjects.map((option) => option.value)),
    studyMode: new Set(options.studyModes.map((option) => option.value)),
    intake: new Set(options.intakes.map((option) => option.value)),
    englishTest: new Set(ENGLISH_TESTS),
  };
  const shown = { ...filters };
  const api = { ...filters };
  const unknown: GuideUnknown = {};
  let nothing = false;

  for (const key of GUIDE_MULTI_KEYS) {
    let values = filters[key];
    if (key === 'intake')
      values = [
        ...new Set(
          values.flatMap((value) => {
            const month = Number(value);
            if (!/^\d{1,2}$/.test(value) || month < 1 || month > 12) return [value];
            const starting = options.intakes
              .filter((option) => option.startMonth === month)
              .map((option) => option.value);
            return starting.length ? starting : [value];
          }),
        ),
      ];
    const valid = values.filter((value) => known[key].has(value)).slice(0, GUIDE_MAX[key]);
    api[key] = valid;
    if ((GUIDE_SLUG_KEYS as readonly string[]).includes(key)) {
      const missing = values.filter((value) => !known[key].has(value));
      if (missing.length) unknown[key as GuideSlugKey] = missing;
      if (values.length && !valid.length) nothing = true;
      shown[key] = [...valid, ...missing];
    } else {
      shown[key] = valid;
    }
  }

  const oneCountry = api.country.length === 1;
  const low = Number(filters.minTuition);
  const high = Number(filters.maxTuition);
  const inverted = filters.minTuition !== '' && filters.maxTuition !== '' && low > high;
  for (const target of [shown, api]) {
    if (!oneCountry || inverted) {
      target.minTuition = '';
      target.maxTuition = '';
    }
    if (!oneCountry && target.sort === 'tuition-low') target.sort = '';
  }
  return { filters: shown, api, unknown, nothing };
}

/** The filters as the guides' API names them, a page at a time. */
export function guideApiParams(filters: GuideFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q) params.q = filters.q;
  for (const key of GUIDE_MULTI_KEYS)
    if (filters[key].length) params[key] = filters[key].join(',');
  if (filters.scholarshipAvailable) params.scholarshipAvailable = 'true';
  if (filters.postStudyWorkAvailable) params.postStudyWorkAvailable = 'true';
  if (filters.minTuition) params.minTuition = filters.minTuition;
  if (filters.maxTuition) params.maxTuition = filters.maxTuition;
  if (filters.sort) params.sort = filters.sort;
  if (filters.page > 1) params.page = String(filters.page);
  params.pageSize = String(filters.pageSize ?? GUIDE_PAGE_SIZE);
  return params;
}

/**
 * The query string for a guides list, in the guides' own names and one
 * spelling: the default order and the first page left out, and ?view=guides
 * first wherever the programmes are the page's default. The programmes'
 * own filters follow the guides' unchanged, in the programmes' names.
 */
export function guideListSearch(
  filters: GuideFilters,
  change: Partial<GuideFilters> = {},
  { view = true }: { view?: boolean } = {},
): string {
  const next: GuideFilters = { ...filters, page: 1, ...change };
  const params = new URLSearchParams();
  if (view) params.set('view', 'guides');
  if (next.q.trim()) params.set('q', next.q.trim());
  for (const key of GUIDE_MULTI_KEYS)
    if (next[key].length) params.set(key, next[key].join(','));
  if (next.scholarshipAvailable) params.set('scholarshipAvailable', 'true');
  if (next.postStudyWorkAvailable) params.set('postStudyWorkAvailable', 'true');
  if (next.minTuition) params.set('minTuition', next.minTuition);
  if (next.maxTuition) params.set('maxTuition', next.maxTuition);
  for (const [key, value] of programmeOnlyEntries(next.programmeOnly))
    params.set(key, value);
  if (next.sort && next.sort !== GUIDE_DEFAULT_SORT) params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  if (next.pageSize) params.set('pageSize', String(next.pageSize));
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** How many filters narrow a guides list (search and sort are not filters). */
export function guideFilterCount(filters: GuideFilters) {
  return (
    GUIDE_MULTI_KEYS.reduce((sum, key) => sum + filters[key].length, 0) +
    (filters.scholarshipAvailable ? 1 : 0) +
    (filters.postStudyWorkAvailable ? 1 : 0) +
    (filters.minTuition ? 1 : 0) +
    (filters.maxTuition ? 1 : 0)
  );
}

/** The same choice as the programmes list writes it, for the switcher:
 *  the programmes' own filters the guides carried come back with it. */
export function guidesAsProgrammes(filters: GuideFilters): Partial<CourseFilters> {
  return {
    ...filters.programmeOnly,
    q: filters.q,
    level: filters.level,
    country: filters.country,
    subject: filters.subject,
    specialization: filters.subSubject,
    studyMode: filters.studyMode,
    intake: filters.intake,
    englishTest: filters.englishTest,
    scholarship: filters.scholarshipAvailable,
    postStudyWork: filters.postStudyWorkAvailable,
    tuitionMin: filters.minTuition,
    tuitionMax: filters.maxTuition,
    sort:
      filters.sort === 'tuition-low'
        ? 'fee'
        : filters.sort === 'name' || filters.sort === 'newest'
          ? filters.sort
          : 'relevance',
  };
}

/* ------------------------------------------------------------------ robots */

const GUIDE_ONLY_KEYS = ['view', 'pageSize'];

/**
 * Whether the address asks for a slice of /courses rather than the page:
 * a search, a filter, an order, a later page or the other view. The
 * reference keeps every such state out of the index while following its
 * links; the bare page stays indexed under its canonical. A filter the
 * list then drops still marks the address as a slice -- it is not the
 * page's own address either.
 */
export function isNarrowedCourses(params: Params): boolean {
  if (isNarrowedCourseList(params)) return true;
  if (GUIDE_ONLY_KEYS.some((key) => first(params, key))) return true;
  const sort = first(params, 'sort').toLowerCase();
  return Boolean(sort) && sort !== 'relevance' && sort !== GUIDE_DEFAULT_SORT;
}
