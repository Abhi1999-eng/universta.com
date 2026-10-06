/**
 * Programmes -- a course as one university teaches it -- across every
 * university, the way the behaviour reference's "Find a Course" lists them.
 *
 * The reference's finder searches the whole catalogue of programmes, not
 * one university's: by country, university and city, by level, subject and
 * specialization, by duration, intake and study mode, by the English score a
 * student holds and by whether applications are still open, each option
 * counted over the whole catalogue. Only its University and City lists
 * narrow to the countries chosen, so a reader who picks the United Kingdom
 * is offered UK universities and still sees how many Master's there are in
 * all.
 *
 * Its addresses use its own parameter names, and the links already written
 * into this site use the course list's older ones, so both spellings are
 * read here. An address that asks for something the catalogue cannot answer
 * -- a sort it does not know, a level that does not exist, a fee bound
 * across several currencies -- is answered without that part rather than
 * refused, and the answer says what was left out. A slug that matches
 * nothing is different: it is a real question whose answer is none.
 *
 * Built on the university list's rules and, like them, kept free of Prisma
 * and Nest so they can be tested as plain data.
 */
import {
  courseCity,
  courseFacets,
  COURSE_SORTS,
  DURATION_BANDS,
  fold,
  matchesCourseQuery,
  nextDeadline,
  number,
  tally,
  values,
  type CourseQuery,
  type CourseSort,
  type FacetOption,
  type OfferingLike,
  type Query,
} from './university-courses';

/** The reference shows eighteen programmes before "Load more". */
export const PROGRAMME_PAGE_SIZE = 18;

/**
 * The longest page one request may ask for. "Load more" keeps how far it
 * has gone in the address and a reload draws that whole run in one answer,
 * so twenty presses' worth has to fit.
 */
export const PROGRAMME_MAX_LIMIT = 360;

/**
 * How many programmes one read takes. Every live programme is read and the
 * filters, counts and order are applied in memory, which is what keeps a
 * count and the list it opens in agreement; this is the safety net above
 * any catalogue that approach suits. Past it the answer says it was cut
 * short, and counting in the database is the next step.
 */
export const PROGRAMME_SCAN_CAP = 20_000;

/** The English tests a score can be given for, with the range each is
 * marked on: a score outside it is a typo, not a filter. */
export const ENGLISH_TESTS = [
  { value: 'IELTS', min: 0, max: 9 },
  { value: 'TOEFL', min: 0, max: 120 },
  { value: 'PTE', min: 10, max: 90 },
] as const;
export type EnglishTest = (typeof ENGLISH_TESTS)[number]['value'];

export type ApplicationStatus = 'open' | 'closed';

/** The filters a list can be fixed to, so its counts are taken over that
 * part of the catalogue: a destination's subject page counts only that
 * destination's programmes in that subject. */
export const PROGRAMME_SCOPE_KEYS = [
  'country',
  'university',
  'city',
  'course',
  'subject',
  'specialization',
  'level',
] as const;
export type ProgrammeScopeKey = (typeof PROGRAMME_SCOPE_KEYS)[number];

type Country = {
  name: string;
  slug: string;
  iso2Code?: string | null;
  /** Whether the country lets graduates stay on to work, from its work
   * profile: the programme inherits it from where it is taught. */
  postStudyWork?: boolean | null;
};

export type ProgrammeRow = OfferingLike & {
  id: string;
  currencyCode?: string | null;
  university: {
    name: string;
    slug: string;
    country: Country | null;
    campuses?: Array<{ city?: string | null }>;
  };
};

export type ProgrammeQuery = Omit<CourseQuery, 'intakes'> & {
  countries: string[];
  universities: string[];
  cities: string[];
  courses: string[];
  /** Intakes by slug -- "september" -- as the filter offers them. */
  intakes: string[];
  /** Intakes by the month they start, as the reference's addresses carry
   * them: ?intake=9 is every intake that opens in September. */
  intakeMonths: number[];
  postStudyWork: boolean;
  englishTests: EnglishTest[];
  scores: Partial<Record<EnglishTest, number>>;
  /** Either status, or both: a programme with no recorded deadline
   * answers neither. */
  statuses: ApplicationStatus[];
  page: number;
  limit: number;
  within: ProgrammeScopeKey[];
  /** What the request asked for that was left out, as `key=value`. */
  ignored: string[];
};

