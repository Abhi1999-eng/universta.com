export type NavItem = { label: string; href: string; hints?: string[] };
export type NavGroup = { label: string; items: NavItem[] };

/** Single source of truth for the Admin sidebar, breadcrumbs, and the
 * Dashboard's quick-link cards. Every entry must open a real, working
 * screen -- items that are only manageable nested inside another
 * resource's editor (Campuses/Accreditations inside Universities,
 * Specializations inside Subjects, Services/Languages inside Consultants)
 * point at that parent screen rather than a non-existent standalone one,
 * with a `note` explaining where the control actually lives. */
export const NAV_GROUPS: NavGroup[] = [
  {
    // Everything that shapes the public website, from Header to Footer.
    label: "Website Builder",
    items: [
      { label: "Website Pages", href: "/website" },
      { label: "Global Header", href: "/website/header" },
      { label: "Global Footer", href: "/website/footer" },
      { label: "Navigation menus", href: "/phase1/navigation-menus" },
      { label: "Page templates", href: "/page-templates", hints: ["Reusable sections"] },
      { label: "Media library", href: "/media" },
      { label: "SEO management", href: "/seo" },
    ],
  },
  {
    label: "Content records",
    items: [
      // Website Pages (/website) is the canonical place to build a page. This
      // is the same data as a plain record list, kept for bulk/raw edits and
      // so breadcrumbs still resolve on the route -- named so nobody has to
      // wonder which of the two screens they are supposed to use.
      {
        label: "Page records (raw list)",
        href: "/phase1/pages",
        hints: ["Build pages in Website Pages"],
      },
      { label: "Success stories", href: "/phase1/success-stories" },
      { label: "Testimonials", href: "/phase1/testimonials" },
    ],
  },
  {
    label: "Destinations",
    items: [
      { label: "Continents", href: "/continents" },
      { label: "Countries", href: "/countries", hints: ["FAQs"] },
      { label: "States / provinces", href: "/locations?tab=states" },
      { label: "Cities", href: "/locations?tab=cities" },
    ],
  },
  {
    label: "Academics",
    items: [
      { label: "Subjects", href: "/subjects", hints: ["Specializations"] },
      { label: "Generic courses", href: "/courses" },
      { label: "Course levels", href: "/catalog-masters?section=course-levels" },
      { label: "Study modes", href: "/catalog-masters?section=study-modes" },
      { label: "Intakes", href: "/catalog-masters?section=intakes" },
    ],
  },
  {
    label: "Universities",
    items: [
      { label: "Universities", href: "/phase1/universities", hints: ["Campuses", "Accreditations"] },
      { label: "University course offerings", href: "/phase1/offerings" },
      { label: "University claim requests", href: "/university-claims" },
    ],
  },
  {
    label: "Scholarships",
    items: [
      { label: "Scholarships", href: "/phase1/scholarships" },
      { label: "Scholarship providers", href: "/catalog-masters?section=scholarship-providers" },
    ],
  },
  {
    label: "Consultants",
    items: [
      { label: "Consultants", href: "/phase1/consultants", hints: ["Services", "Languages"] },
      { label: "Consultant locations", href: "/consultant-locations" },
    ],
  },
  {
    label: "Enquiries and Counselling",
    items: [
      { label: "Contact enquiries", href: "/phase1/contact-inquiries" },
      { label: "Counselling leads", href: "/leads" },
    ],
  },
  {
    label: "Careers and events",
    items: [
      { label: "Jobs", href: "/phase1/jobs" },
      { label: "Events", href: "/phase1/events" },
    ],
  },
  {
    label: "Platform tools",
    items: [
      { label: "Bulk import / export", href: "/bulk-data" },
      { label: "Redirects", href: "/redirects" },
      { label: "A/B experiments", href: "/experiments" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "General site settings", href: "/settings?section=general" },
      { label: "Branding", href: "/settings?section=branding" },
      { label: "Contact details", href: "/settings?section=contact" },
      { label: "Social links", href: "/settings?section=social" },
      { label: "Header settings", href: "/settings?section=header" },
      { label: "Footer settings", href: "/settings?section=footer" },
      { label: "Default SEO settings", href: "/settings?section=seo" },
    ],
  },
];

