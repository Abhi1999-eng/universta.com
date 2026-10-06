import { groupRequirements, teachingLanguage, type OfferingRequirement } from './offering-detail';
import { intakeRange } from './intake-range';
import {
  dateLabel,
  durationText,
  firstCity,
  humanise,
  place,
  programmeName,
  toCountry,
  tuitionText,
} from './university-courses';
import { universityInitials } from './university-initials';
import { offeringHref, universityHref } from './university-links';

/**
 * Programmes side by side, at /compare/courses.
 *
 * The design's comparison is twelve rows -- university, location, degree,
 * duration, tuition, language, intake, deadline, the three requirements and
 * the study mode -- with the lower tuition and the shorter duration marked
 * where the two can honestly be set against each other. This turns the
 * compare API's rows into those columns, here rather than in the page, so
 * the same reading is tested once and nothing that only runs on a server
 * is needed to do it.
 *
 * Every cell says what the record holds and nothing more. Where it is
 * silent, the cell says "Not listed", or, for the requirements the design
 * sends to the university, "Check official source", linked to the course's
 * own page when the record has one.
 */

/** Both references stop at four. */
export const COMPARE_LIMIT = 4;

const NOT_LISTED = 'Not listed';
const OFFICIAL = 'Check official source';

type Row = Record<string, unknown>;
const record = (value: unknown): Row | null =>
  value && typeof value === 'object' ? (value as Row) : null;
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const amount = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

/**
 * The programmes an address asks for. `items` is this site's name for the
 * list and `ids` the behaviour reference's, so a link written for either
 * opens the same comparison. Repeats are dropped and the list stops at four.
 */
export function readCompareSlugs(
  params: Record<string, string | string[] | undefined>,
): string[] {
  const values = ['items', 'ids'].flatMap((key) => {
    const raw = params[key];
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((entry) =>
      entry.split(','),
    );
  });
  const seen = new Set<string>();
  for (const value of values) {
    const slug = value.trim().toLowerCase();
    if (slug) seen.add(slug);
  }
  return [...seen].slice(0, COMPARE_LIMIT);
}

/** The comparison of these programmes, in one canonical spelling. */
export function compareHref(slugs: string[]) {
  return slugs.length
    ? `/compare/courses?items=${slugs.join(',')}`
    : '/compare/courses';
}

/** The same comparison with one programme taken out and the rest kept. */
export function withoutSlug(slugs: string[], slug: string) {
  return compareHref(slugs.filter((entry) => entry !== slug));
}

export type CompareCell = {
  value: string;
  note?: string | null;
  /** The record is silent: the cell reads as an absence. */
  missing?: boolean;
  href?: string | null;
  /** The link leaves the site, to the university's own page. */
  external?: boolean;
};

export type CompareColumn = {
  slug: string;
  name: string;
  /** The programme's page, or null when the row cannot say which country
   *  the university is filed under and so where its page is. */
  href: string | null;
  initials: string;
  /** What the programme is filed under, under its name in the head. */
  meta: string | null;
  university: string;
  cells: Record<CompareRowKey, CompareCell>;
  /** The figures the marks are worked out from; null where unknown. */
  tuition: { figure: number; currency: string; period: string } | null;
  durationMonths: number | null;
};

export const COMPARE_ROWS = [
  { key: 'university', label: 'University' },
  { key: 'location', label: 'Location' },
  { key: 'degree', label: 'Degree' },
  { key: 'duration', label: 'Duration' },
  { key: 'tuition', label: 'Tuition' },
  { key: 'language', label: 'Language' },
  { key: 'intake', label: 'Intake' },
  { key: 'deadline', label: 'Application deadline' },
  { key: 'academic', label: 'Academic requirement' },
  { key: 'languageRequirement', label: 'Language requirement' },
  { key: 'work', label: 'Work experience' },
  { key: 'studyMode', label: 'Study mode' },
] as const;

export type CompareRowKey = (typeof COMPARE_ROWS)[number]['key'];

/* Only what is in force: an older API sent withdrawn and deleted entries
   along with the live ones. */
const live = (entry: Row) =>
  (!text(entry.status) || entry.status === 'ACTIVE') && !entry.deletedAt;

