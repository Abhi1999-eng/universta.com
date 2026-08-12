import type { Metadata } from 'next';
import { Suspense } from 'react';
import { StudentVerifyEmail } from '@/components/student/StudentAuthForms';

export const metadata: Metadata = {
  title: 'Verify your email | Universta',
  robots: { index: false, follow: false },
};

export default function StudentVerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <StudentVerifyEmail />
    </Suspense>
  );
}