export function flatNavItems(): NavItem[] {
  return NAV_GROUPS.flatMap((group) => group.items);
}

export function findNavItem(pathname: string): NavItem | undefined {
  return resolveActiveNavItem(pathname)?.item;
}

/** A stable identity for one sidebar entry. Labels repeat across groups, and
 * several entries deliberately share an href, so neither alone identifies a
 * row. */
export function navItemKey(groupLabel: string, itemLabel: string): string {
  return `${groupLabel}::${itemLabel}`;
}

/** Strips the query string, hash and any trailing slash, so `/subjects?page=2`,
 * `/subjects#top` and `/subjects/` all resolve like `/subjects`. */
function normalizePath(value: string): string {
  const path = value.split('#')[0].split('?')[0];
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function queryMatches(location: string, href: string): boolean {
  const expected = new URLSearchParams(href.split('?')[1] ?? '');
  if (expected.size === 0) return true;
  const actual = new URLSearchParams(location.split('#')[0].split('?')[1] ?? '');
  // A bare shared-screen URL intentionally falls back to that screen's first
  // leaf. Once any expected discriminator is present, it must match exactly so
  // Back/Forward between ?tab= or ?section= entries cannot highlight a sibling.
  if (![...expected.keys()].some((key) => actual.has(key))) return true;
  return [...expected].every(([key, value]) => actual.get(key) === value);
}

/** True when `path` is `base` or sits underneath it.
 *
 * Segment-safe on purpose: a plain `startsWith` would light up `/subjects` for
 * `/subjects-archive`, and `/courses` for `/course-levels`. */
function matchesBase(path: string, base: string): boolean {
  if (base === '/') return path === '/';
  return path === base || path.startsWith(`${base}/`);
}

/** The single sidebar entry that owns the current route, or null.
 *
 * Exactly one, which is the whole point. Several entries intentionally share a
 * destination -- Specializations points at /subjects, Campuses and
 * Accreditations at /phase1/universities, and seven Settings entries at
 * /settings -- because those things are edited inside their parent screen
 * rather than on one of their own. Marking every entry whose href matched lit
 * all of them blue at once, so the sidebar showed two, three, even seven
 * selected options for a single page.
 *
 * Resolution, in order:
 *   1. deepest matching href wins, so /phase1/universities beats /phase1;
 *   2. among entries sharing that href, the real destination wins over a
 *      signpost -- a `note` marks an entry whose subject is managed elsewhere,
 *      so Subjects is selected rather than Specializations;
 *   3. declaration order settles anything still tied, so the result is stable.
 */
export function resolveActiveNavItem(
  pathname: string,
  groups: NavGroup[] = NAV_GROUPS,
): { key: string; group: string; item: NavItem } | null {
  const path = normalizePath(pathname);
  let best: {
    key: string;
    group: string;
    item: NavItem;
    depth: number;
    isSignpost: boolean;
    order: number;
  } | null = null;
  let order = 0;

  for (const group of groups) {
    for (const item of group.items) {
      const base = normalizePath(item.href);
      const position = order++;
      if (!matchesBase(path, base) || !queryMatches(pathname, item.href)) continue;
      const candidate = {
        key: navItemKey(group.label, item.label),
        group: group.label,
        item,
        depth: base.length,
        isSignpost: false,
        order: position,
      };
      if (
        !best ||
        candidate.depth > best.depth ||
        (candidate.depth === best.depth &&
          !candidate.isSignpost &&
          best.isSignpost)
      ) {
        best = candidate;
      }
    }
  }

  return best ? { key: best.key, group: best.group, item: best.item } : null;
}
