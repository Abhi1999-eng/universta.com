'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SubjectBranch } from '@/lib/catalog';
import { formatNumber } from '@/lib/format';
import { mergeLevels, sortByLevelOrder } from '@/lib/level-order';
import { levelPageLinks } from '@/lib/subject-levels';
import { CardMedia, PopularBadge } from './CardMedia';
import { LevelLinks } from './LevelLinks';

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
  hrefBase,
  limit,
  levelLabel = 'Study level',
  levelLinks,
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
  /** Where the cards open: the subject's page by default, or the subject in
   *  one destination. */
  hrefBase?: string;
  /** How many cards show before "Show all"; the rest stay in the page,
   *  hidden, so every specialization is still linked. */
  limit?: number;
  levelLabel?: string;
  /** Link each card's levels to the specialization's page at that level,
   *  given the catalogue's active level codes in climbing order (empty when
   *  that read failed). Off by default: a subject in one destination draws
   *  these cards too, and its cards open that destination's pages. */
  levelLinks?: {
    catalogue: string[];
    /** The order the links follow where the catalogue could not be read:
     *  `levelOrder` names only the levels with courses filed at them. */
    order?: string[];
  };
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
  const [all, setAll] = useState(false);
  const base = hrefBase ?? `/subjects/${subjectSlug}`;
  const shown =
    level === 'all'
      ? branches
      : branches.filter((branch) => (branch.levels ?? []).some((row) => row.id === level));

  return (
    <>
      {levels.length > 1 ? (
        <div className="levelbar" role="group" aria-label={levelLabel}>
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
        {shown.map((row, index) => {
          const href = `${base}/${row.slug}`;
          /* Its levels, each linked to its page at that level. A link can
             not sit inside the card's own link, so a card with levels to
             link stretches its name's link over the whole card instead. */
          const links = levelLinks
            ? levelPageLinks(
                sortByLevelOrder(row.levels ?? [], levelLinks.order ?? levelOrder),
                { subject: subjectSlug, specialization: row.slug },
                levelLinks.catalogue.map((code) => ({ code })),
              )
            : [];
          const stretch = links.length > 0;
          const body = (
            <>
              {/* Its listing image and its "Popular" mark, where an editor
                  set them, as the design marks a featured branch. */}
              <CardMedia media={row.listingMedia} className="speccard__media" />
              <span className="speccard__top">
                <span className="label">Specialization</span>
                <PopularBadge featured={row.featured} />
              </span>
              {stretch ? (
                <Link className="speccard__name card-stretch__link" href={href}>
                  {row.name}
                </Link>
              ) : (
                <span className="speccard__name">{row.name}</span>
              )}
              {row.shortDescription ? (
                <span className="speccard__desc">{row.shortDescription}</span>
              ) : null}
              {/* The foot only appears once there is something to put in it:
                  an empty rule above blank space reads as a broken card. */}
              {row.levels?.length || row.publishedCourseCount ? (
                <span className="speccard__foot">
                  <span className="speccard__levels">
                    {stretch ? (
                      <LevelLinks links={links} field={row.name} />
                    ) : (
                      sortByLevelOrder(row.levels ?? [], levelOrder)
                        .map((item) => item.name)
                        .join(', ')
                    )}
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
            </>
          );
          return (
            <article
              className={stretch ? 'speccard card-stretch' : 'speccard'}
              key={row.id}
              hidden={limit !== undefined && !all && index >= limit}
            >
              {stretch ? (
                <div className="speccard__btn">{body}</div>
              ) : (
                <Link className="speccard__btn" href={href}>
                  {body}
                </Link>
              )}
            </article>
          );
        })}
      </div>

      {limit !== undefined && shown.length > limit ? (
        <p className="h-more">
          <button
            type="button"
            className="linkcta"
            aria-expanded={all}
            onClick={() => setAll((open) => !open)}
          >
            {all
              ? 'Show fewer'
              : `Show all ${formatNumber(shown.length)} specializations`}
          </button>
        </p>
      ) : null}

      {shown.length === 0 ? (
        <p className="sec-lead">
          No {subjectName} specializations are recorded at that level yet.
        </p>
      ) : null}
    </>
  );
}
