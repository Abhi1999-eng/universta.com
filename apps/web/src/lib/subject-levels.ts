import { hasLevelPage, levelPages, type LevelPages } from '@/lib/course-levels';

/** Public level addresses stay readable while the catalogue keeps its codes. */
const LEVEL_SLUGS: Record<string, string> = {
  FOUNDATION: 'foundation',
  PATHWAY: 'pathway',
  UG: 'bachelors',
  PG: 'masters',
  MBA: 'mba',
  PHD: 'phd',
};

export function subjectLevelSlug(code: string) {
  return LEVEL_SLUGS[code.toUpperCase()] ?? code.toLowerCase();
}

/**
 * A field's page at one level: the level straight after the subject or the
 * specialization, `/subjects/computing/masters`. It used to sit under a
 * `/levels/` segment; those addresses redirect here permanently (see
 * next.config.ts). A level and a specialization share the place after the
 * subject, so the API keeps specialization slugs off the level slugs.
 */
export function subjectLevelHref({ subject, specialization, level, guides = false }: {
  subject: string;
  specialization?: string;
  level: string;
  guides?: boolean;
}) {
  const field = `/subjects/${encodeURIComponent(subject)}${specialization ? `/${encodeURIComponent(specialization)}` : ''}`;
  return `${field}/${encodeURIComponent(subjectLevelSlug(level))}${guides ? '?view=guides' : ''}`;
}

/**
 * A field's page at one level, where it has one; null where it does not.
 * Every link to a level page goes through this, so none opens a level the
 * field is not offered at -- that address is a 404 -- and a caller falls
 * back to the course finder or draws no link.
 */
export function levelPageHref(
  pages: LevelPages,
  args: Parameters<typeof subjectLevelHref>[0],
): string | null {
  return hasLevelPage(pages, args.level) ? subjectLevelHref(args) : null;
}

/** One link to a field's page at a level, named as the catalogue names it. */
export type LevelLink = { code: string; name: string; href: string };

/**
 * Links to a field's level pages, one for each level it is offered at:
 * `/subjects/computing/masters`, or `/subjects/computing/ai/masters` for a
 * specialization. `offered` is the field's offered set as the API sends it
 * -- a subject's or specialization's `levels`, or `subjectOfferedLevels` /
 * `specializationOfferedLevels` of its detail -- so these are exactly the
 * pages `levelPages` opens, and none of them is a 404.
 *
 * None for a field offered at nothing. Its six named levels have pages, but
 * those claim nothing (they are noindex and out of the sitemap); a link
 * would advertise levels nobody teaches it at.
 *
 * Always the plain address: the `?view=guides` copy of a level page is
 * noindex and has no canonical, so it is never what a page links a level
 * by. In the catalogue's order where it is known -- the order a student
 * climbs them -- and otherwise in the order given.
 */
export function levelPageLinks(
  offered: ReadonlyArray<{ code: string | null; name: string }> | null | undefined,
  field: { subject: string; specialization?: string },
  catalogue?: ReadonlyArray<{ code: string }> | null,
): LevelLink[] {
  const pages = levelPages(offered, catalogue);
  if (!pages.claimed) return [];
  const seen = new Set<string>();
  const links = (offered ?? []).flatMap((level) => {
    const code = level.code?.toUpperCase();
    if (!code || seen.has(code) || !hasLevelPage(pages, code)) return [];
    seen.add(code);
    return [{ code, name: level.name, href: subjectLevelHref({ ...field, level: code }) }];
  });
  if (!catalogue?.length) return links;
  const rank = new Map(catalogue.map((level, index) => [level.code.toUpperCase(), index]));
  return links
    .map((link, index) => ({ link, index }))
    .sort((a, b) => (rank.get(a.link.code) ?? Infinity) - (rank.get(b.link.code) ?? Infinity) || a.index - b.index)
    .map(({ link }) => link);
}

export function findSubjectLevel<T extends { code: string }>(levels: T[], slug: string): T | undefined {
  const value = slug.toLowerCase();
  const alias = value === 'undergraduate' ? 'bachelors' : value;
  return levels.find((level) => subjectLevelSlug(level.code) === alias || level.code.toLowerCase() === alias);
}
