/**
 * The shareable address of a comparison: `/compare/<kind>?items=a,b,c`.
 *
 * The country and consultant comparisons keep the address the older pages
 * answered, so a link written for either still opens the same records.
 */
export const COMPARE_LIMIT = 3;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function compareSlugs(values: readonly string[], limit = COMPARE_LIMIT): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const slug = value.trim().toLowerCase();
    if (slug && SLUG.test(slug)) seen.add(slug);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

export function readCompareSlugs(
  params: Record<string, string | string[] | undefined>,
  limit = COMPARE_LIMIT,
): string[] {
  const raw = params.items;
  return compareSlugs((Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((value) => value.split(',')), limit);
}

export function compareHref(kind: string, values: readonly string[], limit = COMPARE_LIMIT): string {
  const slugs = compareSlugs(values, limit);
  return slugs.length ? `/compare/${kind}?items=${slugs.map(encodeURIComponent).join(',')}` : `/compare/${kind}`;
}
