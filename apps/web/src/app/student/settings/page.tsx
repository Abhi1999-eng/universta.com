import { StudentShell } from '@/components/student/StudentShell';
import { StudentSettingsPage } from '@/components/student/StudentSettingsPage';

export default function Page() {
  return (
    <StudentShell>
      <StudentSettingsPage />
    </StudentShell>
  );
}
