import type { Course, CourseLevelGroup } from '@/lib/catalog';
import { formatNumber } from '@/lib/format';

/**
 * What the "courses by level" block needs worked out before it draws
 * anything: where a level's section is on the page, where its full list
 * is, and what one course says about itself in a single line.
 */

/** How many courses a level shows before the rest fold away. Ten, because
 * that is a level a reader can take in; the rest are one press further. */
export const LEVEL_ROWS_SHOWN = 10;
/** How many the page asks the catalogue for, per level. Past this the
 * section ends in a link to the course list filtered to that level. */
export const LEVEL_ROWS_FETCHED = 30;

/** The section's address on the page: "UG" -> "level-ug". */
export function levelAnchor(code: string) {
  return `level-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/**
 * The course list, filtered to what this section counted.
 *
 * A level's count is of course guides -- the catalogue's generic courses --
 * and the finder opens on programmes, a course as one university teaches it,
 * which number differently. So the link opens the guides view, where the
 * list is the size the section said it was. The specialization is written
 * as the finder spells it; its old name is still read.
 */
export function levelCoursesHref({
  subject,
  subSubject,
  country,
  level,
}: {
  subject: string;
  subSubject?: string;
  country?: string;
  level?: string;
}) {
  const query = new URLSearchParams({
    ...(country ? { country } : {}),
    subject,
    ...(subSubject ? { specialization: subSubject } : {}),
    ...(level ? { level } : {}),
    view: 'guides',
  });
  return `/courses?${query.toString()}`;
}

/**
 * The finder's programmes, narrowed to what a page is about: a course, a
 * subject or one of its specializations, in a destination or everywhere.
 * For a link that prints no count, or a programme count read from the same
 * query, so the list it opens is the one it describes. Without a subject
 * a specialization's slug is not unique, so the two travel together.
 */
export function programmesHref(
  {
    country,
    course,
    subject,
    specialization,
  }: {
    country?: string;
    course?: string;
    subject?: string;
    specialization?: string;
  },
  anchor = '',
) {
  const query = new URLSearchParams({
    ...(course ? { course } : {}),
    ...(country ? { country } : {}),
    ...(subject ? { subject } : {}),
    ...(subject && specialization ? { specialization } : {}),
  }).toString();
  return `/courses${query ? `?${query}` : ''}${anchor}`;
}

/** "3 years", "3–5 years", or nothing when no length is recorded. */
export function durationLabel(course: Pick<Course, 'duration'>) {
  const span = [course.duration?.min, course.duration?.max]
    .filter(Boolean)
    .map((value) => String(Number(value)));
  if (!span.length) return null;
  const amount = span[0] === span[span.length - 1] ? span[0] : span.join('–');
  /* The catalogue stores the unit as a plural -- YEARS, MONTHS -- and a
     one-year course read "1 years". */
  const plural = course.duration?.unit?.toLowerCase() ?? '';
  const unit = amount === '1' ? plural.replace(/s$/, '') : plural;
  return `${amount}${unit ? ` ${unit}` : ''}`;
}

/**
 * The quiet middle of a row: which branch of the subject the course belongs
 * to, how long it runs and how it is taught. Only what is recorded.
 */
export function courseRowMeta(
  course: Pick<Course, 'subSubject' | 'duration' | 'studyModes'>,
  { branch = true }: { branch?: boolean } = {},
) {
  return [
    branch ? course.subSubject?.name : null,
    durationLabel(course),
    course.studyModes?.map((mode) => mode.name).join(' / ') || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The figure at the end of a row. In a destination it is what that
 * destination charges; outside one it is how many destinations teach the
 * course. Nothing when neither is recorded -- never a guess.
 */
export function courseRowFigure(
  course: Pick<Course, 'selectedTuition' | 'availableCountryCount'>,
) {
  const tuition = course.selectedTuition;
  if (tuition?.min) {
    const low = formatNumber(tuition.min);
    const high = tuition.max ? formatNumber(tuition.max) : '';
    const amount = high && high !== low ? `${low}–${high}` : low;
    if (amount) return [tuition.currencyCode, amount].filter(Boolean).join(' ');
  }
  if (tuition) return null;
  const count = course.availableCountryCount;
  if (!count) return null;
  return `${count} ${count === 1 ? 'destination' : 'destinations'}`;
}

/** The whole of a subject's count, across the levels shown. */
export function levelTotal(groups: CourseLevelGroup[]) {
  return groups.reduce((sum, group) => sum + group.count, 0);
}

/**
 * The levels a subject's or a specialization's page always shows, listed or
 * not: the six the client named -- Foundation, Pathway, Bachelor's,
 * Master's, MBA and PhD. Their names and order are the catalogue's own
 * (Admin, Course levels); this only says which of its levels are always
 * there. Any other level, a diploma say, shows where something is listed
 * at it.
 *
 * The block used to draw only the levels with courses, so on a catalogue
 * with none yet the pages had no levels at all, and the client read that
 * as the levels missing.
 */
export const LEVELS_ALWAYS_SHOWN: readonly string[] = [
  'FOUNDATION',
  'PATHWAY',
  'UG',
  'PG',
  'MBA',
  'PHD',
];

export type CatalogueLevel = {
  id: string;
  code: string;
  name: string;
  educationOrder?: number | null;
  displayOrder?: number | null;
};

/**
 * The catalogue's level groups, with an empty group for each always-shown
 * level it sent none for, in the order a student climbs them.
 *
 * Null while the grouped read failed: the page does not know what is listed
 * and keeps its fallback rather than drawing every level empty. Without the
 * list of levels, the groups are returned as they came.
 */
export function everyLevel(
  groups: CourseLevelGroup[] | null,
  levels: readonly CatalogueLevel[] | null,
): CourseLevelGroup[] | null {
  if (!groups) return null;
  if (!levels?.length) return groups;
  const byCode = new Map(groups.map((group) => [group.level.code, group]));
  const rank = (level: CatalogueLevel, index: number) =>
    level.educationOrder ?? level.displayOrder ?? 1000 + index;
  const ordered = levels
    .map((level, index) => ({ level, at: rank(level, index) }))
    .sort((left, right) => left.at - right.at)
    .map(({ level }) => level);
  const known = new Set(ordered.map((level) => level.code));
  return [
    ...ordered.flatMap((level): CourseLevelGroup[] => {
      const group = byCode.get(level.code);
      if (group) return [group];
      if (!LEVELS_ALWAYS_SHOWN.includes(level.code)) return [];
      return [
        {
          level: {
            id: level.id,
            code: level.code,
            name: level.name,
            educationOrder: level.educationOrder ?? 0,
          },
          count: 0,
          courses: [],
        },
      ];
    }),
    /* A group for a level missing from the list still shows, last. */
    ...groups.filter((group) => !known.has(group.level.code)),
  ];
}
