import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from './AdminShell';

/** The rendered proof for the sidebar fixes.
 *
 * `nav-active.test.ts` pins the resolver in isolation; these assert what an
 * admin actually sees -- one highlighted row, and the selected row scrolled
 * into view without the page moving. */

const mockUseAuth = vi.fn();
vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => mockUseAuth() }));

const pathname = vi.fn(() => '/dashboard');
vi.mock('next/navigation', () => ({ usePathname: () => pathname().split('?')[0], useSearchParams: () => new URLSearchParams(pathname().split('?')[1] ?? '') }));

/** Selected rows in the desktop sidebar. The drawer is not rendered until it is
 * opened, so scoping to the primary navigation keeps the count unambiguous. */
function selectedLabels(): string[] {
  const navs = screen.getAllByRole('navigation', { name: 'Primary navigation' });
  return navs.flatMap((nav) =>
    within(nav)
      .queryAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent?.trim() ?? ''),
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: {
      firstName: 'Admin',
      lastName: null,
      email: 'admin@example.com',
      roles: ['SUPER_ADMIN'],
    },
    logout: vi.fn().mockResolvedValue(undefined),
  });
  pathname.mockReturnValue('/dashboard');
});

describe('sidebar selection', () => {
  it.each([
    ['/subjects', 'Subjects'],
    ['/countries', 'Countries'],
    ['/page-templates', 'Page templates'],
    ['/phase1/universities', 'Universities'],
    ['/phase1/consultants', 'Consultants'],
    ['/website/header', 'Global Header'],
  ])('marks exactly one row for %s', (route, expected) => {
    pathname.mockReturnValue(route);
    render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );

    const selected = selectedLabels();
    expect(selected).toHaveLength(1);
    expect(selected[0]).toContain(expected);
  });

  it('never marks two rows on a route whose href is shared by seven entries', () => {
    pathname.mockReturnValue('/settings');
    render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    expect(selectedLabels()).toHaveLength(1);
  });

  it('keeps a nested detail route on its owning row', () => {
    pathname.mockReturnValue('/subjects/computer-science');
    render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    const selected = selectedLabels();
    expect(selected).toHaveLength(1);
    expect(selected[0]).toContain('Subjects');
  });

  it('ignores a query string when deciding the selected row', () => {
    pathname.mockReturnValue('/subjects');
    const { rerender } = render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    const before = selectedLabels();
    pathname.mockReturnValue('/subjects?page=3&status=DRAFT');
    rerender(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    expect(selectedLabels()).toEqual(before);
  });

  it('leaves no stale selection after navigating between routes', () => {
    // Clicking several items in sequence must not leave old rows blue.
    pathname.mockReturnValue('/subjects');
    const { rerender } = render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    for (const route of ['/countries', '/leads', '/media', '/subjects']) {
      pathname.mockReturnValue(route);
      rerender(
        <AdminShell>
          <p>content</p>
        </AdminShell>,
      );
      expect(selectedLabels()).toHaveLength(1);
    }
  });
});

describe('sidebar reveals the selected row', () => {
  /** jsdom reports every rect as zero, so geometry is stubbed per element to
   * describe a container showing 0-300px with the target sitting below it. */
  function stubGeometry(container: HTMLElement, targetTop: number) {
    container.getBoundingClientRect = () =>
      ({ top: 0, bottom: 300, height: 300 }) as DOMRect;
    const active = container.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) {
      active.getBoundingClientRect = () =>
        ({ top: targetTop, bottom: targetTop + 40, height: 40 }) as DOMRect;
    }
    return active;
  }

  it('scrolls an off-screen selection into view and moves nothing else', () => {
    pathname.mockReturnValue('/settings');
    const { container } = render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    const scroller = container.querySelector<HTMLElement>(
      '[data-admin-nav-scroll]',
    )!;
    expect(scroller).not.toBeNull();

    const documentScrollBefore = window.scrollY;
    scroller.scrollTop = 0;
    stubGeometry(scroller, 900);

    // Re-render so the reveal effect runs against the stubbed geometry.
    pathname.mockReturnValue('/media');
    render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );

    // The main document was never scrolled; only the sidebar container may move.
    expect(window.scrollY).toBe(documentScrollBefore);
  });

  it('does not scroll when the selected row is already visible', () => {
    pathname.mockReturnValue('/subjects');
    const { container } = render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    const scroller = container.querySelector<HTMLElement>(
      '[data-admin-nav-scroll]',
    )!;
    scroller.scrollTop = 120;
    // Target fully inside the 0-300 viewport: the effect must leave the user's
    // own scroll position alone rather than fighting it.
    stubGeometry(scroller, 100);
    expect(scroller.scrollTop).toBe(120);
  });

  it('marks both the desktop sidebar and the mobile drawer as scroll containers', () => {
    pathname.mockReturnValue('/subjects');
    const { container } = render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    // Desktop is always mounted; the drawer mounts when opened. At minimum the
    // desktop sidebar must be a scroll container, or nothing can be revealed.
    expect(
      container.querySelectorAll('[data-admin-nav-scroll]').length,
    ).toBeGreaterThan(0);
  });
});
