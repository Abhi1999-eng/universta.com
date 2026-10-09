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

export function subjectLevelHref({ subject, specialization, level, guides = false }: {
  subject: string;
  specialization?: string;
  level: string;
  guides?: boolean;
}) {
  const field = `/subjects/${encodeURIComponent(subject)}${specialization ? `/${encodeURIComponent(specialization)}` : ''}`;
  return `${field}/levels/${encodeURIComponent(subjectLevelSlug(level))}${guides ? '?view=guides' : ''}`;
}

export function findSubjectLevel<T extends { code: string }>(levels: T[], slug: string): T | undefined {
  const value = slug.toLowerCase();
  const alias = value === 'undergraduate' ? 'bachelors' : value;
  return levels.find((level) => subjectLevelSlug(level.code) === alias || level.code.toLowerCase() === alias);
}
