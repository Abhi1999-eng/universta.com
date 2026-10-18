import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Course } from '@/lib/catalog';
import { levelAnchor } from '@/lib/course-levels';
import { formatNumber } from '@/lib/format';
import type { StudyLevelPanel } from '@/lib/study-levels';
import { LevelCourseList } from './CourseLevels';
import { LevelSwitch } from './LevelSwitch';

/**
 * A field's study levels in one destination: a bar of the levels it is
 * offered at, and under it the chosen level's specializations and its
 * courses listed here.
 *
 * The field's own pages (/subjects/{subject}, /subjects/{subject}/{spec})
 * draw the same toggle with no destination: leave `where` out and a count
 * reads "3 courses", and an empty level reads "0 courses" and still opens
 * its list, as the stacked levels block those pages drew before did.
 *
 * A level with nothing listed here still opens: it names the
 * specializations taught at it and says, once, that nothing is listed here
 * yet.
 *
 * Every level ends with the way to the field at that level everywhere --
 * its level page, "Master's in Computer Science, every destination" --
 * whether or not anything is listed here. It used to show only under an
 * empty level, so a destination with courses at a level never linked the
 * level page at all.
 */
export function StudyLevels({
  panels,
  where,
  allHref,
  courseHref,
  specializationHref,
  elsewhere,
  intro,
  branch = true,
}: {
  panels: StudyLevelPanel[];
  /** "in Japan", as a level's count and its empty line say it. Left out on
   *  a field's own pages, which cover every destination. */
  where?: string;
  /** The level's courses here, in the course search. */
  allHref: (levelCode: string) => string;
  courseHref: (course: Course) => string;
  /** A specialization of the field, in this destination -- or, on a
   *  field's own page, the specialization at this level. */
  specializationHref?: (slug: string, levelCode: string) => string;
  /** The level in every destination: the field's level page. A null href
   *  means the field has no page at that level, and no link is drawn. */
  elsewhere?: {
    href: (levelCode: string) => string | null;
    label: (levelName: string) => string;
    /** Drawn as a button: on a field's own page it is the panel's way on. */
    button?: boolean;
  };
  /** What a panel says about its level under its heading, on a field's own
   *  page: a line and a few facts. */
  intro?: (panel: StudyLevelPanel) => ReactNode;
  /** Whether a course row names its specialization. */
  branch?: boolean;
}) {
  if (!panels.length) return null;
  const initial = (panels.find((panel) => panel.group.count) ?? panels[0]).group.level.code;

  return (
    <LevelSwitch
      initial={initial}
      levels={panels.map(({ group }) => ({
        code: group.level.code,
        name: group.level.name,
        count: group.count,
        anchor: levelAnchor(group.level.code),
      }))}
      panels={panels.map((panel) => {
        const { group, specializations } = panel;
        const anchor = levelAnchor(group.level.code);
        const noun = group.count === 1 ? 'course' : 'courses';
        const elsewhereHref = elsewhere ? elsewhere.href(group.level.code) : null;
        return (
          <section
            className={`coursegroup studylevel scrollstop${group.count ? '' : ' coursegroup--empty'}`}
            id={anchor}
            key={group.level.id}
            aria-labelledby={`${anchor}-h`}
          >
            <h3 className="coursegroup__title" id={`${anchor}-h`}>
              {group.count ? (
                <Link className="coursegroup__head" href={allHref(group.level.code)}>
                  <span className="coursegroup__name">{group.level.name}</span>
                  <span className="coursegroup__n">
                    {where ? (
                      <>
                        {formatNumber(group.count)} {noun} {where}
                      </>
                    ) : (
                      <>
                        {formatNumber(group.count)} {noun}
                      </>
                    )}
                  </span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              ) : !where ? (
                /* A field's own page: the level's list is the whole catalogue's,
                   and opens even while it is empty, as the stacked block did. */
                <Link className="coursegroup__head" href={allHref(group.level.code)}>
                  <span className="coursegroup__name">{group.level.name}</span>
                  <span className="coursegroup__n">0 courses</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              ) : (
                <span className="coursegroup__head">
                  <span className="coursegroup__name">{group.level.name}</span>
                  <span className="coursegroup__n">Not listed {where} yet</span>
                  <span className="coursegroup__noarrow" aria-hidden="true">
                    &rarr;
                  </span>
                </span>
              )}
            </h3>

            {intro ? intro(panel) : null}

            {specializations.length && specializationHref ? (
              <div className="studylevel__specs">
                <span className="filters__label">
                  {specializations.length === 1 ? 'Specialization' : 'Specializations'}
                </span>
                {specializations.map((entry) => (
                  <Link
                    className="specchip"
                    key={entry.id}
                    href={specializationHref(entry.slug, group.level.code)}
                  >
                    {entry.name}
                    {entry.here ? <em>{formatNumber(entry.here)}</em> : null}
                  </Link>
                ))}
              </div>
            ) : null}

            <LevelCourseList
              group={group}
              allHref={allHref}
              courseHref={courseHref}
              branch={branch}
            />

            {elsewhere && elsewhereHref ? (
              <p className="studylevel__elsewhere">
                <Link className={elsewhere.button ? 'btn btn--sm btn--wrap' : 'linkcta'} href={elsewhereHref}>
                  {elsewhere.label(group.level.name)}{' '}
                  <span className={elsewhere.button ? 'btn__arrow' : 'linkcta__arrow'} aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              </p>
            ) : null}
          </section>
        );
      })}
    />
  );
}
