import { StudentShell } from '@/components/student/StudentShell';
import { StudentProfilePage } from '@/components/student/StudentProfilePage';

export default function Page() {
  return (
    <StudentShell>
      <StudentProfilePage />
    </StudentShell>
  );
}
