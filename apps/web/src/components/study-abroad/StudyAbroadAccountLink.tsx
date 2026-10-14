'use client';

import Link from 'next/link';
import { useStudentSessionIfAny } from '@/components/student/StudentSession';

/**
 * The design header's account entry. It read "Log in" for everyone, a
 * signed-in student included; the site header already knew the session.
 * Signed in, it leads to the dashboard; otherwise, and until the session
 * is known, to the login. Outside the session provider it is the login.
 */
export function StudyAbroadAccountLink({ className, onClick }: { className?: string; onClick?: () => void }) {
  const session = useStudentSessionIfAny();
  const signedIn = session?.status === 'authenticated';
  return (
    <Link className={className} href={signedIn ? '/student' : '/student/login'} onClick={onClick}>
      {signedIn ? 'My Dashboard' : 'Log in'}
    </Link>
  );
}
