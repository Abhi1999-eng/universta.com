import { StudentShell } from '@/components/student/StudentShell';
import { StudentDocumentsPage } from '@/components/student/StudentDocumentsPage';

export default function Page() {
  return (
    <StudentShell>
      <StudentDocumentsPage />
    </StudentShell>
  );
}
