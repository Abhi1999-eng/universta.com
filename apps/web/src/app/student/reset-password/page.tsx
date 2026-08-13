import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StudentResetPassword } from '@/components/student/StudentAuthForms';

export const metadata: Metadata = {
  title: 'Choose a new password | Universta',
  robots: { index: false, follow: false },
};

export default function StudentResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <StudentResetPassword />
    </Suspense>
  );
}
