'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { NAV_GROUPS, findNavItem, navItemKey, resolveActiveNavItem } from './nav-config';

/** Below this the sidebar is a drawer rather than a column -- the same width
 *  the ported stylesheet switches on. */
const DRAWER_QUERY = '(max-width: 1023px)';

function subscribeToDrawerWidth(listener: () => void) {
  const query = window.matchMedia(DRAWER_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

/**
 * Whether the sidebar is currently a drawer.
 *
 * Read as the external store it is rather than through an effect: the server
 * has no viewport, so it renders the column, and the browser corrects it on
 * the first client pass.
 */
function useIsDrawer() {
  return useSyncExternalStore(
    subscribeToDrawerWidth,
    () => window.matchMedia(DRAWER_QUERY).matches,
    () => false,
  );
}

function currentBreadcrumb(pathname: string) {
  if (pathname === '/dashboard' || pathname === '/') {
    return { group: null as string | null, item: 'Overview' };
  }
  // The generic Phase 1 resource screens render their own specific heading
  // (e.g. "Universities") inside the page body, matching the nav item's
  // label exactly for most resources -- using that same label for the
  // header title here would duplicate it visibly and break a heading-count
  // assertion, so the header stays generic for this whole route family.
  if (pathname.startsWith('/phase1')) {
    return { group: 'Content Management', item: 'Phase 1 content' };
  }
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) => entry.href.split('?')[0] === pathname);
    if (item) return { group: group.label, item: item.label };
  }
  const fuzzy = findNavItem(pathname);
  if (fuzzy) {
    const group = NAV_GROUPS.find((g) => g.items.includes(fuzzy));
    return { group: group?.label ?? null, item: fuzzy.label };
  }
  return { group: null as string | null, item: 'Dashboard' };
}

