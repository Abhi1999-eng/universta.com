const CANONICAL_PUBLIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCanonicalPublicSlug(slug: string) {
  return CANONICAL_PUBLIC_SLUG.test(slug);
}

export function countCanonicalPublicSlugs(rows: Array<{ slug: string }>) {
  return rows.filter((row) => isCanonicalPublicSlug(row.slug)).length;
}
