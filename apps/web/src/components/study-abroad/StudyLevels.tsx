import Link from 'next/link';
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
 * A level with nothing listed here still opens: it names the
 * specializations taught at it and says, once, that nothing is listed here
 * yet, with the way to the level everywhere else.
 */
export function StudyLevels({
  panels,
  where,
  allHref,
  courseHref,
  specializationHref,
  elsewhere,
  branch = true,
}: {
  panels: StudyLevelPanel[];
  /** "in Japan", as a level's count and its empty line say it. */
  where: string;
  /** The level's courses here, in the course search. */
  allHref: (levelCode: string) => string;
  courseHref: (course: Course) => string;
  /** A specialization of the field, in this destination. */
  specializationHref?: (slug: string) => string;
  /** The level in every destination, for a level with nothing here. A
   *  null href means the field has no page at that level, and no link is
   *  drawn. */
  elsewhere?: { href: (levelCode: string) => string | null; label: (levelName: string) => string };
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
      panels={panels.map(({ group, specializations }) => {
        const anchor = levelAnchor(group.level.code);
        const noun = group.count === 1 ? 'course' : 'courses';
        const elsewhereHref = !group.count && elsewhere ? elsewhere.href(group.level.code) : null;
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
                    {formatNumber(group.count)} {noun} {where}
                  </span>
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

            {specializations.length && specializationHref ? (
              <div className="studylevel__specs">
                <span className="filters__label">
                  {specializations.length === 1 ? 'Specialization' : 'Specializations'}
                </span>
                {specializations.map((entry) => (
                  <Link className="specchip" key={entry.id} href={specializationHref(entry.slug)}>
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
                <Link className="linkcta" href={elsewhereHref}>
                  {elsewhere.label(group.level.name)}{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
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