/**
 * The reference's study-level words as our level codes. "Postgraduate"
 * spans Master's, MBA and doctorates and "short course" is no level we
 * record, so those two are left out rather than guessed at.
 */
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

/** The reference's sort names, and the course list's old ones, as ours. */
const SORT_ALIASES: Record<string, CourseSort> = {
  title: 'name',
  'tuition-low': 'fee',
  featured: 'relevance',
};

/* Filters the reference offers that no programme record can answer: no
   field says how a programme is delivered, what type it is or what
   language it is taught in. Named in the answer as left out, so a page can
   drop them from its address instead of pretending to apply them. */
const UNSUPPORTED = ['delivery', 'type', 'language'] as const;

/** "Coventry" -> "coventry", "São Paulo" -> "sao-paulo". */
export function citySlug(name: string) {
  return fold(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The filters a request asks for, read under both spellings.
 *
 * `levels` is the list of level codes the catalogue knows; a level outside
 * it is left out rather than matched against nothing, since no programme
 * could ever answer it.
 */
export function parseProgrammeQuery(
  query: Query,
  known: { levels?: readonly string[] } = {},
): ProgrammeQuery {
  const ignored: string[] = [];
  const first = (...keys: string[]) => {
    for (const key of keys) {
      const raw = query[key];
      const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
      if (value) return { key, value };
    }
    return null;
  };
  const slugs = (...keys: string[]) =>
    values(query, ...keys).map((value) => value.toLowerCase());

  const levels: string[] = [];
  for (const raw of values(query, 'level', 'courseLevel')) {
    const code = LEVEL_WORDS[raw.toLowerCase()] ?? raw.toUpperCase();
    const knownCode =
      !known.levels || known.levels.includes(code) ? code : null;
    if (knownCode && !levels.includes(knownCode)) levels.push(knownCode);
    else if (!knownCode) ignored.push(`level=${raw}`);
  }

  const durations: string[] = [];
  for (const raw of values(query, 'duration'))
    if (DURATION_BANDS.some((band) => band.value === raw)) durations.push(raw);
    else ignored.push(`duration=${raw}`);

  const intakes: string[] = [];
  const intakeMonths: number[] = [];
  for (const raw of values(query, 'intake')) {
    if (/^\d+$/.test(raw)) {
      const month = Number(raw);
      if (month >= 1 && month <= 12) intakeMonths.push(month);
      else ignored.push(`intake=${raw}`);
    } else intakes.push(raw.toLowerCase());
  }

  /* "full-time", as the reference writes it, is our FULL_TIME. */
  const studyModes = values(query, 'studyMode', 'study_mode').map((raw) =>
    raw.toUpperCase().replace(/[\s-]+/g, '_'),
  );

  const englishTests: EnglishTest[] = [];
  for (const raw of values(query, 'englishTest')) {
    const test = ENGLISH_TESTS.find(
      (entry) => entry.value === raw.toUpperCase(),
    );
    if (test) englishTests.push(test.value);
    else ignored.push(`englishTest=${raw}`);
  }

  const scores: ProgrammeQuery['scores'] = {};
  for (const test of ENGLISH_TESTS) {
    const raw = first(test.value.toLowerCase());
    if (!raw) continue;
    const score = Number(raw.value);
    if (Number.isFinite(score) && score >= test.min && score <= test.max)
      scores[test.value] = score;
    else ignored.push(`${raw.key}=${raw.value}`);
  }

  const flag = (...keys: string[]) => {
    const raw = first(...keys);
    if (!raw || raw.value === 'false') return false;
    if (raw.value === 'true') return true;
    ignored.push(`${raw.key}=${raw.value}`);
    return false;
  };
  const scholarship = flag('scholarship', 'scholarshipAvailable');
  const postStudyWork = flag('postStudyWork', 'postStudyWorkAvailable');

  const statuses: ApplicationStatus[] = [];
  for (const raw of values(query, 'status'))
    if (raw === 'open' || raw === 'closed') {
      if (!statuses.includes(raw)) statuses.push(raw);
    } else ignored.push(`status=${raw}`);

  const countries = slugs('country');
  /* Fees are recorded in each destination's own currency and nothing here
     converts between them, so a bound or a "lowest first" across several
     countries would compare pounds with yen. Both apply inside one. */
  const oneCountry = countries.length === 1;
  const money = (...keys: string[]) => {
    const raw = first(...keys);
    if (!raw) return null;
    const amount = Number(raw.value);
    if (oneCountry && Number.isFinite(amount) && amount >= 0) return amount;
    ignored.push(`${raw.key}=${raw.value}`);
    return null;
  };

  const sortRaw = first('sort');
  let sort: CourseSort = 'relevance';
  if (sortRaw) {
    const named =
      SORT_ALIASES[sortRaw.value] ??
      COURSE_SORTS.find((entry) => entry === sortRaw.value);
    if (named && (named !== 'fee' || oneCountry)) sort = named;
    else ignored.push(`sort=${sortRaw.value}`);
  }

  const pageRaw = first('page', 'pg');
  let page = 1;
  if (pageRaw) {
    const value = Number(pageRaw.value);
    if (Number.isInteger(value) && value >= 1) page = Math.min(value, 10_000);
    else ignored.push(`${pageRaw.key}=${pageRaw.value}`);
  }

  const limitRaw = first('limit', 'pageSize');
  let limit = PROGRAMME_PAGE_SIZE;
  if (limitRaw) {
    const value = Number(limitRaw.value);
    if (Number.isInteger(value) && value >= 1 && value <= PROGRAMME_MAX_LIMIT)
      limit = value;
    else ignored.push(`${limitRaw.key}=${limitRaw.value}`);
  }

  const within: ProgrammeScopeKey[] = [];
  for (const raw of values(query, 'within'))
    if ((PROGRAMME_SCOPE_KEYS as readonly string[]).includes(raw))
      within.push(raw as ProgrammeScopeKey);
    else ignored.push(`within=${raw}`);

  for (const key of UNSUPPORTED)
    for (const raw of values(query, key)) ignored.push(`${key}=${raw}`);

  return {
    q: (first('q')?.value ?? '').slice(0, 100),
    countries,
    universities: slugs('university'),
    cities: slugs('city'),
    courses: slugs('course'),
    levels,
    subjects: slugs('subject'),
    specializations: slugs('specialization', 'subSubject'),
    durations,
    intakes,
    intakeMonths,
    studyModes,
    campuses: [],
    scholarship,
    postStudyWork,
    englishTests,
    scores,
    statuses,
    tuitionMin: money('tuitionMin', 'minTuition'),
    tuitionMax: money('tuitionMax', 'maxTuition'),
    sort,
    page,
    limit,
    within,
    ignored,
  };
}

/**
 * The same request with only the filters its list is fixed to: the part
 * of the catalogue its counts and its summary are taken over.
 */
export function programmeScope(query: ProgrammeQuery): ProgrammeQuery {
  const kept = new Set(query.within);
  const keep = <T>(key: ProgrammeScopeKey, value: T[]): T[] =>
    kept.has(key) ? value : [];
  return {
    ...query,
    q: '',
    countries: keep('country', query.countries),
    universities: keep('university', query.universities),
    cities: keep('city', query.cities),
    courses: keep('course', query.courses),
    subjects: keep('subject', query.subjects),
    specializations: keep('specialization', query.specializations),
    levels: keep('level', query.levels),
    durations: [],
    intakes: [],
    intakeMonths: [],
    studyModes: [],
    scholarship: false,
    postStudyWork: false,
    englishTests: [],
    scores: {},
    statuses: [],
    tuitionMin: null,
    tuitionMax: null,
  };
}

/* An English test is one a requirement of that kind names: "IELTS
   Academic", "TOEFL iBT". A requirement filed as an English test that
   names none of them -- some records hold a placeholder title -- answers
   no test filter. */
const ENGLISH_TEST_CATEGORY = 'ENGLISH_TEST';
function testRequirements(row: OfferingLike, test: EnglishTest) {
  const named = new RegExp(`\\b${test}\\b`, 'i');
  return (row.requirements ?? []).filter(
    (requirement) =>
      requirement.category.trim().toUpperCase() === ENGLISH_TEST_CATEGORY &&
      named.test(requirement.title),
  );
}

/** Whether a programme lists a requirement for this test. */
export function listsEnglishTest(row: OfferingLike, test: EnglishTest) {
  return testRequirements(row, test).length > 0;
}

/**
 * Whether a student with this score meets a programme's listed minimum for
 * the test. A programme that lists no minimum for it is left out, as the
 * reference's fine print says: it cannot be shown to accept the score.
 */
export function englishScoreMatch(
  row: OfferingLike,
  test: EnglishTest,
  score: number,
) {
  return testRequirements(row, test).some((requirement) => {
    const minimum = number(requirement.minimumScore);
    return minimum !== null && minimum <= score;
  });
}

/**
 * Whether applications are open, from the deadlines recorded against the
 * programme's intakes and nothing else: "open" while one is still ahead,
 * "closed" once every recorded one has passed. A programme with no
 * recorded deadline is neither -- it may well be taking applications, and
 * saying either would be a guess.
 */
export function applicationStatus(
  row: OfferingLike,
  today = new Date(),
): ApplicationStatus | null {
  if (!(row.intakes ?? []).some((entry) => entry.deadline)) return null;
  return nextDeadline(row, today) ? 'open' : 'closed';
}

const countryOf = (row: ProgrammeRow) => row.university.country;

/** Whether one programme answers every filter in the request. */
export function matchesProgramme(
  row: ProgrammeRow,
  query: ProgrammeQuery,
  today = new Date(),
): boolean {
  if (!matchesCourseQuery(row, { ...query, intakes: [] })) return false;
  const country = countryOf(row);
  if (query.countries.length && !query.countries.includes(country?.slug ?? ''))
    return false;
  if (
    query.universities.length &&
    !query.universities.includes(row.university.slug)
  )
    return false;
  if (query.cities.length) {
    const city = courseCity(row);
    if (!city || !query.cities.includes(citySlug(city))) return false;
  }
  if (
    query.courses.length &&
    !query.courses.includes(row.genericCourse?.slug ?? '')
  )
    return false;
  if (query.intakes.length || query.intakeMonths.length) {
    const answers = (row.intakes ?? []).some(
      (entry) =>
        (entry.intake?.slug && query.intakes.includes(entry.intake.slug)) ||
        (entry.intake?.startMonth &&
          query.intakeMonths.includes(entry.intake.startMonth)),
    );
    if (!answers) return false;
  }
  if (query.postStudyWork && !country?.postStudyWork) return false;
  if (
    query.englishTests.length &&
    !query.englishTests.some((test) => listsEnglishTest(row, test))
  )
    return false;
  for (const test of ENGLISH_TESTS) {
    const score = query.scores[test.value];
    if (score !== undefined && !englishScoreMatch(row, test.value, score))
      return false;
  }
  if (query.statuses.length) {
    const status = applicationStatus(row, today);
    if (!status || !query.statuses.includes(status)) return false;
  }
  return true;
}

const byLabel = (a: FacetOption, b: FacetOption) =>
  a.label.localeCompare(b.label);

/**
 * Every choice the finder offers, each with how many programmes are behind
 * it. Taken over `rows` -- the whole live catalogue, or the part a list is
 * fixed to -- and not over the filtered result, so ticking one box does not
 * make every other option look empty. The University and City lists are
 * the exception the reference makes: they narrow to the countries chosen,
 * because a reader who picked the UK has no use for a list of Japanese
 * universities.
 */
export function programmeFacets(
  rows: ProgrammeRow[],
  query: ProgrammeQuery,
  today = new Date(),
) {
  /* The campus list is a university's own filter; across universities
     "Main campus" would be one option counting every institution. */
  const { campuses, ...base } = courseFacets(rows);
  void campuses;
  const local = query.countries.length
    ? rows.filter((row) => query.countries.includes(countryOf(row)?.slug ?? ''))
    : rows;

  const countries = tally<
    FacetOption & { iso2Code: string | null },
    ProgrammeRow
  >(rows, (row) => {
    const country = countryOf(row);
    return country
      ? [
          {
            value: country.slug,
            label: country.name,
            iso2Code: country.iso2Code ?? null,
          },
        ]
      : [];
  }).sort(byLabel);

  const universities = tally<
    FacetOption & { country: string | null },
    ProgrammeRow
  >(local, (row) => [
    {
      value: row.university.slug,
      label: row.university.name,
      country: countryOf(row)?.slug ?? null,
    },
  ]).sort(byLabel);

  const cities = tally<FacetOption & { country: string | null }, ProgrammeRow>(
    local,
    (row) => {
      const city = courseCity(row);
      const slug = city ? citySlug(city) : '';
      return city && slug
        ? [{ value: slug, label: city, country: countryOf(row)?.slug ?? null }]
        : [];
    },
  ).sort(byLabel);

  /* A course is chosen from its guide's "See all" link, never from the
     panel, so only the chosen ones are named: for their chips. */
  const courses = tally(rows, (row) => {
    const generic = row.genericCourse;
    return generic?.slug && query.courses.includes(generic.slug)
      ? [{ value: generic.slug, label: generic.name ?? generic.slug }]
      : [];
  }).sort(byLabel);

  const englishTests = ENGLISH_TESTS.flatMap((test) => {
    const count = rows.filter((row) =>
      listsEnglishTest(row, test.value),
    ).length;
    return count ? [{ value: test.value, label: test.value, count }] : [];
  });

  const statusCount = (wanted: ApplicationStatus) =>
    rows.filter((row) => applicationStatus(row, today) === wanted).length;
  const status = [
    { value: 'open', label: 'Upcoming deadline', count: statusCount('open') },
    {
      value: 'closed',
      label: 'All listed deadlines passed',
      count: statusCount('closed'),
    },
  ].filter((option) => option.count > 0);

  const extras = [
    {
      value: 'scholarship',
      label: 'With scholarships',
      count: rows.filter((row) => (row._count?.scholarships ?? 0) > 0).length,
    },
    {
      value: 'postStudyWork',
      label: 'Post-study work',
      count: rows.filter((row) => countryOf(row)?.postStudyWork).length,
    },
  ].filter((option) => option.count > 0);

  /* Fees compare only inside one country, so the range is offered there
     alone, in the currency its programmes record most. */
  let tuition: { currencyCode: string | null; count: number } | null = null;
  if (query.countries.length === 1) {
    const priced = local.filter(
      (row) =>
        number(row.tuitionMin) !== null || number(row.tuitionMax) !== null,
    );
    const currencies = tally(priced, (row) =>
      row.currencyCode
        ? [{ value: row.currencyCode, label: row.currencyCode }]
        : [],
    ).sort((a, b) => b.count - a.count);
    tuition = {
      currencyCode: currencies[0]?.value ?? null,
      count: priced.length,
    };
  }

  return {
    ...base,
    countries,
    universities,
    cities,
    courses,
    englishTests,
    status,
    extras,
    tuition,
  };
}

/**
 * The finder's headline figures -- programmes, universities, cities,
 * intake months and destinations -- over the catalogue the list is drawn
 * from. They describe what there is to search, so they stay put while the
 * reader filters; the filtered count is the result line's.
 */
export function programmeSummary(rows: ProgrammeRow[]) {
  const universities = new Set<string>();
  const cities = new Set<string>();
  const months = new Set<number>();
  const countries = new Set<string>();
  for (const row of rows) {
    universities.add(row.university.slug);
    const city = courseCity(row);
    if (city) cities.add(citySlug(city));
    const country = countryOf(row);
    if (country) countries.add(country.slug);
    for (const entry of row.intakes ?? []) {
      const month = entry.intake?.startMonth;
      if (month && month >= 1 && month <= 12) months.add(month);
    }
  }
  return {
    programmes: rows.length,
    universities: universities.size,
    cities: cities.size,
    intakeMonths: months.size,
    countries: countries.size,
  };
}
