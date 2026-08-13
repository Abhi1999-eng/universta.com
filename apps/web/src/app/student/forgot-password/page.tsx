import type { Metadata } from 'next';
import { StudentForgotPassword } from '@/components/student/StudentAuthForms';

export const metadata: Metadata = {
  title: 'Reset your password | Universta',
  robots: { index: false, follow: false },
};

export default function StudentForgotPasswordPage() {
  return <StudentForgotPassword />;
}
