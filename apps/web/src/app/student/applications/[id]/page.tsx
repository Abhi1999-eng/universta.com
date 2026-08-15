import { StudentApplicationDetail } from '@/components/student/StudentApplicationDetail';
import { StudentShell } from '@/components/student/StudentShell';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentShell><StudentApplicationDetail id={id} /></StudentShell>;
}
