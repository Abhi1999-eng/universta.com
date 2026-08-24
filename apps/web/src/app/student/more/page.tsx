import Link from 'next/link';
import { StudentShell } from '@/components/student/StudentShell';

/* Everything the bottom bar has no room for. The account entry matters most:
 * it otherwise appears only in the sidebar, which a phone never shows, leaving
 * account settings unreachable below 900px. */
const links = [
  ['My scholarships', '/student/scholarships'],
  ['Upcoming deadlines', '/student/deadlines'],
  ['Recommended for you', '/student/recommendations'],
  ['Documents', '/student/documents'],
  ['Refer & earn', '/student/referrals'],
  ['Notifications', '/student/notifications'],
  ['Support', '/student/support'],
  ['Profile', '/student/profile'],
  ['Your account', '/student/settings'],
] as const;

export default function Page() {
  return <StudentShell><h1>More</h1><section className="stu-card">{links.map(([label, href]) => <Link key={href} className="stu-row" href={href}>{label} <span aria-hidden="true">→</span></Link>)}</section></StudentShell>;
}