function requirements(raw: unknown): OfferingRequirement[] {
  return (Array.isArray(raw) ? raw : []).flatMap((entry) => {
    const row = record(entry);
    const title = text(row?.title);
    if (!row || !title || !live(row)) return [];
    const score = amount(row.minimumScore);
    return [
      {
        category: text(row.category) ?? 'OTHER',
        title,
        description: text(row.description),
        minimumScore: score === null ? null : String(score),
      },
    ];
  });
}

/** "IELTS 6.5 minimum", with what the course says about it underneath. */
function stated(list: OfferingRequirement[], score: (entry: OfferingRequirement) => string) {
  return {
    value: list.map(score).join(' · '),
    note: list
      .map((entry) => entry.description)
      .filter(Boolean)
      .join(' ') || null,
  };
}

const MONTHS_PER: Record<string, number> = { YEAR: 12, MONTH: 1, WEEK: 12 / 52 };

/** The longest the programme can run, in months, read from the same
 *  figures as the duration it prints; null when the unit is not one that
 *  converts (a semester is not the same length everywhere). */
function months(row: Row): number | null {
  const own = amount(row.durationMin) ?? amount(row.durationMax);
  const source = own !== null ? row : (record(row.genericCourse) ?? {});
  const high = amount(source.durationMax) ?? amount(source.durationMin);
  const unit = text(source.durationUnit)?.toUpperCase().replace(/S$/, '');
  const factor = unit ? MONTHS_PER[unit] : undefined;
  return high && high > 0 && factor ? high * factor : null;
}

/** The upper fee, with what it is counted in. */
function fee(row: Row) {
  const figure = amount(row.tuitionMax) ?? amount(row.tuitionMin);
  const currency = text(row.currencyCode);
  const period = text(row.tuitionPeriod);
  return figure && figure > 0 && currency && period
    ? { figure, currency, period }
    : null;
}

/**
 * One compare API row as a column. A row the API could not file under a
 * country still compares; it just has no page to link its name to.
 */
export function toCompareColumn(raw: unknown, today = new Date()): CompareColumn | null {
  const row = record(raw);
  const slug = text(row?.slug);
  const fullName = text(row?.name);
  if (!row || !slug || !fullName) return null;
  const universityRow = record(row.university) ?? {};
  const universityName = text(universityRow.name) ?? NOT_LISTED;
  const universitySlug = text(universityRow.slug);
  const country = toCountry(universityRow.country);
  const generic = record(row.genericCourse) ?? {};
  const level = record(row.courseLevel) ?? record(generic.courseLevel);
  const subject = record(generic.subSubject) ?? record(generic.subject);
  const campus = record(row.campus);
  const name = programmeName(fullName, text(universityRow.name));

  /* The course's own page first, then the university's site. */
  const official =
    text(row.sourceReference) ?? text(row.applicationUrl) ?? text(universityRow.websiteUrl);
  const silent = (value: string): CompareCell =>
    value === OFFICIAL && official
      ? { value, missing: true, href: official, external: true }
      : { value, missing: true };

  const intakes = (Array.isArray(row.intakes) ? row.intakes : [])
    .map(record)
    .filter((entry): entry is Row => Boolean(entry) && live(entry!));
  const intakeLabels = [
    ...new Set(
      intakes.flatMap((entry) => {
        const intake = record(entry.intake);
        return intake
          ? [
              intakeRange({
                startMonth: intake.startMonth as number | null,
                endMonth: intake.endMonth as number | null,
                shortLabel: text(intake.shortLabel),
                name: text(intake.name),
              }),
            ]
          : [];
      }),
    ),
  ];
  /* The next deadline still to come; failing that, the last one recorded,
     marked as passed -- the course page reads it the same way. */
  const floor = today.toISOString().slice(0, 10);
  const deadlines = intakes
    .map((entry) => text(entry.deadline)?.slice(0, 10) ?? null)
    .filter((value): value is string => Boolean(value))
    .sort();
  const upcoming = deadlines.find((value) => value >= floor) ?? null;
  const lastPassed = deadlines.at(-1) ?? null;

  const listed = requirements(row.requirements);
  const grouped = groupRequirements(listed);
  const work = grouped.other.filter((entry) => /WORK/.test(entry.category.toUpperCase()));
  const language = teachingLanguage(listed);
  const academic = stated(grouped.academic, (entry) =>
    entry.minimumScore ? `${entry.title} (minimum ${entry.minimumScore})` : entry.title,
  );
  const english = stated(grouped.language, (entry) =>
    entry.minimumScore ? `${entry.title} ${entry.minimumScore} minimum` : entry.title,
  );
  const experience = stated(work, (entry) =>
    entry.minimumScore ? `${entry.title} (${entry.minimumScore})` : entry.title,
  );

  const location = place(text(campus?.city) ?? firstCity(universityRow), country);
  const degree = [text(level?.name), text(generic.qualificationName)]
    .filter(Boolean)
    .join(' · ');
  const duration = durationText(row);
  const tuition = tuitionText(row);
  const studyMode = text(row.studyMode);

  return {
    slug,
    name,
    href: country && universitySlug ? offeringHref(country.slug, universitySlug, slug) : null,
    initials: universityInitials(universityName),
    meta: text(subject?.name) ?? text(level?.name),
    university: universityName,
    cells: {
      university: universitySlug
        ? { value: universityName, href: universityHref(universitySlug) }
        : silent(universityName),
      location: location ? { value: location } : silent(NOT_LISTED),
      degree: degree ? { value: degree } : silent(NOT_LISTED),
      duration: duration ? { value: duration } : silent(NOT_LISTED),
      tuition: tuition ? { value: tuition } : silent(NOT_LISTED),
      language: language ? { value: language.value, note: language.note } : silent(NOT_LISTED),
      intake: intakeLabels.length ? { value: intakeLabels.join(' · ') } : silent(NOT_LISTED),
      deadline: upcoming
        ? { value: dateLabel(upcoming)! }
        : lastPassed
          ? { value: `${dateLabel(lastPassed)} (passed)` }
          : silent(NOT_LISTED),
      academic: grouped.academic.length ? academic : silent(OFFICIAL),
      languageRequirement: grouped.language.length ? english : silent(NOT_LISTED),
      work: work.length ? experience : silent(OFFICIAL),
      studyMode: studyMode ? { value: humanise(studyMode) } : silent(NOT_LISTED),
    },
    tuition: fee(row),
    durationMonths: months(row),
  };
}

