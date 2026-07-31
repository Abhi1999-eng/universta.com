export type NavItem = { label: string; href: string; note?: string };
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
      { label: "Page templates", href: "/page-templates" },
      { label: "Reusable sections", href: "/page-templates", note: "Default section sets live on each template" },
      { label: "Media library", href: "/media" },
      { label: "SEO management", href: "/seo" },
    ],
  },
  {
    label: "Content records",
    items: [
      { label: "Pages", href: "/phase1/pages" },
      { label: "Page sections / content blocks", href: "/phase1/pages", note: "Managed within each page's editor" },
      { label: "FAQs", href: "/countries", note: "Managed within each Country's editor" },
      { label: "Success stories", href: "/phase1/success-stories" },
      { label: "Testimonials", href: "/phase1/testimonials" },
    ],
  },
  {
    label: "Destinations",
    items: [
      { label: "Continents", href: "/continents" },
      { label: "Countries", href: "/countries" },
      { label: "States / provinces", href: "/locations?tab=states" },
      { label: "Cities", href: "/locations?tab=cities" },
    ],
  },
  {
    label: "Academics",
    items: [
      { label: "Subjects", href: "/subjects" },
      { label: "Specializations", href: "/subjects", note: "Managed within each Subject's editor" },
      { label: "Generic courses", href: "/courses" },
      { label: "Course levels", href: "/catalog-masters" },
      { label: "Study modes", href: "/catalog-masters" },
      { label: "Intakes", href: "/catalog-masters" },
    ],
  },
  {
    label: "Universities",
    items: [
      { label: "Universities", href: "/phase1/universities" },
      { label: "Campuses", href: "/phase1/universities", note: "Managed within each University's editor" },
      { label: "University course offerings", href: "/phase1/offerings" },
      { label: "Accreditations", href: "/phase1/universities", note: "Managed within each University's editor" },
      { label: "University claim requests", href: "/university-claims" },
    ],
  },
  {
    label: "Scholarships",
    items: [
      { label: "Scholarships", href: "/phase1/scholarships" },
      { label: "Scholarship providers", href: "/catalog-masters" },
    ],
  },
  {
    label: "Consultants",
    items: [
      { label: "Consultants", href: "/phase1/consultants" },
      { label: "Consultant locations", href: "/consultant-locations" },
      { label: "Services", href: "/phase1/consultants", note: "Managed within each Consultant's editor" },
      { label: "Languages", href: "/phase1/consultants", note: "Managed within each Consultant's editor" },
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
      { label: "General site settings", href: "/settings" },
      { label: "Branding", href: "/settings" },
      { label: "Contact details", href: "/settings" },
      { label: "Social links", href: "/settings" },
      { label: "Header settings", href: "/settings" },
      { label: "Footer settings", href: "/settings" },
      { label: "Default SEO settings", href: "/settings" },
    ],
  },
];

export function flatNavItems(): NavItem[] {
  return NAV_GROUPS.flatMap((group) => group.items);
}

export function findNavItem(pathname: string): NavItem | undefined {
  const items = flatNavItems();
  const exact = items.find((item) => item.href.split("?")[0] === pathname);
  if (exact) return exact;
  return items
    .filter((item) => pathname.startsWith(item.href.split("?")[0]) && item.href !== "/")
    .sort((a, b) => b.href.length - a.href.length)[0];
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
      if (!matchesBase(path, base)) continue;
      const candidate = {
        key: navItemKey(group.label, item.label),
        group: group.label,
        item,
        depth: base.length,
        isSignpost: Boolean(item.note),
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
