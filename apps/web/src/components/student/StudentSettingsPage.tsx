'use client';

import { useState } from 'react';
import { useStudentSession } from './StudentSession';

/** Account, not preferences. Only what a student can actually change today. */
export function StudentSettingsPage() {
  const { student, signOut } = useStudentSession();
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!student) return null;

  const resend = async () => {
    setBusy(true);
    await fetch('/api/student/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: student.email }),
    }).catch(() => undefined);
    setResent(true);
    setBusy(false);
  };

  return (
    <>
      <h1>Your account</h1>
      <p className="lede">Your sign-in details and email address.</p>

      <section className="stu-card" aria-labelledby="account-heading">
        <h2 id="account-heading">Details</h2>
        <div className="stu-row">
          <div>
            <h3>Name</h3>
            <p className="meta">
              {student.firstName} {student.lastName ?? ''}
            </p>
          </div>
        </div>
        <div className="stu-row">
          <div>
            <h3>Email address</h3>
            <p className="meta">{student.email}</p>
          </div>
          {student.emailVerified ? (
            <span className="meta">Verified ✓</span>
          ) : (
            <button
              type="button"
              className="stu-btn ghost"
              onClick={() => void resend()}
              disabled={busy || resent}
            >
              {resent ? 'Link sent' : 'Resend verification'}
            </button>
          )}
        </div>
      </section>

      <section className="stu-card" aria-labelledby="security-heading">
        <h2 id="security-heading">Security</h2>
        <p className="stu-empty">
          To change your password, sign out and use “Forgotten your password?”.
        </p>
        <div className="stu-actions">
          <button
            type="button"
            className="stu-btn ghost"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </section>
    </>
  );
}
