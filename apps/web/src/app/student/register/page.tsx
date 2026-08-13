import type { Metadata } from 'next';
import { StudentRegister } from '@/components/student/StudentAuthForms';

export const metadata: Metadata = {
  title: 'Create your account | Universta',
  robots: { index: false, follow: false },
};

export default function StudentRegisterPage() {
  return <StudentRegister />;
}
