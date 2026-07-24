import { ProtectedBoundary } from '@/features/auth/AuthProvider';
import { AdminShell } from '@/features/shell/AdminShell';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedBoundary>
      <AdminShell>{children}</AdminShell>
    </ProtectedBoundary>
  );
}
