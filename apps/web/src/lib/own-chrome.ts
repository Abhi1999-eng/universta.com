/**
 * Which routes wear their own header and footer, so the site chrome stands
 * down for them.
 *
 * Asked in two places. The root layout's server wrappers ask it of the
 * request's path, which is all a first load needs. But the root layout is
 * not rendered again on a client navigation: a link or a router.push from a
 * page wearing the site header into one of these kept that header and its
 * footer on screen, above and below the route's own, and the comparison
 * showed two of each. So the site header and footer also ask it of the
 * path they are drawn on, and step aside as soon as it is one of these.
 *
 * The approved design reached the public site one family at a time -- the
 * destination guides, then subjects, courses and universities, then the
 * listings, the records and the comparisons -- and this file named each
 * family as it moved. Every public page wears the design now, so the
 * question is the other way round: the site chrome stays only on the
 * student portal, the preview and the referral link, and a path nothing
 * answers wears the design's own page-not-found.
 */
const SITE_CHROME_PREFIXES = ['/student', '/preview', '/r'];

export function ownsItsChrome(path: string | null | undefined): boolean {
  if (!path) return false;
  return !SITE_CHROME_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
