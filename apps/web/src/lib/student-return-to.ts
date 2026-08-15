const STUDENT_PORTAL_HOME = '/student';

/** Keep student post-authentication navigation inside this same origin. */
export function safeStudentReturnTo(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return STUDENT_PORTAL_HOME;
  }

  return value;
}

export function studentLoginHref(returnTo: string): string {
  return `/student/login?returnTo=${encodeURIComponent(safeStudentReturnTo(returnTo))}`;
}

export function studentRegisterHref(returnTo: string): string {
  return `/student/register?returnTo=${encodeURIComponent(safeStudentReturnTo(returnTo))}`;
}
