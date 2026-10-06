'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SubjectBranch } from '@/lib/catalog';
import { formatNumber } from '@/lib/format';
import { mergeLevels, sortByLevelOrder } from '@/lib/level-order';

/**
 * A subject's specializations, filtered by the level they are taught at.
 *
 * The reference filters its grid on the levels each branch carries, so the bar
 * is built from the levels that actually appear across these branches: it can
 * never offer a level that would empty the grid, and it stands down entirely
 * when the catalogue has not recorded a level for any of them.
 *
 * Levels read in the order a student climbs them, on the bar and on each
 * card. Merged in the order they were met, the bar opened "PhD, Diploma,
 * Bachelor's".
 */
export function SubjectSpecializations({
  subjectName,
  subjectSlug,
  branches,
  levelOrder = [],
  noun = 'programme',
}: {
  subjectName: string;
  subjectSlug: string;
  branches: SubjectBranch[];
  /** Level codes in academic order: the subject's own levels, which the
   *  page already has in that order. */
  levelOrder?: string[];
  /** What each card's count is called. The counts are of the catalogue's
   *  courses; beside the universities' programmes they are called that, so
   *  "6 programmes" does not open a page that lists 34. */
  noun?: 'programme' | 'course';
}) {
  const levels = useMemo(
    () =>
      mergeLevels(
        branches.map((branch) => branch.levels),
        levelOrder,
        (level) => level.id,
      ).map(({ id, name }) => ({ id, name })),
    [branches, levelOrder],
  );

  const [level, setLevel] = useState('all');
  const shown =
    level === 'all'
      ? branches
      : branches.filter((branch) => (branch.levels ?? []).some((row) => row.id === level));

  return (
    <>
      {levels.length > 1 ? (
        <div className="levelbar" role="group" aria-label="Study level">
          <button
            className="chipbtn"
            type="button"
            aria-pressed={level === 'all'}
            onClick={() => setLevel('all')}
          >
            All levels
          </button>
          {levels.map((row) => (
            <button
              key={row.id}
              className="chipbtn"
              type="button"
              aria-pressed={level === row.id}
              onClick={() => setLevel(row.id)}
            >
              {row.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="specgrid">
        {shown.map((row) => (
          <article className="speccard" key={row.id}>
            <Link className="speccard__btn" href={`/subjects/${subjectSlug}/${row.slug}`}>
              <span className="speccard__top">
                <span className="label">Specialization</span>
              </span>
              <span className="speccard__name">{row.name}</span>
              {row.shortDescription ? (
                <span className="speccard__desc">{row.shortDescription}</span>
              ) : null}
              {/* The foot only appears once there is something to put in it:
                  an empty rule above blank space reads as a broken card. */}
              {row.levels?.length || row.publishedCourseCount ? (
                <span className="speccard__foot">
                  <span className="speccard__levels">
                    {sortByLevelOrder(row.levels ?? [], levelOrder)
                      .map((item) => item.name)
                      .join(', ')}
                  </span>
                  {row.publishedCourseCount ? (
                    <span className="speccard__count datum">
                      {formatNumber(row.publishedCourseCount)}{' '}
                      {row.publishedCourseCount === 1 ? noun : `${noun}s`}
                    </span>
                  ) : null}
                </span>
              ) : null}
              <span className="speccard__cta">
                Explore specialization <span aria-hidden="true">→</span>
              </span>
            </Link>
          </article>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="sec-lead">
          No {subjectName} specializations are recorded at that level yet.
        </p>
      ) : null}
    </>
  );
}
