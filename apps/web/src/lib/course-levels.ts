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

type LevelRef = { id: string; name: string; code: string | null };

/** The catalogue's levels in the order a student climbs them. */
export function climbingOrder<T extends CatalogueLevel>(levels: readonly T[]): T[] {
  const rank = (level: T, index: number) =>
    level.educationOrder ?? level.displayOrder ?? 1000 + index;
  return levels
    .map((level, index) => ({ level, at: rank(level, index) }))
    .sort((left, right) => left.at - right.at)
    .map(({ level }) => level);
}

/**
 * The levels a subject is offered at, for the pages that show them.
 *
 * What an editor ticked on the subject is the answer. Where nothing is
 * ticked, the levels its specializations are offered at stand in: a subject
 * whose AI branch is ticked for Master's and PhD is offered at those. Empty
 * only when neither says anything, and the page then shows the six levels
 * the client named (see `LEVELS_ALWAYS_SHOWN`).
 */
export function subjectOfferedLevels(subject: {
  offeredLevels?: readonly LevelRef[] | null;
  subSubjects?: ReadonlyArray<{ levels?: readonly LevelRef[] | null }> | null;
}): LevelRef[] {
  if (subject.offeredLevels?.length) return [...subject.offeredLevels];
  const seen = new Map<string, LevelRef>();
  for (const branch of subject.subSubjects ?? [])
    for (const level of branch.levels ?? [])
      if (level.code && !seen.has(level.code)) seen.set(level.code, level);
  return [...seen.values()];
}

/**
 * The levels a specialization is offered at: its own ticks; with none, the
 * levels its published courses are at (its `levels`, which then hold only
 * those), as its card on the subject's page says; and with neither, its
 * subject's ticks. Empty when none of them says.
 */
export function specializationOfferedLevels(specialization: {
  offeredLevels?: readonly LevelRef[] | null;
  levels?: readonly LevelRef[] | null;
  subject?: { offeredLevels?: readonly LevelRef[] | null } | null;
}): LevelRef[] {
  if (specialization.offeredLevels?.length) return [...specialization.offeredLevels];
  if (specialization.levels?.length) return [...specialization.levels];
  return [...(specialization.subject?.offeredLevels ?? [])];
}

/**
 * The catalogue's levels a level bar offers, in climbing order: the ones
 * offered (the six named levels when none is), any with something listed
 * at it, and the one being read.
 */
export function levelsOnBar(
  levels: readonly CatalogueLevel[],
  offered: ReadonlyArray<{ code: string | null }>,
  listed: ReadonlyArray<string | null> = [],
): CatalogueLevel[] {
  const ticked = offered.flatMap((level) => (level.code ? [level.code] : []));
  const shown = new Set<string>([
    ...(ticked.length ? ticked : LEVELS_ALWAYS_SHOWN),
    ...listed.flatMap((code) => (code ? [code] : [])),
  ]);
  return climbingOrder(levels).filter((level) => shown.has(level.code));
}

/**
 * The catalogue's level groups, with an empty group for each level the
 * subject or specialization is offered at (see `subjectOfferedLevels` and
 * `specializationOfferedLevels`; the six always-shown levels when it is
 * offered at none) that it sent none for, in the order a student climbs
 * them.
 *
 * Null while the grouped read failed: the page does not know what is listed
 * and keeps its fallback rather than drawing every level empty. Without the
 * list of levels, the groups are returned as they came.
 */
export function everyLevel(
  groups: CourseLevelGroup[] | null,
  levels: readonly CatalogueLevel[] | null,
  offered?: ReadonlyArray<{ code: string | null }> | null,
): CourseLevelGroup[] | null {
  if (!groups) return null;
  if (!levels?.length) return groups;
  const byCode = new Map(groups.map((group) => [group.level.code, group]));
  const ordered = climbingOrder(levels);
  const known = new Set(ordered.map((level) => level.code));
  /* The levels shown with nothing filed under them: the ones an editor
     ticked on the subject or specialization. With none ticked, the six the
     client named, so a page never shows no levels at all. */
  const ticked = (offered ?? []).flatMap((level) => (level.code ? [level.code] : []));
  const shownEmpty = new Set<string>(ticked.length ? ticked : LEVELS_ALWAYS_SHOWN);
  return [
    ...ordered.flatMap((level): CourseLevelGroup[] => {
      const group = byCode.get(level.code);
      if (group) return [group];
      if (!shownEmpty.has(level.code)) return [];
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
