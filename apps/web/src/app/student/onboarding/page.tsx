import { StudentShell } from '@/components/student/StudentShell';
import { StudentOnboarding } from '@/components/student/StudentOnboarding';

export default function Page() {
  return (
    <StudentShell>
      <StudentOnboarding />
    </StudentShell>
  );
}
