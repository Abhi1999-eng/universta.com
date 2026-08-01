/** Turns a URL slug into readable display text.
 *
 * Several public surfaces fall back to the slug when no stored display name
 * is available. Printing the slug verbatim produced visitor-facing text like
 * "Cities in canada" and, on the counselling form, "Course · diploma
 * cybersecurity · canada". This is the shared fallback so those surfaces
 * agree, and so the rule lives in one place rather than being re-invented.
 *
 * This is deliberately only a *fallback*: where a real stored name exists
 * (a country's `name`, a course's `title`) that value always wins, because
 * only it can carry casing this cannot infer -- "United Kingdom" is
 * recoverable from a slug, "PhD in Data Science" or "University of Toronto"
 * is not. */
export function labelFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
