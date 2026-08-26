'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRequireStudent } from './StudentSession';

/**
 * The portal frame.
 *
 * Only the destinations that exist today appear. A nav full of greyed-out
 * promises tells a student the product is unfinished; the rest of Phase 2 can
 * add its own entries when it ships.
 *
 * The reverse also has to hold: a page that ships needs a way in. Deadlines
 * shipped with no link to it from anywhere in the product, so it is listed
 * here, and the More menu carries the entries this list does not.
 */

const NAV = [
  { href: '/student', label: 'Home', icon: '🏠' },
  { href: '/student/applications', label: 'My applications', icon: '🎓' },
  { href: '/student/saved#universities', label: 'My universities', icon: '🏛️' },
  { href: '/student/saved#courses', label: 'My courses', icon: '📚' },
  { href: '/student/scholarships', label: 'My scholarships', icon: '🏅' },
  { href: '/student/deadlines', label: 'Upcoming deadlines', icon: '📅' },
  { href: '/student/documents', label: 'Documents', icon: '📄' },
  { href: '/student/referrals', label: 'Refer & earn', icon: '🎁' },
  { href: '/student/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/student/support', label: 'Support', icon: '💬' },
  { href: '/student/profile', label: 'Profile', icon: '👤' },
] as const;

/* The tab bar gets its own labels, not the sidebar's. Five tabs share a 390px
 * phone, so each slot is about 76px: "My applications" wrapped onto a second
 * line there and made that one tab 18px taller than its neighbours. The Saved
 * entry was already shortened this way; Applications simply had not been. */
const MOBILE_NAV = [
  { href: '/student', label: 'Home', icon: '🏠' },
  { href: '/student/applications', label: 'Applications', icon: '🎓' },
  { href: '/student/saved', label: 'Saved', icon: '🔖' },
  { href: '/student/messages', label: 'Messages', icon: '💬' },
] as const;

/** The route part of a nav href, without any `#section` the sidebar links to.
 *
 * Two sidebar entries deep-link into `/student/saved`, so comparing a pathname
 * against the raw href never matched and that page was left with no highlighted
 * nav item and no breadcrumb. */
function routeOf(href: string) {
  return href.split('#')[0];
}

/** Every destination a signed-in student can land on, and what to call it.
 *
 * The sidebar cannot be the only source. Recommendations, Settings, Messages,
 * More and Onboarding are all reachable without appearing in it, and deriving
 * the breadcrumb from the sidebar alone left each of them with no breadcrumb
 * at all. */
const ROUTE_LABELS: Array<[string, string]> = [
  ['/student/applications', 'My applications'],
  ['/student/saved', 'Saved items'],
  ['/student/scholarships', 'My scholarships'],
  ['/student/documents', 'Documents'],
  ['/student/deadlines', 'Upcoming deadlines'],
  ['/student/recommendations', 'Recommended for you'],
  ['/student/messages', 'Messages'],
  ['/student/notifications', 'Notifications'],
  ['/student/support', 'Support'],
  ['/student/referrals', 'Refer & earn'],
  ['/student/profile', 'Profile'],
  ['/student/settings', 'Your account'],
  ['/student/more', 'More'],
  ['/student/onboarding', 'Your study profile'],
];

/** Breadcrumb trail below the header, or null on the dashboard root itself.
 *
 * Each entry carries the href of the page it names, so a detail page's parent
 * is a real link rather than inert text. */
function breadcrumbFor(pathname: string): Array<{ label: string; href?: string }> | null {
  if (pathname === '/student') return null;
  if (pathname.startsWith('/student/applications/')) {
    return [
      { label: 'My applications', href: '/student/applications' },
      { label: 'Application' },
    ];
  }
  if (pathname.startsWith('/student/scholarships/')) {
    return [
      { label: 'My scholarships', href: '/student/scholarships' },
      { label: 'Application' },
    ];
  }
  const match = ROUTE_LABELS.find(([href]) => pathname.startsWith(href));
  return match ? [{ label: match[1] }] : null;
}

export function StudentShell({ children }: { children: React.ReactNode }) {
  const { status, student, signOut } = useRequireStudent();
  const pathname = usePathname();
  /* The hash never reaches the server and does not re-render on its own, so it
   * is mirrored into state and kept in step with in-page section links. */
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [pathname]);

  if (status !== 'authenticated' || !student) {
    return (
      <div className="stu">
        <div className="stu-shell">
          <p className="stu-empty" role="status">
            Loading your portal…
          </p>
        </div>
      </div>
    );
  }

  /* Exactly one entry may be the current page. Two sidebar entries deep-link
   * into different sections of /student/saved, so when several share a route
   * the hash decides between them — and with no hash the page opens on the
   * first of them. */
  const current = (href: string) => {
    const route = routeOf(href);
    const onRoute =
      route === '/student' ? pathname === route : pathname.startsWith(route);
    if (!onRoute) return false;
    const siblings = NAV.filter((entry) => routeOf(entry.href) === route);
    if (siblings.length < 2) return true;
    const active =
      siblings.find((entry) => entry.href === `${route}${hash}`) ?? siblings[0];
    return active.href === href;
  };
  const breadcrumb = breadcrumbFor(pathname);

  return (
    <div className="stu">
      <div className="stu-shell">
        <nav className="stu-nav" aria-label="Student portal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current(item.href) ? 'page' : undefined}
            >
              <span className="ic" aria-hidden="true">
                {item.icon}
              </span>
              <span className="stu-nav-label">{item.label}</span>
            </Link>
          ))}
          <div className="stu-account">
            <p>
              {student.firstName} {student.lastName ?? ''}
            </p>
            <span>{student.email}</span>
            <div className="stu-actions">
              <Link href="/student/settings" className="stu-btn ghost">
                Account
              </Link>
              <button
                type="button"
                className="stu-btn ghost"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          </div>
        </nav>

        <div>
          {breadcrumb ? (
            <nav className="stu-breadcrumbs" aria-label="Breadcrumb">
              <Link href="/student">Dashboard</Link>
              {/* One <span> per crumb: the separator is drawn by
                * `.stu-breadcrumbs span::before`, so nesting a second span
                * inside would print it twice. */}
              {breadcrumb.map((entry, index) => (
                <span
                  key={`${entry.label}-${index}`}
                  aria-current={
                    !entry.href && index === breadcrumb.length - 1
                      ? 'page'
                      : undefined
                  }
                >
                  {entry.href ? (
                    <Link href={entry.href}>{entry.label}</Link>
                  ) : (
                    entry.label
                  )}
                </span>
              ))}
            </nav>
          ) : null}
          {children}
        </div>
      </div>

      <nav className="stu-tabbar" aria-label="Student portal">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current(item.href) ? 'page' : undefined}
          >
            <span className="ic" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
        <Link
          href="/student/more"
          aria-current={current('/student/more') ? 'page' : undefined}
        >
          <span className="ic" aria-hidden="true">
            ⚙️
          </span>
          More
        </Link>
      </nav>
    </div>
  );
}
