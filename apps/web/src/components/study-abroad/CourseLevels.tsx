import Link from 'next/link';
import type { Course, CourseLevelGroup } from '@/lib/catalog';
import {
  LEVEL_ROWS_SHOWN,
  courseRowFigure,
  courseRowMeta,
  levelAnchor,
} from '@/lib/course-levels';
import { formatNumber } from '@/lib/format';

/**
 * A subject's courses, one section per study level.
 *
 * A subject page listed six courses in one run and a destination's subject
 * page listed six more, Bachelor's next to PhD next to a diploma, with the
 * level as a word on each card. A student does not shop that way: they know
 * the level they are applying at and want what exists at it. So the courses
 * are filed under their levels, in academic order, each level with its own
 * count and its own way to the full list.
 *
 * The parts are the design's own: its group heading with a count and an
 * arrow, its ruled list of course rows, its chip bar. The design groups a
 * country's courses under subjects this way; this is the same block with
 * levels as the groups.
 *
 * The six levels the client named are always here (see `everyLevel`); any
 * other level shows only where something is. An empty level is its name and
 * "0 courses" and nothing more: the section's lead, or the notice above it,
 * says once why nothing is listed, and a line under each level said it six
 * times over. Global subject pages link to the level's own listing, where
 * visitors can switch levels; destination pages keep these groups in place.
 */
export function CourseLevels({
  groups,
  allHref,
  courseHref = (course) => `/courses/${course.slug}`,
  branch = true,
  levelPages = false,
}: {
  groups: CourseLevelGroup[];
  /** Where a level's whole list is: the course search, filtered to it. */
  allHref: (levelCode: string) => string;
  courseHref?: (course: Course) => string;
  /** Whether a row names its specialization. Not on a specialization's own
   * page, where every row would say the same one. */
  branch?: boolean;
  /** Global subject pages open a dedicated level list, including empty levels. */
  levelPages?: boolean;
}) {
  if (!groups.length) return null;

  const row = (course: Course) => {
    const meta = courseRowMeta(course, { branch });
    const figure = courseRowFigure(course);
    return (
      <Link className="courselist__row" href={courseHref(course)} key={course.id}>
        <span className="courselist__name">{course.name}</span>
        <span className="courselist__meta">{meta}</span>
        <span className="courselist__fee datum">{figure}</span>
        <span aria-hidden="true">&rarr;</span>
      </Link>
    );
  };

  return (
    <div className="courselevels">
      {/* Straight to a level, for a page that now has several lists on it.
          Links, not filters: every level stays on the page. */}
      {/* Not when every level is empty: six chips reading 0, each jumping a
          few lines down to say so again, are no way in. */}
      {groups.length > 1 && (levelPages || groups.some((group) => group.count)) ? (
        <nav className="levelbar levelbar--wide" aria-label="Study levels">
          <span className="filters__label">Study level</span>
          {groups.map((group) => (
            <a
              className={`chipbtn${group.count ? '' : ' chipbtn--none'}`}
              href={levelPages ? allHref(group.level.code) : `#${levelAnchor(group.level.code)}`}
              key={group.level.id}
            >
              {group.level.name}{' '}
              <span className="chipbtn__n datum">{formatNumber(group.count)}</span>
            </a>
          ))}
        </nav>
      ) : null}

      <div className="coursegroups coursegroups--stack">
        {groups.map((group) => {
          if (!group.count)
            return (
              <section
                className="coursegroup coursegroup--empty scrollstop"
                id={levelAnchor(group.level.code)}
                key={group.level.id}
                aria-labelledby={`${levelAnchor(group.level.code)}-h`}
              >
                <h3
                  className="coursegroup__title"
                  id={`${levelAnchor(group.level.code)}-h`}
                >
                  {levelPages ? <Link className="coursegroup__head" href={allHref(group.level.code)}>
                    <span className="coursegroup__name">{group.level.name}</span>
                    <span className="coursegroup__n">0 courses</span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link> : <span className="coursegroup__head">
                    <span className="coursegroup__name">{group.level.name}</span>
                    <span className="coursegroup__n">0 courses</span>
                    {/* The listed levels' arrow's room, so the counts line up. */}
                    <span className="coursegroup__noarrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </span>}
                </h3>
              </section>
            );
          const first = group.courses.slice(0, LEVEL_ROWS_SHOWN);
          const rest = group.courses.slice(LEVEL_ROWS_SHOWN);
          const beyond = group.count - group.courses.length;
          const noun = group.count === 1 ? 'course' : 'courses';
          return (
            <section
              className="coursegroup scrollstop"
              id={levelAnchor(group.level.code)}
              key={group.level.id}
              aria-labelledby={`${levelAnchor(group.level.code)}-h`}
            >
              <h3
                className="coursegroup__title"
                id={`${levelAnchor(group.level.code)}-h`}
              >
                <Link className="coursegroup__head" href={allHref(group.level.code)}>
                  <span className="coursegroup__name">{group.level.name}</span>
                  <span className="coursegroup__n">
                    {formatNumber(group.count)} {noun}
                  </span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </h3>

              <div className="courselist">{first.map(row)}</div>

              {/* The rest of the level, in place. A disclosure rather than
                  a second page: the reader asked for this level and is
                  already looking at it. */}
              {rest.length ? (
                <details className="coursegroup__more">
                  <summary>
                    <span className="coursegroup__open">
                      Show {formatNumber(rest.length)} more {group.level.name}{' '}
                      {rest.length === 1 ? 'course' : 'courses'}
                    </span>
                    <span className="coursegroup__shut">Show fewer</span>
                  </summary>
                  <div className="courselist courselist--cont">{rest.map(row)}</div>
                </details>
              ) : null}

              {/* More than the page holds: the course search, on this level. */}
              {beyond > 0 ? (
                <p className="h-more">
                  <Link className="linkcta" href={allHref(group.level.code)}>
                    All {formatNumber(group.count)} {group.level.name} {noun}{' '}
                    <span className="linkcta__arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </Link>
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
