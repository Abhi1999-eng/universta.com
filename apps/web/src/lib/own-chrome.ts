/**
 * The routes that wear their own header and footer, so the site chrome
 * stands down for them.
 *
 * Asked in two places. The root layout's server wrappers ask it of the
 * request's path, which is all a first load needs. But the root layout is
 * not rendered again on a client navigation: a link or a router.push from a
 * page wearing the site header into one of these kept that header and its
 * footer on screen, above and below the route's own, and the comparison
 * showed two of each. So the site header and footer also ask it of the
 * path they are drawn on, and step aside as soon as it is one of these.
 */

/** Study Abroad is the one route family that ships its own header and footer
 * as part of the client-approved design, so the site chrome stands down for it
 * rather than stacking a second navigation on top. Every other route is
 * untouched.
 *
 * The homepage is part of that family: the destination listing the approved
 * design published at `/study-abroad` and `/countries` is now the homepage
 * itself, and it arrives wearing the same header and footer as the country
 * guides it links to. */
const OWN_CHROME_PREFIXES = [
  '/study-abroad',
  /* Subjects and specializations are part of the same approved design: the
     reference builds them from the same stylesheet and the same section
     bands as the country guides, and they now live in the (sa) route group
     that ships its header and footer. */
  '/subjects',
  '/specializations',
  '/courses',
];

/** The same, for the routes under a family whose other children have not
 * moved. The university directory and a university's own guide are built on
 * the approved design and ship its chrome; the claim form and an offering's
 * page are still the older template and need the site chrome, so these match
 * a path rather than the family. Course and university comparisons have
 * moved into the design; country and consultant comparisons have not. */
/* Search also lives in the Study Abroad layout, so its own navigation must
   replace the global header on first load and after a client navigation. */
const OWN_CHROME_PATHS = ['/universities', '/compare/courses', '/compare/universities', '/search'];
const OWN_CHROME_PATTERNS = [/^\/universities\/[^/]+$/];

export function ownsItsChrome(path: string | null | undefined): boolean {
  if (path === '/') return true;
  if (!path) return false;
  if (OWN_CHROME_PATHS.includes(path)) return true;
  if (OWN_CHROME_PATTERNS.some((pattern) => pattern.test(path))) return true;
  return OWN_CHROME_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
