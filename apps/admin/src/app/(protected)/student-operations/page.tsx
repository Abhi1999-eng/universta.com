import type { Metadata } from "next";
import { StudentOperationsManager } from "@/features/student-operations/StudentOperationsManager";
export const metadata: Metadata = {
  title: "Student operations | Universta Admin",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StudentOperationsManager />;
}
