import type { LevelPageIndex } from './catalog';
import { hasLevelPage, levelPages } from './course-levels';
import { LEVEL_PAGE_MIN_PROGRAMMES } from './level-page';
import type { ProgrammeAddress } from './phase1';
import { subjectLevelHref } from './subject-levels';

/**
 * Which level pages the sitemap announces: the ones the page itself would
 * mark indexable, worked out for the whole catalogue from list reads alone.
 *
 * A level page is indexed where it has three programmes or more, or an
 * editor has written enough of its own (`levelPageIndexable`). The page
 * counts its programmes with a /programmes read; the sitemap cannot make
 * one per page, so it counts the programme addresses it already reads in
 * full, which name each programme's subject, specialization and level the
 * way /programmes narrows on them. A page the sitemap lists must never be
 * one that says noindex, so every doubt leaves a page out.
 */

type LevelRow = { code: string | null };

/** One level page's key in the tally: subject, specialization (or none for
 *  the subject's own page) and level code. */
function tallyKey(subject: string, specialization: string | null | undefined, level: string) {
  return `${subject}|${specialization ?? ''}|${level.toUpperCase()}`;
}

/**
 * How many live programmes each level page lists. A programme counts on its
 * subject's page at its level and, where it has a specialization, on that
 * specialization's page too -- as a subject's page lists its branches'
 * programmes. Rows from an older API, which name no subject or level,
 * count nowhere.
 */
export function programmeTally(addresses: readonly ProgrammeAddress[]): Map<string, number> {
  const tally = new Map<string, number>();
  const bump = (key: string) => tally.set(key, (tally.get(key) ?? 0) + 1);
  for (const row of addresses) {
    if (!row.subjectSlug || !row.levelCode) continue;
    bump(tallyKey(row.subjectSlug, null, row.levelCode));
    if (row.specializationSlug) bump(tallyKey(row.subjectSlug, row.specializationSlug, row.levelCode));
  }
  return tally;
}

/**
 * The level pages worth a crawler's visit, each with when it last changed
 * where an editor wrote it.
 *
 * Only a field's claimed levels -- the ones it is offered at, by the rule
 * every link and every page uses -- and only levels the catalogue still
 * lists (/course-levels holds the active ones). A field offered at nothing
 * shows six levels it does not claim, and those are never announced. A
 * level outside the offered set is a 404 whatever is listed at it.
 *
 * Then the page's own test: three programmes, or written words of its own
 * (`hasOwnContent`). A page whose robots setting says no -- its own, or the
 * Level pages template's for a page nobody has written -- is left out.
 *
 * None at all while the written pages could not be read: without them no
 * page's robots setting is known, and a page that says noindex would be
 * announced on its programmes alone.
 *
 * The field's own robots setting, which the page also obeys, comes on the
 * list rows (`robotsIndex`): a subject's says no for its level pages and its
 * specializations', and a specialization's for its own. A row from an older
 * API carries none, and its pages are judged as before. The rows carry the
 * setting an editor saved on the record, not a bulk template's.
 */
export function indexableLevelPaths({
  subjects,
  specializations,
  catalogue,
  tally,
  written,
}: {
  subjects: ReadonlyArray<{
    slug: string;
    levels?: readonly LevelRow[] | null;
    robotsIndex?: boolean | null;
  }>;
  specializations: ReadonlyArray<{
    slug: string;
    subject: { slug: string };
    levels?: readonly LevelRow[] | null;
    robotsIndex?: boolean | null;
  }>;
  catalogue: ReadonlyArray<{ code: string }>;
  tally: ReadonlyMap<string, number>;
  /** Every written level page, or null when that read failed. */
  written: LevelPageIndex | null;
}): Array<{ path: string; lastModified?: string }> {
  if (!written) return [];
  const byKey = new Map(
    written.rows.map((row) => [
      tallyKey(row.subjectSlug, row.specializationSlug, row.levelCode),
      row,
    ]),
  );
  const template = written.templateRobotsIndex;
  const found: Array<{ path: string; lastModified?: string }> = [];
  const seen = new Set<string>();
  /* Each subject's own setting, which its specializations' level pages
     obey as well as its own. */
  const subjectRobots = new Map(subjects.map((row) => [row.slug, row.robotsIndex]));
  const consider = (
    subject: string,
    specialization: string | null,
    levels: readonly LevelRow[] | null | undefined,
    fieldRobots: ReadonlyArray<boolean | null | undefined>,
  ) => {
    if (fieldRobots.some((value) => value === false)) return;
    const pages = levelPages(levels, catalogue);
    if (!pages.claimed) return;
    for (const level of catalogue) {
      if (!hasLevelPage(pages, level.code)) continue;
      const key = tallyKey(subject, specialization, level.code);
      const page = byKey.get(key);
      /* A written page carries its own robots setting (or its template's);
         an unwritten one has only the template's. */
      const robots = page ? page.robotsIndex : template;
      if (robots === false) continue;
      const own = page?.hasOwnContent === true;
      if (!own && (tally.get(key) ?? 0) < LEVEL_PAGE_MIN_PROGRAMMES) continue;
      const path = subjectLevelHref({
        subject,
        specialization: specialization ?? undefined,
        level: level.code,
      });
      if (seen.has(path)) continue;
      seen.add(path);
      found.push(page ? { path, lastModified: page.updatedAt } : { path });
    }
  };
  for (const row of subjects) consider(row.slug, null, row.levels, [row.robotsIndex]);
  for (const row of specializations)
    consider(row.subject.slug, row.slug, row.levels, [
      row.robotsIndex,
      subjectRobots.get(row.subject.slug),
    ]);
  return found;
}
