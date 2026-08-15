import Link from 'next/link';
import { StudentShell } from '@/components/student/StudentShell';

const links = [
  ['My scholarships', '/student/scholarships'],
  ['Documents', '/student/documents'],
  ['Refer & earn', '/student/referrals'],
  ['Notifications', '/student/notifications'],
  ['Support', '/student/support'],
  ['Profile', '/student/profile'],
] as const;

export default function Page() {
  return <StudentShell><h1>More</h1><section className="stu-card">{links.map(([label, href]) => <Link key={href} className="stu-row" href={href}>{label} <span aria-hidden="true">→</span></Link>)}</section></StudentShell>;
}
