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
 * The levels a subject is offered at, for the pages that show them: what an
 * editor ticked on the subject, together with every level its
 * specializations are offered at and every level a published course of its
 * own is at. A subject whose AI branch is ticked for Master's and PhD is
 * offered at those whether or not the subject says so, and a subject with a
 * published Bachelor's course is offered at Bachelor's.
 *
 * The subject's own ticks only ever add. They used to replace the
 * specializations' levels, so a subject ticked for Master's alone hid its
 * Data Science branch's Bachelor's from the level bar and the destination's
 * panels while that branch's card still said "Bachelor's". The ticks are
 * for what the subject offers beyond its branches -- a Foundation year, say
 * -- or for a subject with no branches yet. A level counted at nought adds
 * nothing by itself: those rows are ticks the API has already merged. This
 * is the rule the API applies to the admin's Level pages card and to the
 * sitemap, so the three agree on which level pages exist. Empty only when
 * none of them says anything, and the page then shows the six levels the
 * client named (see `LEVELS_ALWAYS_SHOWN`).
 */
export function subjectOfferedLevels(subject: {
  offeredLevels?: readonly LevelRef[] | null;
  subSubjects?: ReadonlyArray<{ levels?: readonly LevelRef[] | null }> | null;
  courseCountsByLevel?: ReadonlyArray<{ level: LevelRef; count: number }> | null;
}): LevelRef[] {
  const seen = new Map<string, LevelRef>();
  const add = (level: LevelRef) => {
    if (level.code && !seen.has(level.code)) seen.set(level.code, level);
  };
  for (const level of subject.offeredLevels ?? []) add(level);
  for (const branch of subject.subSubjects ?? []) for (const level of branch.levels ?? []) add(level);
  for (const row of subject.courseCountsByLevel ?? []) if (row.count > 0) add(row.level);
  return [...seen.values()];
}

/**
 * The levels a specialization is offered at: its own ticks together with
 * the levels its published courses are at (its `levels`, which the API
 * already sends as that union), each once. Empty when neither says, and its
 * pages then show the six named levels without claiming them -- as its
 * card, which names no level, and the subject's level panels, which list it
 * under none.
 *
 * Its ticks used to replace its course levels, so a branch ticked for
 * Master's with a published Bachelor's course had no Bachelor's page,
 * while its subject's page listed it under Bachelor's.
 *
 * It does not borrow its subject's ticks. Those are what the subject
 * offers beyond its branches -- a Foundation year, say -- so a branch with
 * nothing of its own claimed exactly the levels its siblings do not have.
 */
export function specializationOfferedLevels(specialization: {
  offeredLevels?: readonly LevelRef[] | null;
  levels?: readonly LevelRef[] | null;
}): LevelRef[] {
  const seen = new Map<string, LevelRef>();
  for (const level of [...(specialization.offeredLevels ?? []), ...(specialization.levels ?? [])])
    if (level.code && !seen.has(level.code)) seen.set(level.code, level);
  return [...seen.values()];
}

/**
 * The levels a field has pages for. Where it is offered at any level:
 * exactly those, and the pages claim them. Where it is offered at none: the
 * six named levels, which render so the field never has no levels at all,
 * but claim nothing -- they stay out of the index and the sitemap.
 *
 * Only the catalogue's levels count, where its list is known
 * (/course-levels holds the active ones). A level an editor switched off
 * has no page, though the courses filed at it still count towards a
 * field's levels: a field offered at such levels alone claimed them, had a
 * page at none and answered 404 at every level. It is offered at nothing
 * instead, and shows the six.
 *
 * Every level page, every link to one and the sitemap go through this, so
 * a link never opens a level the field has no page for.
 */
export type LevelPages = { codes: ReadonlySet<string>; claimed: boolean };

export function levelPages(
  offered?: ReadonlyArray<{ code: string | null }> | null,
  catalogue?: ReadonlyArray<{ code: string }> | null,
): LevelPages {
  const active = catalogue?.length
    ? new Set(catalogue.map((level) => level.code.toUpperCase()))
    : null;
  const codes = (offered ?? []).flatMap((level) => {
    const code = level.code?.toUpperCase();
    return code && (!active || active.has(code)) ? [code] : [];
  });
  return codes.length
    ? { codes: new Set(codes), claimed: true }
    : { codes: new Set(LEVELS_ALWAYS_SHOWN), claimed: false };
}

/** Whether the field has a page at this level. */
export function hasLevelPage(pages: LevelPages, code: string | null | undefined) {
  return Boolean(code) && pages.codes.has(code!.toUpperCase());
}

/** A subject's level pages (see `subjectOfferedLevels`), among the
 *  catalogue's levels where those are known. */
export const subjectLevelPages = (
  subject: Parameters<typeof subjectOfferedLevels>[0],
  catalogue?: ReadonlyArray<{ code: string }> | null,
) => levelPages(subjectOfferedLevels(subject), catalogue);

/** A specialization's level pages (see `specializationOfferedLevels`),
 *  among the catalogue's levels where those are known. */
export const specializationLevelPages = (
  specialization: Parameters<typeof specializationOfferedLevels>[0],
  catalogue?: ReadonlyArray<{ code: string }> | null,
) => levelPages(specializationOfferedLevels(specialization), catalogue);

/**
 * The catalogue's levels a level bar offers, in climbing order: the ones
 * the field has pages for (the six named levels when it is offered at
 * none). The levels with courses are in the offered set now, and the one
 * being read is there because its page exists, so every chip opens a page.
 */
export function levelsOnBar(
  levels: readonly CatalogueLevel[],
  pages: LevelPages,
): CatalogueLevel[] {
  return climbingOrder(levels).filter((level) => hasLevelPage(pages, level.code));
}

/**
 * The catalogue's level groups, with an empty group for each level the
 * subject or specialization has a page for (see `levelPages`: the levels it
 * is offered at, or the six always-shown levels when it is offered at none)
 * that it sent none for, in the order a student climbs them.
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
  /* The levels shown with nothing filed under them: the ones the field has
     pages for -- the levels it is offered at, or with none, the six the
     client named, so a page never shows no levels at all. The same set the
     level pages are built from, so an empty row always opens a page. A
     group with courses is kept whether or not its level has a page: listed
     courses are never hidden. */
  const pages = levelPages(offered, levels);
  return [
    ...ordered.flatMap((level): CourseLevelGroup[] => {
      const group = byCode.get(level.code);
      if (group) return [group];
      if (!hasLevelPage(pages, level.code)) return [];
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
