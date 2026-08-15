import { StudentShell } from "@/components/student/StudentShell";
import { StudentPhase2Page } from "@/components/student/StudentPhase2Pages";
export default function Page() {
  return (
    <StudentShell>
      <StudentPhase2Page mode="recommendations" />
    </StudentShell>
  );
}