/**
 * The Admin frame, in the reference build's design.
 *
 * One sidebar, as the reference has: a column from 1024px up and a drawer
 * below it, rather than a second copy of the navigation rendered for small
 * screens. While it is a closed drawer it is also inert, so the keyboard
 * cannot reach a menu that is off the side of the screen.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`;
  const breadcrumb = currentBreadcrumb(location);
  const pageTitle = breadcrumb.item;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isDrawer = useIsDrawer();
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const wasMobileOpen = useRef(false);

  /* A drawer that stops being a drawer -- the window widened while it was
     open -- must not leave the page scroll-locked behind an invisible scrim.
     This watches for that change rather than the state, because closing it
     whenever the viewport is wide would mean it could never be opened at a
     width where the toggle is reachable at all. */
  const wasDrawer = useRef(isDrawer);
  useEffect(() => {
    if (wasDrawer.current && !isDrawer) setMobileOpen(false);
    wasDrawer.current = isDrawer;
  }, [isDrawer]);

  useLayoutEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = '';
      if (wasMobileOpen.current) {
        menuTriggerRef.current?.focus();
      }
      wasMobileOpen.current = false;
      return undefined;
    }
    wasMobileOpen.current = true;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) {
        return;
      }
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen]);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const initial = user?.firstName?.slice(0, 1).toUpperCase() ?? 'U';

  return (
    <div className={`pa p-app a-app${mobileOpen ? ' side-open' : ''}`}>
      <a className="p-skip" href="#main-content">
        Skip to content
      </a>

      <aside
        ref={drawerRef}
        id="p-side"
        className="p-side a-side"
        data-admin-nav-scroll
        /* The same element is the column and the drawer. It only claims to be
           a dialog while it is behaving like one. */
        {...(mobileOpen
          ? { role: 'dialog' as const, 'aria-modal': true }
          : {})}
        {...(isDrawer && !mobileOpen ? { inert: true } : {})}
        aria-label="Admin navigation"
      >
        <div className="p-side__head">
          <Link className="p-brand" href="/dashboard" onClick={() => setMobileOpen(false)}>
            <span className="p-brand__mark" aria-hidden="true">
              U
            </span>
            <span className="p-brand__name">
              Universta<small>Admin console</small>
            </span>
          </Link>
          {mobileOpen ? (
            <button
              ref={closeButtonRef}
              type="button"
              className="p-iconbtn"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        <Navigation pathname={location} onNavigate={() => setMobileOpen(false)} />

        <div className="p-side__foot">
          <UserSummary user={user} />
          <LogoutButton onLogout={handleLogout} loggingOut={loggingOut} />
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="p-scrim"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="p-body">
        <header className="p-top a-top">
          <button
            ref={menuTriggerRef}
            type="button"
            className="p-iconbtn p-top__menu"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>
          <div className="p-top__title">
            <p className="p-crumb">
              {breadcrumb.group ? (
                <>
                  <Link href="/dashboard">Admin</Link>
                  {' / '}
                  {breadcrumb.group}
                </>
              ) : (
                <Link href="/dashboard">Admin workspace</Link>
              )}
            </p>
            <h1 className="p-h2">{pageTitle}</h1>
          </div>
          <div className="u-account">
            {/* Name and role only: the address is stated once, in the
                sidebar's foot, rather than twice on every screen. */}
            <span className="u-account__org">
              <strong>
                {user?.firstName} {user?.lastName ?? ''}
              </strong>
              <span>{user?.roles.join(' · ')}</span>
            </span>
            <span className="p-avatar">
              <span>{initial}</span>
            </span>
          </div>
        </header>

        <main id="main-content" className="p-main a-main" tabIndex={-1}>
          <div className="p-page a-page">{children}</div>
        </main>
      </div>
    </div>
  );
}

function Navigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  // One winner for the whole sidebar, resolved once per route rather than
  // per item -- see resolveActiveNavItem for why matching each href
  // independently lit several entries at once.
  const activeKey = resolveActiveNavItem(pathname)?.key ?? null;
  const dashboardActive = pathname === '/dashboard' && activeKey === null;
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // Bring the selected entry into view when the route changes. The sidebar is
  // long enough that the active item is often off-screen after a direct URL
  // load or a Back/Forward step.
  useEffect(() => {
    const link = activeLinkRef.current;
    const container = navRef.current?.closest<HTMLElement>('[data-admin-nav-scroll]');
    if (!link || !container) return;

    const view = container.getBoundingClientRect();
    const target = link.getBoundingClientRect();
    // Already fully visible: do nothing. Without this the effect would fight a
    // user who has scrolled the sidebar themselves.
    if (target.top >= view.top && target.bottom <= view.bottom) return;

    // Smallest movement that reveals it, matching `block: 'nearest'`. Adjusting
    // scrollTop directly -- rather than scrollIntoView -- guarantees only this
    // container moves; scrollIntoView also scrolls ancestors, which would drag
    // the main page content along with it. Focus is deliberately untouched.
    const delta =
      target.top < view.top ? target.top - view.top : target.bottom - view.bottom;
    container.scrollTop += delta;
  }, [pathname, activeKey]);

  return (
    <nav ref={navRef} aria-label="Primary navigation" className="p-nav a-nav">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        ref={dashboardActive ? activeLinkRef : undefined}
        aria-current={dashboardActive ? 'page' : undefined}
        className={`p-nav__link${pathname === '/dashboard' ? ' is-active' : ''}`}
      >
        <GridIcon />
        <span>Dashboard</span>
      </Link>
      {NAV_GROUPS.map((group) => {
        const open = group.items.some(
          (item) => navItemKey(group.label, item.label) === activeKey,
        );
        return (
          /* The reference collapses its groups and opens the one holding the
             current screen. `open` is keyed so a route change re-mounts the
             group rather than leaving a stale disclosure state behind. */
          <details
            className="a-navgroup"
            key={group.label}
            open={open}
            {...(open ? { 'data-current-group': 'true' } : {})}
          >
            <summary className="p-nav__link">
              <span className="a-nav__dot" aria-hidden="true" />
              <span>{group.label}</span>
              <ChevronIcon />
            </summary>
            <div className="a-navgroup__items">
              {group.items.map((item) => {
                const key = navItemKey(group.label, item.label);
                const active = key === activeKey;
                return (
                  <Link
                    key={key}
                    href={item.href}
                    onClick={onNavigate}
                    ref={active ? activeLinkRef : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`p-nav__link${active ? ' is-active' : ''}`}
                    title={item.hints?.length ? `${item.hints.join(' · ')} are managed here` : undefined}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}

function UserSummary({
  user,
}: {
  user: { firstName: string; email: string; roles: string[] } | null;
}) {
  return (
    <div className="p-menu__who">
      <strong>{user?.firstName}</strong>
      <span>{user?.email}</span>
      <span>{user?.roles.join(' · ')}</span>
    </div>
  );
}

function LogoutButton({
  onLogout,
  loggingOut,
}: {
  onLogout: () => Promise<void>;
  loggingOut: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void onLogout()}
      disabled={loggingOut}
      className="p-nav__link"
    >
      <LogoutIcon />
      <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
    </button>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="a-navgroup__chev"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M15 12H3m0 0 4-4m-4 4 4 4M10 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8" />
    </svg>
  );
}
