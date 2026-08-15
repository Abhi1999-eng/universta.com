'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRequireStudent } from './StudentSession';

/**
 * The portal frame.
 *
 * Only the destinations that exist today appear. A nav full of greyed-out
 * promises tells a student the product is unfinished; the rest of Phase 2 can
 * add its own entries when it ships.
 */

const NAV = [
  { href: '/student', label: 'Home', icon: '🏠' },
  { href: '/student/applications', label: 'My applications', icon: '🎓' },
  { href: '/student/saved#universities', label: 'My universities', icon: '🏛️' },
  { href: '/student/saved#courses', label: 'My courses', icon: '📚' },
  { href: '/student/scholarships', label: 'My scholarships', icon: '🏅' },
  { href: '/student/documents', label: 'Documents', icon: '📄' },
  { href: '/student/referrals', label: 'Refer & earn', icon: '🎁' },
  { href: '/student/notifications', label: 'Notifications', icon: '🔔' },
  { href: '/student/support', label: 'Support', icon: '💬' },
  { href: '/student/profile', label: 'Profile', icon: '👤' },
] as const;

const MOBILE_NAV = [
  NAV[0],
  NAV[1],
  { href: '/student/saved', label: 'Saved', icon: '🔖' },
  { href: '/student/messages', label: 'Messages', icon: '💬' },
] as const;

export function StudentShell({ children }: { children: React.ReactNode }) {
  const { status, student, signOut } = useRequireStudent();
  const pathname = usePathname();

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

  const current = (href: string) =>
    href === '/student' ? pathname === href : pathname.startsWith(href);

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
              {item.label}
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

        <div>{children}</div>
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
