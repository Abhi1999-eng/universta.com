import type { CourseLevelGroup } from '@/lib/catalog';

/**
 * A destination's study levels, each with what a student can do at it.
 *
 * The level block counted courses and nothing else, so a subject an editor
 * had ticked for Bachelor's, Master's and PhD read "Bachelor's 0 courses"
 * in a destination with one Master's course, and its specializations --
 * which carry levels of their own -- were nowhere in it. A student picks a
 * level first and then asks two things of it: which branches of the subject
 * are taught at it, and which courses are listed here. A panel answers both.
 */

export type StudyLevelBranch = {
  id: string;
  name: string;
  slug: string;
  /** Its courses listed here at this level; null when the level holds more
   *  than the page read, so the figure would be a guess. */
  here: number | null;
};

export type StudyLevelPanel = {
  group: CourseLevelGroup;
  specializations: StudyLevelBranch[];
};

type Branch = {
  id: string;
  name: string;
  slug: string;
  levels?: ReadonlyArray<{ code: string | null }> | null;
};

/**
 * Each level's panel: its courses here, and the specializations offered at
 * it -- the ones whose levels include it, and any with a course filed under
 * it here -- the ones with courses first.
 */
export function studyLevelPanels(
  groups: readonly CourseLevelGroup[],
  branches: readonly Branch[] = [],
): StudyLevelPanel[] {
  return groups.map((group) => {
    const counted = new Map<string, number>();
    for (const course of group.courses)
      if (course.subSubject)
        counted.set(course.subSubject.id, (counted.get(course.subSubject.id) ?? 0) + 1);
    /* Counted from the rows read. Past them the level holds courses the
       page has not seen, and a branch's figure could be short. */
    const complete = group.courses.length >= group.count;
    const specializations = branches
      .filter(
        (branch) =>
          counted.has(branch.id) ||
          (branch.levels ?? []).some((level) => level.code === group.level.code),
      )
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
        slug: branch.slug,
        here: complete ? (counted.get(branch.id) ?? 0) : null,
      }))
      .sort((left, right) => {
        const a = counted.get(left.id) ?? 0;
        const b = counted.get(right.id) ?? 0;
        return a !== b ? b - a : left.name.localeCompare(right.name);
      });
    return { group, specializations };
  });
}

/** "Bachelor's", "Bachelor's and PhD", "Bachelor's, Master's and PhD". */
export function namesInProse(names: readonly string[]) {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The section's lead: the levels the field is offered at, where something
 * says it is, how to use the bar, and once -- not under every level --
 * which of them have nothing listed here yet.
 */
export function studyLevelsLead({
  field,
  where,
  panels,
  offered,
}: {
  field: string;
  where: string;
  panels: readonly StudyLevelPanel[];
  /** Whether the levels are ones the field is offered at -- ticked, or read
   *  from its specializations or courses -- rather than the six a page
   *  shows when nothing says. Those six are a layout, and never claimed. */
  offered: boolean;
}) {
  if (!panels.length) return undefined;
  const names = panels.map((panel) => panel.group.level.name);
  const empty = panels.filter((panel) => !panel.group.count).map((panel) => panel.group.level.name);
  const listed = panels.filter((panel) => panel.group.count).map((panel) => panel.group.level.name);
  /* What a panel holds decides what picking one shows: a specialization's
     page names no specializations, and a destination with nothing listed
     has no courses to show. */
  const branches = panels.some((panel) => panel.specializations.length > 0);
  const offeredAt = offered ? `${field} is offered at ${namesInProse(names)}.` : '';
  const pick =
    panels.length < 2
      ? ''
      : listed.length && branches
        ? ` Pick a level to see its specializations and the courses listed in ${where}.`
        : listed.length
          ? ` Pick a level to see the courses listed in ${where}.`
          : branches
            ? ' Pick a level to see the specializations taught at it.'
            : '';
  /* All empty is said by the notice above the levels; some empty is said
     here, once, naming whichever side is shorter. */
  const missing = !empty.length || !listed.length
    ? ''
    : listed.length < empty.length
      ? ` Only ${namesInProse(listed)} ${listed.length === 1 ? 'has' : 'have'} courses listed in ${where} so far.`
      : ` ${namesInProse(empty)} ${empty.length === 1 ? 'has' : 'have'} no course listed in ${where} yet.`;
  const lead = `${offeredAt}${pick}${missing}`.trim();
  return lead || `Courses are filed under these study levels as they are listed in ${where}.`;
}
