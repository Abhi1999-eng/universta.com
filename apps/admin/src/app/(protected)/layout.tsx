import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ProtectedBoundary } from '@/features/auth/AuthProvider';
import { AdminShell } from '@/features/shell/AdminShell';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const refreshCookieName = process.env.AUTH_REFRESH_COOKIE_NAME ?? 'universta_admin_refresh';
  if (!(await cookies()).has(refreshCookieName)) {
    redirect('/login?returnTo=%2Fdashboard');
  }
  return (
    <ProtectedBoundary>
      <AdminShell>{children}</AdminShell>
    </ProtectedBoundary>
  );
}
