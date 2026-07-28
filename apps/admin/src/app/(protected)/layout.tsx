import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ProtectedBoundary } from '@/features/auth/AuthProvider';
import { AdminShell } from '@/features/shell/AdminShell';
import { hasValidAdminSession } from '@/lib/server/session';

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
