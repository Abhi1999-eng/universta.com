/**
 * One university's courses: what can narrow the list, how many courses each
 * choice holds, and the order the list comes in.
 *
 * The behaviour reference files a university's courses on a page of their
 * own -- a search box, study level, discipline, specialization, duration,
 * intake and study mode, each option with its count, and a sort -- and every
 * count there is taken over all of the university's courses, not over the
 * page being shown. The list used to offer three of those filters, counted
 * its options in the browser from at most fifty rows, and ordered by the
 * editor's display order. So the whole published catalogue of one university
 * is read once, counted once, and filtered and ordered here, where the
 * counts and the filters cannot disagree about what a course is.
 *
 * Kept free of Prisma and Nest so the rules can be tested as plain data.
 */

type Numeric = { toString(): string } | string | number | null | undefined;

/**
 * How many of one university's courses a read takes. The list counts its
 * filters over the whole catalogue and a course page promises "View all N",
 * so this is a safety net well above any real university's catalogue, not a
 * page size: the 500 the reads used to borrow is a number the largest
 * universities pass, and past it the counts covered whichever 500 rows the
 * database returned first.
 */
export const UNIVERSITY_CATALOGUE_CAP = 5000;

/**
 * How many rows a course page reads for each kind of neighbour it shows six
 * of: enough to fill the six after any row without a public address drops.
 */
export const NEIGHBOUR_TAKE = 12;

export type LevelLike = {
  code: string;
  name: string;
  educationOrder?: number | null;
};

export type IntakeLike = {
  name: string;
  slug: string;
  startMonth?: number | null;
  endMonth?: number | null;
  shortLabel?: string | null;
};

export type NamedLike = { name: string; slug: string };

export type OfferingLike = {
  name: string;
  slug: string;
  courseCode?: string | null;
  studyMode?: string | null;
  durationMin?: Numeric;
  durationMax?: Numeric;
  durationUnit?: string | null;
  tuitionMin?: Numeric;
  tuitionMax?: Numeric;
  courseLevel?: LevelLike | null;
  campus?: (NamedLike & { city?: string | null }) | null;
  genericCourse?: {
    name?: string | null;
    shortName?: string | null;
    qualificationName?: string | null;
    durationMin?: Numeric;
    durationMax?: Numeric;
    durationUnit?: string | null;
    subject?: NamedLike | null;
    subSubject?: NamedLike | null;
    courseLevel?: LevelLike | null;
  } | null;
  intakes?: Array<{
    deadline?: Date | string | null;
    intake?: IntakeLike | null;
  }>;
  _count?: { scholarships?: number };
};

type Query = Record<string, string | string[] | undefined>;

export type CourseSort = 'relevance' | 'name' | 'fee' | 'deadline' | 'duration';
const SORTS: readonly CourseSort[] = [
  'relevance',
  'name',
  'fee',
  'deadline',
  'duration',
];

/**
 * The reference's three duration choices, by the values its URLs carry:
 * up to a year, one to two years, more than two.
 */
export const DURATION_BANDS = [
  { value: '12', label: 'Up to 1 year' },
  { value: '24', label: '1–2 years' },
  { value: '25', label: 'More than 2 years' },
] as const;

export type CourseQuery = {
  q: string;
  levels: string[];
  subjects: string[];
  specializations: string[];
  durations: string[];
  intakes: string[];
  studyModes: string[];
  campuses: string[];
  scholarship: boolean;
  tuitionMin: number | null;
  tuitionMax: number | null;
  sort: CourseSort;
};

export type FacetOption = { value: string; label: string; count: number };

const number = (value: Numeric): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

/** "accounting, finance" and ?subject=a&subject=b both mean two subjects. */
function values(query: Query, ...keys: string[]): string[] {
  const seen = new Set<string>();
  for (const key of keys) {
    const raw = query[key];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const entry of list)
      for (const part of String(entry).split(','))
        if (part.trim()) seen.add(part.trim());
  }
  return [...seen];
}

const fold = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * The filters a request asks for. The older names stay readable --
 * `courseLevel`, `subSubject` -- because links written before the list was
 * rebuilt still carry them.
 */
