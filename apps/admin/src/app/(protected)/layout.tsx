import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ProtectedBoundary } from '@/features/auth/AuthProvider';
import { AdminShell } from '@/features/shell/AdminShell';
import { hasValidAdminSession } from '@/lib/server/session';

/** Every screen in this segment is behind a session check and renders
 * per-request data, so none of it can be usefully prerendered.
 *
 * Marking the segment dynamic is also what stops an intermittent build
 * failure: Next static-exports these pages across parallel workers, and one
 * run in roughly six died with "Cannot read properties of null (reading
 * 'useContext')" while exporting a protected page -- a different page each
 * time. The same failure was patched once before on `/` alone; declaring it
 * here covers the whole segment, so a deploy cannot fail on a coin flip. */
export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const refreshCookieName = process.env.AUTH_REFRESH_COOKIE_NAME ?? 'universta_admin_refresh';
  const refreshToken = (await cookies()).get(refreshCookieName)?.value;
  if (!(await hasValidAdminSession(refreshToken))) {
    redirect('/login?returnTo=%2Fdashboard');
  }
  return (
    <ProtectedBoundary>
      <AdminShell>{children}</AdminShell>
    </ProtectedBoundary>
  );
}
