import { StudentScholarshipApplicationDetail } from '@/components/student/StudentScholarshipApplicationDetail';
import { StudentShell } from '@/components/student/StudentShell';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentShell><StudentScholarshipApplicationDetail id={id} /></StudentShell>;
}
