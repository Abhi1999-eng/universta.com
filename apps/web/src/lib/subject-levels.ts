import { hasLevelPage, type LevelPages } from '@/lib/course-levels';

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

export function findSubjectLevel<T extends { code: string }>(levels: T[], slug: string): T | undefined {
  const value = slug.toLowerCase();
  const alias = value === 'undergraduate' ? 'bachelors' : value;
  return levels.find((level) => subjectLevelSlug(level.code) === alias || level.code.toLowerCase() === alias);
}
