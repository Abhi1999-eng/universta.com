import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, navItemKey, resolveActiveNavItem } from './nav-config';

/** The sidebar showed several entries selected at once -- Subjects together
 * with Specializations on /subjects, and all seven Settings entries on
 * /settings -- because entries that deliberately share a destination each
 * matched the route independently. These pin "exactly one, and the right one".
 */

const ROUTES = [
  '/subjects',
  '/countries',
  '/courses',
  '/catalog-masters',
  '/settings',
  '/page-templates',
  '/media',
  '/seo',
  '/leads',
  '/website',
  '/website/header',
  '/website/footer',
  '/phase1/universities',
  '/phase1/consultants',
  '/phase1/navigation-menus',
];

function activeLabel(pathname: string): string | null {
  return resolveActiveNavItem(pathname)?.item.label ?? null;
}

describe('exactly one sidebar entry is active', () => {
  it.each(ROUTES)('resolves a single owner for %s', (pathname) => {
    const active = resolveActiveNavItem(pathname);
    expect(active).not.toBeNull();

    // Count how many entries the resolver considers the winner. Exactly one
    // key can equal the resolved key, by construction -- this asserts the
    // rendered sidebar can never mark two rows.
    const matches = NAV_GROUPS.flatMap((group) =>
      group.items
        .map((item) => navItemKey(group.label, item.label))
        .filter((key) => key === active!.key),
    );
    expect(matches).toHaveLength(1);
  });

  it('selects Subjects, not Specializations, on /subjects', () => {
    // The exact symptom reported.
    expect(activeLabel('/subjects')).toBe('Subjects');
  });

  it('selects Universities, not Campuses or Accreditations', () => {
    expect(activeLabel('/phase1/universities')).toBe('Universities');
  });

  it('selects Consultants, not Services or Languages', () => {
    expect(activeLabel('/phase1/consultants')).toBe('Consultants');
  });

  it('selects Countries, not the FAQs signpost', () => {
    expect(activeLabel('/countries')).toBe('Countries');
  });

  it('selects Page templates, not Reusable sections', () => {
    expect(activeLabel('/page-templates')).toBe('Page templates');
  });

  it('keeps the legacy raw Pages route out of normal sidebar navigation', () => {
    expect(resolveActiveNavItem('/phase1/pages')).toBeNull();
  });

  it('picks one of the seven entries that share /settings', () => {
    const active = resolveActiveNavItem('/settings');
    expect(active).not.toBeNull();
    expect(active!.item.href).toBe('/settings?section=general');
  });

  it.each([
    ['/locations?tab=states', 'States / provinces'],
    ['/locations?tab=cities', 'Cities'],
    ['/catalog-masters?section=course-levels', 'Course levels'],
    ['/catalog-masters?section=study-modes', 'Study modes'],
    ['/catalog-masters?section=intakes', 'Intakes'],
    ['/catalog-masters?section=scholarship-providers', 'Scholarship providers'],
    ['/settings?section=branding', 'Branding'],
    ['/settings?section=footer', 'Footer settings'],
  ])('uses query context to select %s', (location, label) => {
    expect(activeLabel(location)).toBe(label);
  });
});

describe('route matching is segment-safe', () => {
  it('prefers the deeper entry for a nested route', () => {
    // /website/header must not resolve to /website.
    expect(activeLabel('/website/header')).toBe('Global Header');
    expect(activeLabel('/website/footer')).toBe('Global Footer');
    expect(activeLabel('/website')).toBe('Website Pages');
  });

  it('keeps a nested edit or detail route on its owning entry', () => {
    expect(activeLabel('/subjects/computer-science')).toBe('Subjects');
    expect(activeLabel('/subjects/abc-123/edit')).toBe('Subjects');
    expect(activeLabel('/phase1/universities/xyz-789')).toBe('Universities');
    expect(activeLabel('/leads/42')).toBe(activeLabel('/leads'));
  });

  it('does not treat a sibling with a shared prefix as a child', () => {
    // A plain startsWith would light up /courses for /course-levels.
    const courses = resolveActiveNavItem('/courses');
    const courseLevels = resolveActiveNavItem('/course-levels');
    expect(courses?.item.href).toBe('/courses');
    expect(courseLevels?.item.href).not.toBe('/courses');
  });

  it('ignores the query string and hash', () => {
    for (const suffix of [
      '?page=2',
      '?status=DRAFT&featured=true',
      '#section',
      '?page=2#section',
      '/',
    ]) {
      expect({ suffix, label: activeLabel(`/subjects${suffix}`) }).toEqual({
        suffix,
        label: 'Subjects',
      });
    }
  });

  it('returns null rather than guessing for an unknown route', () => {
    expect(resolveActiveNavItem('/not-a-real-admin-route')).toBeNull();
  });

  it('is stable across repeated resolution, so navigating never leaves two blue', () => {
    // Clicking through several routes in sequence must not accumulate state.
    const sequence = ['/subjects', '/countries', '/settings', '/subjects'];
    const keys = sequence.map((path) => resolveActiveNavItem(path)?.key);
    expect(keys[0]).toBe(keys[3]);
    expect(new Set(keys).size).toBe(3);
  });
});
