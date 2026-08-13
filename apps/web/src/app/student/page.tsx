import { StudentShell } from '@/components/student/StudentShell';
import { StudentHome } from '@/components/student/StudentHome';

export default function Page() {
  return (
    <StudentShell>
      <StudentHome />
    </StudentShell>
  );
}