export function parseCourseQuery(query: Query): CourseQuery {
  const first = (key: string) => {
    const raw = query[key];
    return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  };
  const sort = first('sort') as CourseSort;
  const money = (key: string) => {
    const raw = first(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    q: first('q').slice(0, 100),
    levels: values(query, 'level', 'courseLevel'),
    subjects: values(query, 'subject'),
    specializations: values(query, 'specialization', 'subSubject'),
    durations: values(query, 'duration').filter((value) =>
      DURATION_BANDS.some((band) => band.value === value),
    ),
    intakes: values(query, 'intake'),
    studyModes: values(query, 'studyMode'),
    campuses: values(query, 'campus'),
    scholarship:
      first('scholarshipAvailable') === 'true' ||
      first('scholarship') === 'true',
    tuitionMin: money('tuitionMin'),
    tuitionMax: money('tuitionMax'),
    sort: SORTS.includes(sort) ? sort : 'relevance',
  };
}

/**
 * The level a course is taught at: the offering's own, which an editor can
 * set per university, or the level of the course it is an instance of.
 */
export function effectiveLevel(row: OfferingLike): LevelLike | null {
  return row.courseLevel ?? row.genericCourse?.courseLevel ?? null;
}

const MONTHS_PER: Record<string, number> = {
  YEAR: 12,
  YEARS: 12,
  SEMESTER: 6,
  SEMESTERS: 6,
  TERM: 4,
  TERMS: 4,
  MONTH: 1,
  MONTHS: 1,
  WEEK: 12 / 52,
  WEEKS: 12 / 52,
  DAY: 12 / 365,
  DAYS: 12 / 365,
};

/**
 * How long a course runs, in months, as a range.
 *
 * The offering's own figures where it states them, the generic course's
 * otherwise -- the same reading the university page takes: a university that
 * has not stated its duration still teaches the programme the catalogue
 * describes. A figure with no unit is not guessed at.
 */
export function durationMonths(
  row: OfferingLike,
): { low: number; high: number } | null {
  const own = number(row.durationMin) ?? number(row.durationMax);
  const source =
    own !== null
      ? {
          min: row.durationMin,
          max: row.durationMax,
          unit: row.durationUnit,
        }
      : {
          min: row.genericCourse?.durationMin,
          max: row.genericCourse?.durationMax,
          unit: row.genericCourse?.durationUnit,
        };
  const factor = MONTHS_PER[(source.unit ?? '').trim().toUpperCase()];
  const min = number(source.min);
  const max = number(source.max);
  if (!factor || (min === null && max === null)) return null;
  const low = (min ?? max)! * factor;
  const high = (max ?? min)! * factor;
  return { low: Math.min(low, high), high: Math.max(low, high) };
}

/**
 * The duration choices a course answers to. A course of one to two years is
 * both a course you can finish within a year and a one-to-two-year course,
 * so it is counted under each band its range touches rather than forced
 * into one of them.
 */
export function durationBands(row: OfferingLike): string[] {
  const span = durationMonths(row);
  if (!span) return [];
  const bands: string[] = [];
  if (span.low <= 12) bands.push('12');
  if (span.low <= 24 && span.high > 12) bands.push('24');
  if (span.high > 24) bands.push('25');
  return bands;
}

const day = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

/** The earliest deadline that has not passed, or null when none is ahead. */
export function nextDeadline(
  row: OfferingLike,
  today = new Date(),
): Date | null {
  const floor = day(today)!;
  let best: number | null = null;
  for (const entry of row.intakes ?? []) {
    if (!entry.deadline) continue;
    const when = day(entry.deadline);
    if (when === null || when < floor) continue;
    if (best === null || when < best) best = when;
  }
  return best === null ? null : new Date(best);
}

function searchable(row: OfferingLike) {
  const generic = row.genericCourse;
  return fold(
    [
      row.name,
      row.courseCode,
      generic?.name,
      generic?.shortName,
      generic?.qualificationName,
      generic?.subject?.name,
      generic?.subSubject?.name,
      effectiveLevel(row)?.name,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/** Whether one course answers every filter in the request. */
export function matchesCourseQuery(row: OfferingLike, query: CourseQuery) {
  if (query.q) {
    const haystack = searchable(row);
    const words = fold(query.q).split(/\s+/).filter(Boolean);
    if (!words.every((word) => haystack.includes(word))) return false;
  }
  const level = effectiveLevel(row);
  if (query.levels.length && !query.levels.includes(level?.code ?? ''))
    return false;
  const generic = row.genericCourse;
  if (
    query.subjects.length &&
    !query.subjects.includes(generic?.subject?.slug ?? '')
  )
    return false;
  if (
    query.specializations.length &&
    !query.specializations.includes(generic?.subSubject?.slug ?? '')
  )
    return false;
  if (query.durations.length) {
    const bands = durationBands(row);
    if (!query.durations.some((band) => bands.includes(band))) return false;
  }
  if (query.intakes.length) {
    const slugs = (row.intakes ?? []).map((entry) => entry.intake?.slug);
    if (!query.intakes.some((slug) => slugs.includes(slug))) return false;
  }
  if (
    query.studyModes.length &&
    !query.studyModes.includes(row.studyMode ?? '')
  )
    return false;
  if (query.campuses.length && !query.campuses.includes(row.campus?.slug ?? ''))
    return false;
  if (query.scholarship && !(row._count?.scholarships ?? 0)) return false;
  /* The tuition bounds read as they always have: a course with no stated
     fee is not excluded by a bound it cannot be measured against. */
  if (query.tuitionMin !== null) {
    const max = number(row.tuitionMax);
    if (max !== null && max < query.tuitionMin) return false;
  }
  if (query.tuitionMax !== null) {
    const min = number(row.tuitionMin);
    if (min !== null && min > query.tuitionMax) return false;
  }
  return true;
}

const byName = (a: OfferingLike, b: OfferingLike) =>
  a.name.localeCompare(b.name);

/** Unmeasured goes last, not first: a missing fee is not a low one. */
function nullsLast(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * The list's order. Relevance is the reference's default: by study level in
 * academic order, Bachelor's before Master's, then by name -- a student
 * reads a prospectus by the level they are applying at.
 */
export function sortOfferings<T extends OfferingLike>(
  rows: T[],
  sort: CourseSort,
  today = new Date(),
): T[] {
  const sorted = [...rows];
  const levelOrder = (row: T) => {
    const level = effectiveLevel(row);
    return level ? (level.educationOrder ?? 0) : null;
  };
  switch (sort) {
    case 'name':
      return sorted.sort(byName);
    case 'fee':
      return sorted.sort(
        (a, b) =>
          nullsLast(
            number(a.tuitionMin) ?? number(a.tuitionMax),
            number(b.tuitionMin) ?? number(b.tuitionMax),
          ) || byName(a, b),
      );
    case 'deadline':
      return sorted.sort(
        (a, b) =>
          nullsLast(
            nextDeadline(a, today)?.getTime() ?? null,
            nextDeadline(b, today)?.getTime() ?? null,
          ) || byName(a, b),
      );
    case 'duration':
      return sorted.sort(
        (a, b) =>
          nullsLast(
            durationMonths(a)?.low ?? null,
            durationMonths(b)?.low ?? null,
          ) || byName(a, b),
      );
    default:
      return sorted.sort(
        (a, b) => nullsLast(levelOrder(a), levelOrder(b)) || byName(a, b),
      );
  }
}

const humanise = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

function tally<E extends FacetOption>(
  rows: OfferingLike[],
  pick: (row: OfferingLike) => Array<Omit<E, 'count'>>,
): E[] {
  const map = new Map<string, E>();
  for (const row of rows)
    for (const option of pick(row)) {
      const existing = map.get(option.value);
      if (existing) existing.count += 1;
      else map.set(option.value, { ...option, count: 1 } as E);
    }
  return [...map.values()];
}

const mostFirst = (a: FacetOption, b: FacetOption) =>
  b.count - a.count || a.label.localeCompare(b.label);

/**
 * Every choice the list can offer, each with the number of courses behind
 * it, taken over the university's whole published catalogue. Built from the
 * courses themselves, so no choice ever leads to an empty list on its own.
 */
export function courseFacets(rows: OfferingLike[]) {
  const levels = tally<FacetOption & { order: number }>(rows, (row) => {
    const level = effectiveLevel(row);
    return level
      ? [
          {
            value: level.code,
            label: level.name,
            order: level.educationOrder ?? 0,
          },
        ]
      : [];
  }).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  const subjects = tally(rows, (row) => {
    const subject = row.genericCourse?.subject;
    return subject ? [{ value: subject.slug, label: subject.name }] : [];
  }).sort(mostFirst);

  const specializations = tally<FacetOption & { subject: string | null }>(
    rows,
    (row) => {
      const branch = row.genericCourse?.subSubject;
      return branch
        ? [
            {
              value: branch.slug,
              label: branch.name,
              subject: row.genericCourse?.subject?.slug ?? null,
            },
          ]
        : [];
    },
  ).sort(mostFirst);

  const bandCounts = tally(rows, (row) =>
    durationBands(row).map((value) => ({
      value,
      label: DURATION_BANDS.find((band) => band.value === value)!.label,
    })),
  );
  const durations = DURATION_BANDS.flatMap(
    (band) => bandCounts.find((option) => option.value === band.value) ?? [],
  );

  const intakes = tally<
    FacetOption & {
      startMonth: number | null;
      endMonth: number | null;
      shortLabel: string | null;
    }
  >(rows, (row) => {
    const seen = new Set<string>();
    return (row.intakes ?? []).flatMap((entry) => {
      const intake = entry.intake;
      if (!intake || seen.has(intake.slug)) return [];
      seen.add(intake.slug);
      return [
        {
          value: intake.slug,
          label: intake.name,
          startMonth: intake.startMonth ?? null,
          endMonth: intake.endMonth ?? null,
          shortLabel: intake.shortLabel ?? null,
        },
      ];
    });
  }).sort(
    (a, b) =>
      nullsLast(a.startMonth, b.startMonth) || a.label.localeCompare(b.label),
  );

  const studyModes = tally(rows, (row) =>
    row.studyMode
      ? [{ value: row.studyMode, label: humanise(row.studyMode) }]
      : [],
  ).sort(mostFirst);

  const campuses = tally<FacetOption & { city: string | null }>(rows, (row) =>
    row.campus
      ? [
          {
            value: row.campus.slug,
            label: row.campus.name,
            city: row.campus.city ?? null,
          },
        ]
      : [],
  ).sort(mostFirst);

  return {
    levels,
    subjects,
    specializations,
    durations,
    intakes,
    studyModes,
    campuses,
  };
}

/**
 * The university-wide intakes panel: each intake with the deadlines its
 * courses record, earliest first, and how many courses carry each.
 */
export function courseDeadlines(rows: OfferingLike[]) {
  const map = new Map<
    string,
    { intake: IntakeLike; deadline: string | null; count: number }
  >();
  for (const row of rows)
    for (const entry of row.intakes ?? []) {
      if (!entry.intake) continue;
      const deadline = entry.deadline
        ? new Date(entry.deadline).toISOString().slice(0, 10)
        : null;
      const key = `${entry.intake.slug}|${deadline ?? ''}`;
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { intake: entry.intake, deadline, count: 1 });
    }
  return [...map.values()].sort(
    (a, b) =>
      nullsLast(a.intake.startMonth ?? null, b.intake.startMonth ?? null) ||
      (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'),
  );
}

/**
 * The courses a course page suggests next: the same subject at the same
 * university first -- the same specialization at the top of those -- then
 * the same subject at other universities. The same course at other
 * universities has a section of its own on the page, so whatever that
 * section already shows is passed in `shown` and not offered twice; nor is
 * the course itself.
 */
export function relatedOfferings<T extends OfferingLike>(
  current: OfferingLike,
  groups: { here: T[]; elsewhere: T[] },
  shown: Iterable<string> = [],
  limit = 6,
): T[] {
  const subject = current.genericCourse?.subject?.slug;
  const branch = current.genericCourse?.subSubject?.slug;
  const sameBranch = (row: T) =>
    Number(Boolean(branch) && row.genericCourse?.subSubject?.slug === branch);
  const here = subject
    ? sortOfferings(
        groups.here.filter(
          (row) => row.genericCourse?.subject?.slug === subject,
        ),
        'relevance',
      ).sort((a, b) => sameBranch(b) - sameBranch(a))
    : [];
  const seen = new Set<string>([current.slug, ...shown]);
  const out: T[] = [];
  for (const row of [...here, ...groups.elsewhere]) {
    if (out.length >= limit) break;
    if (seen.has(row.slug)) continue;
    seen.add(row.slug);
    out.push(row);
  }
  return out;
}
