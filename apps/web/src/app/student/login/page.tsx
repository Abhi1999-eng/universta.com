import type { Metadata } from 'next';
import { StudentLogin } from '@/components/student/StudentAuthForms';

export const metadata: Metadata = {
  title: 'Sign in | Universta',
  robots: { index: false, follow: false },
};

export default function StudentLoginPage() {
  return <StudentLogin />;
}
