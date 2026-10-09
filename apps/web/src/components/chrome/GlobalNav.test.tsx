import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The path the header and footer are drawn on, as the router reports it
   after a navigation; the account entry's session is not what these
   assertions are about. */
const route = vi.hoisted(() => ({ pathname: '/scholarships' }));
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/student/StudentSession', () => ({
  useStudentSession: () => ({ status: 'anonymous', signOut: vi.fn() }),
}));

import { renderToStaticMarkup } from 'react-dom/server';
import type { SiteChrome } from '@/lib/site-chrome';
import { GlobalFooter, GlobalHeader } from './GlobalNav';

/**
 * The root layout draws the site header and footer once, on the server, and
 * leaves them out for a route that wears its own. It is not drawn again on
 * a client navigation, so a link or router.push from /scholarships to
 * /compare/courses kept the site header and footer above and below the
 * comparison's own: two of each. The header and footer ask the same
 * question of the path they are on, and step aside.
 */
const chrome: SiteChrome = {
  headerMenu: [
    {
      id: 'compare',
      label: 'Compare Courses',
      href: '/compare/courses',
      openInNewTab: false,
      children: [],
    },
  ],
  footerMenu: [],
  settings: {
    general: { siteName: 'Universta' },
    branding: {},
    contact: {},
    social: {},
    header: {},
    footer: { description: 'Study abroad, planned.' },
  },
} as unknown as SiteChrome;

const header = () => renderToStaticMarkup(<GlobalHeader chrome={chrome} />);
const footer = () => renderToStaticMarkup(<GlobalFooter chrome={chrome} />);

beforeEach(() => {
  route.pathname = '/scholarships';
});

describe('the site header and footer', () => {
  it('draw on a page that wears them', () => {
    expect(header()).toContain('class="usta-header');
    expect(footer()).toContain('class="usta-footer');
  });

  it.each(['/compare/courses', '/compare/universities', '/courses', '/study-abroad/united-kingdom', '/universities/university-of-warwick', '/'])(
    'stand down on %s, which wears its own, however it was reached',
    (path) => {
      route.pathname = path;
      expect(header()).toBe('');
      expect(footer()).toBe('');
    },
  );

  it('stay on the comparisons and pages that have not moved into the design', () => {
    for (const path of ['/compare/countries', '/compare/consultants', '/universities/university-of-warwick/claim']) {
      route.pathname = path;
      expect(header()).toContain('class="usta-header');
      expect(footer()).toContain('class="usta-footer');
    }
  });
});
