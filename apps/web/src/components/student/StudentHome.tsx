"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStudentSession } from "./StudentSession";
import type { Completion } from "./student-types";

type Dashboard = {
  applications: number;
  scholarshipApplications: number;
  unreadNotifications: number;
  consultant: {
    name: string;
    slug: string;
    email: string | null;
    phone: string | null;
  } | null;
  referralCode: string;
  nearestDeadline: { label: string; date: string; href: string } | null;
  recommendationPreview: {
    id: string;
    name: string;
    slug: string;
    reason: string;
    university: { slug: string };
  }[];
  nextAction: { label: string; href: string };
};

/** "1 application", not "1 applications". These counters are frequently 1. */
function count(value: number, noun: string) {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

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
    void Promise.all([
      api<Completion>("/profile/completion"),
      api<Dashboard>("/dashboard"),
    ])
      .then(([nextCompletion, nextDashboard]) => {
        setCompletion(nextCompletion);
        setDashboard(nextDashboard);
      })
      .catch(() => setFailed(true));
  }, [api]);

  const first = student?.firstName ?? "there";

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
              <span style={{ fontSize: 15, fontWeight: 500, color: "#6b7688" }}>
                {" "}
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

      <section className="stu-card" aria-labelledby="explore-heading">
        <h2 id="explore-heading">Explore Universta</h2>
        <p className="lede">
          Browse published options, then return here whenever you are ready to
          save or apply.
        </p>
        <div className="stu-actions">
          <Link className="stu-btn ghost" href="/universities">
            Explore universities
          </Link>
          <Link className="stu-btn ghost" href="/courses">
            Explore courses
          </Link>
          <Link className="stu-btn ghost" href="/countries">
            Explore countries
          </Link>
          <Link className="stu-btn ghost" href="/scholarships">
            Explore scholarships
          </Link>
          <Link className="stu-btn ghost" href="/study-abroad-consultants">
            Explore consultants
          </Link>
        </div>
      </section>

      <section className="stu-card" aria-labelledby="journey-heading">
        <h2 id="journey-heading">Your journey</h2>
        {dashboard ? (
          <div className="stu-actions">
            <Link className="stu-btn ghost" href="/student/applications">
              {count(dashboard.applications, 'application')}
            </Link>
            <Link className="stu-btn ghost" href="/student/scholarships">
              {count(dashboard.scholarshipApplications, 'scholarship')}
            </Link>
            <Link className="stu-btn ghost" href="/student/notifications">
              {count(dashboard.unreadNotifications, 'unread update')}
            </Link>
          </div>
        ) : (
          <p className="stu-empty">Loading your journey…</p>
        )}
        {dashboard?.consultant ? (
          <p className="stu-next">
            Your assigned consultant: {dashboard.consultant.name}
          </p>
        ) : null}
        {dashboard?.nearestDeadline ? (
          <p className="stu-next">
            Nearest deadline:{" "}
            <Link href={dashboard.nearestDeadline.href}>
              {dashboard.nearestDeadline.label}
            </Link>{" "}
            (
            {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
              new Date(dashboard.nearestDeadline.date),
            )}
            )
          </p>
        ) : null}
        {dashboard?.nextAction ? (
          <Link className="stu-btn" href={dashboard.nextAction.href}>
            {dashboard.nextAction.label}
          </Link>
        ) : null}
      </section>

      {dashboard?.recommendationPreview.length ? (
        <section className="stu-card" aria-labelledby="recommendations-heading">
          <h2 id="recommendations-heading">Recommended next</h2>
          {dashboard.recommendationPreview.map((offering) => (
            <div className="stu-row" key={offering.id}>
              <div>
                <h3>{offering.name}</h3>
                <p className="meta">{offering.reason}</p>
              </div>
              <Link
                className="stu-btn ghost"
                href={`/universities/${offering.university.slug}/courses/${offering.slug}`}
              >
                View course
              </Link>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
