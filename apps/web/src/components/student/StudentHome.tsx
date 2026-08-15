'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStudentSession } from './StudentSession';
import type { Completion } from './student-types';

type Dashboard = {
  applications: number;
  scholarshipApplications: number;
  unreadNotifications: number;
  consultant: { name: string; slug: string; email: string | null; phone: string | null } | null;
  referralCode: string;
  nextAction: { label: string; href: string };
};

/**
 * Home.
 *
 * One question answered: what should I do next. The percentage and the next
 * step both come from the API — nothing here recomputes them — and no module
 * that has not shipped is represented with a number.
 */
export function StudentHome() {
  const { api, student } = useStudentSession();
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void Promise.all([api<Completion>('/profile/completion'), api<Dashboard>('/dashboard')])
      .then(([nextCompletion, nextDashboard]) => {
        setCompletion(nextCompletion);
        setDashboard(nextDashboard);
      })
      .catch(() => setFailed(true));
  }, [api]);

  const first = student?.firstName ?? 'there';

  return (
    <>
      <h1>Welcome back, {first} 👋</h1>
      <p className="lede">Let’s keep building your study profile.</p>

      {student && !student.emailVerified ? (
        <p className="stu-alert info">
          Confirm your email address when you get a moment — we sent you a link.
        </p>
      ) : null}

      {failed ? (
        <p className="stu-alert error" role="alert">
          We could not load your profile just now. Please refresh.
        </p>
      ) : null}

      <section className="stu-card" aria-labelledby="progress-heading">
        <h2 id="progress-heading">Your profile</h2>
        {completion ? (
          <>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
              {completion.percentage}%
              <span
                style={{ fontSize: 15, fontWeight: 500, color: '#6b7688' }}
              >
                {' '}
                complete
              </span>
            </p>
            <div
              className="stu-progress"
              role="progressbar"
              aria-valuenow={completion.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completion"
            >
              <i style={{ width: `${completion.percentage}%` }} />
            </div>
            {completion.nextSectionLabel ? (
              <>
                <p className="stu-next">
                  Next step: {completion.nextSectionLabel}
                </p>
                <Link className="stu-btn" href="/student/onboarding">
                  Continue profile
                </Link>
              </>
            ) : (
              <p className="stu-alert ok" role="status">
                Your profile is complete. Nice work.
              </p>
            )}
          </>
        ) : (
          <p className="stu-empty">Loading…</p>
        )}
      </section>

      <section className="stu-card" aria-labelledby="quick-heading">
        <h2 id="quick-heading">Quick actions</h2>
        <div className="stu-actions">
          <Link className="stu-btn ghost" href="/student/profile">
            Complete profile
          </Link>
          <Link className="stu-btn ghost" href="/student/documents">
            Upload documents
          </Link>
        </div>
      </section>

      <section className="stu-card" aria-labelledby="journey-heading">
        <h2 id="journey-heading">Your journey</h2>
        {dashboard ? (
          <div className="stu-actions">
            <Link className="stu-btn ghost" href="/student/applications">{dashboard.applications} applications</Link>
            <Link className="stu-btn ghost" href="/student/scholarships">{dashboard.scholarshipApplications} scholarships</Link>
            <Link className="stu-btn ghost" href="/student/notifications">{dashboard.unreadNotifications} unread updates</Link>
          </div>
        ) : <p className="stu-empty">Loading your journey…</p>}
        {dashboard?.consultant ? <p className="stu-next">Your assigned consultant: {dashboard.consultant.name}</p> : null}
        {dashboard?.nextAction ? <Link className="stu-btn" href={dashboard.nextAction.href}>{dashboard.nextAction.label}</Link> : null}
      </section>
    </>
  );
}
