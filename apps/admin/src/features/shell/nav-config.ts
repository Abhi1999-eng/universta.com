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
    label: "Content management",
    items: [
      { label: "Pages", href: "/phase1/pages" },
      { label: "Page templates", href: "/page-templates" },
      { label: "Page sections / content blocks", href: "/phase1/pages", note: "Managed within each page's editor" },
      { label: "Navigation menus", href: "/phase1/navigation-menus" },
      { label: "Media library", href: "/media" },
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
      { label: "SEO management", href: "/seo" },
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
