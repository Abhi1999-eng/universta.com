'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';

const plannedItems = ['Content', 'SEO', 'Settings'];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const pageTitle = pathname.startsWith('/leads') ? 'Leads' : pathname.startsWith('/countries') ? 'Countries' : pathname.startsWith('/continents') ? 'Continents' : pathname.startsWith('/subjects') ? 'Subjects' : pathname.startsWith('/courses') ? 'Courses' : pathname.startsWith('/catalog-masters') ? 'Catalog masters' : pathname.startsWith('/media') ? 'Media library' : pathname.startsWith('/experiments') ? 'Experiments' : pathname.startsWith('/locations') ? 'States & cities' : pathname.startsWith('/university-claims') ? 'University claims' : pathname.startsWith('/phase1') ? 'Expanded Phase 1' : 'Dashboard';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const wasMobileOpen = useRef(false);

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-[#FAFBFD] text-[#0D1524]">
      <DesktopSidebar pathname={pathname} onLogout={handleLogout} loggingOut={loggingOut} />
      {mobileOpen ? (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-[#0D1524]/45 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(86vw,340px)] flex-col bg-[#0D1524] p-5 text-white shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between">
              <Brand inverse />
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
              >
                <CloseIcon />
              </button>
            </div>
            <Navigation pathname={pathname} onNavigate={() => setMobileOpen(false)} dark />
            <div className="mt-auto border-t border-white/10 pt-5">
              <UserSummary user={user} dark />
              <LogoutButton onLogout={handleLogout} loggingOut={loggingOut} dark />
            </div>
          </aside>
        </>
      ) : null}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#E8ECF3] bg-[#FAFBFD]/95 px-5 backdrop-blur sm:px-8 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              ref={menuTriggerRef}
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-[#48505F] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1657CF] lg:hidden"
            >
              <MenuIcon />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#828B9B]">Admin workspace</p>
              <h1 className="mt-1 text-lg font-semibold tracking-[-0.02em]">{pageTitle}</h1>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-semibold text-[#0D1524]">{user?.firstName} {user?.lastName ?? ''}</p>
              <p className="text-xs text-[#828B9B]">{user?.email}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#828B9B]">{user?.roles.join(' · ')}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#DCE8FF] text-sm font-bold text-[#1657CF]">
              {user?.firstName.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <main id="main-content" className="min-h-[calc(100vh-76px)] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-5 focus:top-5 focus:z-[60] focus:rounded-lg focus:bg-[#1657CF] focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white">
            Skip to content
          </a>
          {children}
        </main>
      </div>
    </div>
  );
}

function DesktopSidebar({
  pathname,
  onLogout,
  loggingOut,
}: {
  pathname: string;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col overflow-y-auto bg-[#0D1524] p-6 text-white lg:flex">
      <Brand inverse />
      <p className="mt-2 pl-1 text-xs font-medium text-white/40">ADMIN CONSOLE</p>
      <Navigation pathname={pathname} />
      <div className="mt-auto border-t border-white/10 pt-5">
        <LogoutButton onLogout={onLogout} loggingOut={loggingOut} dark />
      </div>
    </aside>
  );
}

function Navigation({
  pathname,
  onNavigate,
  dark = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  dark?: boolean;
}) {
  return (
    <nav aria-label="Primary navigation" className="mt-10">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        aria-current={pathname === '/dashboard' ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname === '/dashboard' ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
      >
        <GridIcon />
        Dashboard
      </Link>
      <div className="mt-2 space-y-1">
        <Link
          href="/leads"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/leads') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/leads') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">L</span>
          Leads
        </Link>
        <Link
          href="/continents"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/continents') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/continents') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">R</span>
          Continents
        </Link>
        <Link
          href="/countries"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/countries') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/countries') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">C</span>
          Countries
        </Link>
        <Link
          href="/subjects"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/subjects') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/subjects') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">S</span>
          Subjects
        </Link>
        <Link
          href="/courses"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/courses') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/courses') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">C</span>
          Courses
        </Link>
        <Link
          href="/catalog-masters"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/catalog-masters') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/catalog-masters') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">M</span>
          Catalog masters
        </Link>
        <Link
          href="/phase1/universities"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/phase1') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/phase1') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">P1</span>
          Phase 1 content
        </Link>
        <Link
          href="/media"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/media') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/media') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">M</span>
          Media library
        </Link>
        <Link
          href="/experiments"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/experiments') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/experiments') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">AB</span>
          Experiments
        </Link>
        <Link
          href="/locations"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/locations') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/locations') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">L</span>
          States &amp; cities
        </Link>
        <Link
          href="/university-claims"
          onClick={onNavigate}
          aria-current={pathname.startsWith('/university-claims') ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${pathname.startsWith('/university-claims') ? (dark ? 'bg-white/12 text-white' : 'bg-[#1657CF] text-white') : dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
        >
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">UC</span>
          University claims
        </Link>
      </div>
      <div className="mt-8">
        <p className={`px-3 text-[10px] font-bold uppercase tracking-[0.18em] ${dark ? 'text-white/35' : 'text-[#A0A8B6]'}`}>
          Planned modules
        </p>
        <div className="mt-3 space-y-1">
          {plannedItems.map((item) => (
            <button
              key={item}
              type="button"
              disabled
              aria-disabled="true"
              title={`${item} is coming soon`}
              className={`flex w-full cursor-not-allowed items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium ${dark ? 'text-white/35' : 'text-[#9AA3B2]'}`}
            >
              <span className="flex items-center gap-3">{itemIcon(item)}{item}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${dark ? 'text-white/25' : 'text-[#B0B8C5]'}`}>Soon</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

function UserSummary({ user, dark }: { user: { firstName: string; email: string; roles: string[] } | null; dark: boolean }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${dark ? 'bg-white/12 text-white' : 'bg-[#DCE8FF] text-[#1657CF]'}`}>
        {user?.firstName.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold ${dark ? 'text-white' : 'text-[#0D1524]'}`}>{user?.firstName}</p>
        <p className={`truncate text-xs ${dark ? 'text-white/45' : 'text-[#828B9B]'}`}>{user?.email}</p>
      </div>
    </div>
  );
}

function LogoutButton({ onLogout, loggingOut, dark }: { onLogout: () => Promise<void>; loggingOut: boolean; dark: boolean }) {
  return (
    <button
      type="button"
      onClick={() => void onLogout()}
      disabled={loggingOut}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#1657CF] disabled:cursor-wait disabled:opacity-60 ${dark ? 'text-white/65 hover:bg-white/8 hover:text-white' : 'text-[#48505F] hover:bg-[#F0F4FA]'}`}
    >
      <LogoutIcon />
      {loggingOut ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-10 w-10 place-items-center rounded-xl text-lg font-bold ${inverse ? 'bg-white text-[#1657CF]' : 'bg-[#1657CF] text-white'}`}>U</span>
      <span className={`text-xl font-bold tracking-[-0.04em] ${inverse ? 'text-white' : 'text-[#0D1524]'}`}>Universta</span>
    </div>
  );
}

function itemIcon(item: string) {
  return <span aria-hidden="true" className="grid h-5 w-5 place-items-center text-[10px]">{item.slice(0, 1)}</span>;
}

function GridIcon() {
  return <span aria-hidden="true" className="grid h-5 w-5 grid-cols-2 gap-0.5"><i className="rounded-sm bg-current" /><i className="rounded-sm bg-current" /><i className="rounded-sm bg-current" /><i className="rounded-sm bg-current" /></span>;
}

function MenuIcon() {
  return <span aria-hidden="true" className="flex w-5 flex-col gap-1"><i className="h-0.5 w-full bg-current" /><i className="h-0.5 w-full bg-current" /><i className="h-0.5 w-full bg-current" /></span>;
}

function CloseIcon() {
  return <span aria-hidden="true" className="relative block h-5 w-5"><i className="absolute left-0 top-2.5 h-0.5 w-5 rotate-45 bg-current" /><i className="absolute left-0 top-2.5 h-0.5 w-5 -rotate-45 bg-current" /></span>;
}

function LogoutIcon() {
  return <span aria-hidden="true" className="text-base">↪</span>;
}