/**
 * Which column, if any, to mark in a row: the one lowest figure, and only
 * when every column has a figure and no two share the lowest. Tuition is
 * marked only when every fee is counted in the same currency over the same
 * period; there is no conversion here, so a pound and a euro are not set
 * against each other.
 */
export function compareMarks(columns: CompareColumn[]): Partial<Record<CompareRowKey, number>> {
  const lowest = (values: Array<number | null>) => {
    if (columns.length < 2 || values.some((value) => value === null)) return undefined;
    const known = values as number[];
    const min = Math.min(...known);
    return known.filter((value) => value === min).length === 1
      ? known.indexOf(min)
      : undefined;
  };
  const fees = columns.map((column) => column.tuition);
  const comparable =
    fees.every(Boolean) &&
    new Set(fees.map((entry) => `${entry!.currency}/${entry!.period}`)).size === 1;
  const marks: Partial<Record<CompareRowKey, number>> = {};
  const tuition = comparable ? lowest(fees.map((entry) => entry!.figure)) : undefined;
  const duration = lowest(columns.map((column) => column.durationMonths));
  if (tuition !== undefined) marks.tuition = tuition;
  if (duration !== undefined) marks.duration = duration;
  return marks;
}

/**
 * An option in the "Add a course…" list: the programme and where it is
 * taught, when the API names the university.
 */
export type CompareOption = { slug: string; label: string };

export function toCompareOptions(raw: unknown): CompareOption[] {
  return (Array.isArray(raw) ? raw : []).flatMap((entry) => {
    const row = record(entry);
    const slug = text(row?.slug);
    const name = text(row?.name);
    if (!row || !slug || !name) return [];
    const university =
      text(record(row.university)?.name) ?? text(row.university) ?? text(row.universityName);
    const country =
      text(record(record(row.university)?.country)?.name) ?? text(row.countryName);
    return [
      {
        slug,
        label: university
          ? `${programmeName(name, university)} — ${[university, country].filter(Boolean).join(', ')}`
          : name,
      },
    ];
  });
}
