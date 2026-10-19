'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useStudentSessionIfAny } from '@/components/student/StudentSession';
import { COMPARE_LIMIT, compareHref } from '@/lib/course-compare';
import { studentLoginHref } from '@/lib/student-return-to';
import { programmeName } from '@/lib/university-courses';
import { SectionHead } from './SectionHead';

/**
 * "My saved courses", under the comparison on /compare/courses, as the
 * design's compare page has it.
 *
 * The heart on a course card saves the programme to the student's account
 * (signed out, it leads to the student login), so the list is read from
 * that account: each saved programme, and "Add to comparison" beside it
 * while the comparison has room. Signed out, the band says where the list
 * comes from and offers the sign-in.
 */

export type SavedCourse = {
  slug: string;
  name: string;
  university: string | null;
  /** Still published: only those can be compared. */
  live: boolean;
};

/** The student API's saved offerings as the band lists them. */
export function toSavedCourses(raw: unknown): SavedCourse[] {
  const rows = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  return rows.flatMap((entry) => {
    const offering =
      entry && typeof entry === 'object'
        ? ((entry as { offering?: unknown }).offering as Record<string, unknown> | undefined)
        : undefined;
    const slug = typeof offering?.slug === 'string' ? offering.slug : null;
    const name = typeof offering?.name === 'string' ? offering.name : null;
    if (!slug || !name || seen.has(slug)) return [];
    seen.add(slug);
    const university = offering?.university as { name?: unknown } | undefined;
    const universityName = typeof university?.name === 'string' ? university.name : null;
    return [
      {
        slug,
        name: programmeName(name, universityName),
        university: universityName,
        live: offering?.status === 'PUBLISHED',
      },
    ];
  });
}

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'failed' }
  | { kind: 'ready'; rows: SavedCourse[] };

export function SavedCourses({
  picked,
  returnTo = '/compare/courses',
}: {
  /** The programmes already in the comparison, in its order. */
  picked: string[];
  /** Where the sign-in comes back to. */
  returnTo?: string;
}) {
  const session = useStudentSessionIfAny();
  const status = session?.status ?? 'anonymous';
  const api = session?.api;
  /* What the account answered; the band's other states follow from the
     session itself. */
  const [answer, setAnswer] = useState<SavedCourse[] | 'failed' | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !api) return;
    let live = true;
    api<{ offerings?: unknown }>('/saved')
      .then((saved) => {
        if (live) setAnswer(toSavedCourses(saved?.offerings));
      })
      .catch(() => {
        if (live) setAnswer('failed');
      });
    return () => {
      live = false;
    };
  }, [status, api]);

  const state: State =
    status === 'loading'
      ? { kind: 'loading' }
      : status !== 'authenticated'
        ? { kind: 'signed-out' }
        : answer === null
          ? { kind: 'loading' }
          : answer === 'failed'
            ? { kind: 'failed' }
            : { kind: 'ready', rows: answer };

  return <SavedCoursesBand state={state} picked={picked} returnTo={returnTo} />;
}

/** The band itself, for each state the account can be in. */
export function SavedCoursesBand({
  state,
  picked,
  returnTo,
}: {
  state: State;
  picked: string[];
  returnTo: string;
}) {
  const full = picked.length >= COMPARE_LIMIT;
  return (
    <section className="sec sec--paper cg-band" id="saved-courses">
      <div className="wrap">
        <SectionHead
          eyebrow="Your account"
          title="My saved courses"
          lead={
            state.kind === 'ready' && state.rows.length
              ? 'The courses you saved with the heart. Add any of them to the comparison above.'
              : undefined
          }
        >
          {state.kind === 'loading' ? (
            <p className="sec-lead" role="status">
              Looking for your saved courses&hellip;
            </p>
          ) : state.kind === 'signed-out' ? (
            <p className="sec-lead">
              Courses you save with the heart on a course card are kept in your
              student account and listed here, ready to compare.{' '}
              <Link className="savedcourses__signin" href={studentLoginHref(returnTo)}>
                Sign in to see them &rarr;
              </Link>
            </p>
          ) : state.kind === 'failed' ? (
            <p className="sec-lead" role="status">
              Your saved courses could not be loaded just now. Please try again
              in a moment.
            </p>
          ) : !state.rows.length ? (
            <p className="sec-lead">
              You have not saved a course yet. Tap the heart on a programme you
              like and it will be kept here for you to compare.
            </p>
          ) : null}
        </SectionHead>

        {state.kind === 'ready' && state.rows.length ? (
          <ul className="savedcourses">
            {state.rows.map((row) => {
              const inComparison = picked.includes(row.slug);
              return (
                <li className="savedcourses__row" key={row.slug}>
                  <span className="savedcourses__name">
                    <b>{row.name}</b>
                    {row.university ? <em>{row.university}</em> : null}
                  </span>
                  {!row.live ? (
                    <span className="badge badge--neutral">No longer listed</span>
                  ) : inComparison ? (
                    <span className="badge badge--ok">In the comparison</span>
                  ) : full ? (
                    <span className="savedcourses__note">
                      {`Up to ${COMPARE_LIMIT} courses: remove one to add this`}
                    </span>
                  ) : (
                    <Link
                      className="btn btn--sm btn--ghost"
                      href={compareHref([...picked, row.slug])}
                    >
                      Add to comparison
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
