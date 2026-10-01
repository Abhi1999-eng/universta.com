import Link from 'next/link';
import type { Course } from '@/lib/catalog';

/**
 * The reference's programme card, used wherever a run of courses appears: a
 * subject page, a specialization page and the course index all show the same
 * thing, so they show it the same way.
 *
 * The card's parts are siblings, not children of `coursecard__top`. That row is
 * a `space-between` flex line meant to hold only the level and the card's
 * tools; putting the name and the subject line inside it too laid all three
 * side by side in three narrow columns, which broke words across lines
 * ("UNDERGRADU / ATE"). The facts are a `<dl>` of `<div><dt>/<dd></div>`
 * groups for the same reason: the divider rules and the column track are
 * written for those groups, so bare spans ran the values together
 * ("3-5 yearsFull time") with no label to say what either one was.
 */

/** Initials for the small mark, e.g. "Computer Science" -> "CS". */
function initials(name: string) {
  const letters = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase());
  return letters.slice(0, 3).join('') || name.slice(0, 2).toUpperCase();
}

function facts(course: Course) {
  /* `datum` is the site's figure face -- tabular mono. It belongs on the
     values that are numbers and not on the ones that are words. */
  const rows: Array<{ label: string; value: string; datum?: boolean }> = [];

  const span = [course.duration?.min, course.duration?.max].filter(Boolean);
  if (span.length) {
    const unit = course.duration?.unit?.toLowerCase() ?? '';
    /* A single figure reads "3 years", a range "3–5 years" -- the unit is said
       once, at the end, not after each end of the range. */
    const amount = span[0] === span[span.length - 1] ? span[0] : span.join('–');
    rows.push({
      label: 'Duration',
      value: `${amount}${unit ? ` ${unit}` : ''}`,
      datum: true,
    });
  }

  if (course.studyModes?.length)
    rows.push({
      label: course.studyModes.length === 1 ? 'Study mode' : 'Study modes',
      value: course.studyModes.map((mode) => mode.name).join(' · '),
    });

  if (course.selectedTuition?.min)
    rows.push({
      label: 'Tuition',
      value: [course.selectedTuition.currencyCode, course.selectedTuition.min]
        .filter(Boolean)
        .join(' '),
      datum: true,
    });

  if (course.availableCountryCount)
    rows.push({
      label:
        course.availableCountryCount === 1 ? 'Destination' : 'Destinations',
      value: String(course.availableCountryCount),
      datum: true,
    });

  return rows.slice(0, 4);
}

export function CourseCards({ courses }: { courses: Course[] }) {
  return (
    <div className="coursegrid coursegrid--3">
      {courses.map((course) => {
        const href = `/courses/${course.slug}`;
        /* The card's second line names where the programme sits in the
           catalogue: its specialization over its subject, or just the subject
           when the programme hangs straight off one. */
        const branch = course.subSubject;
        const branchHref = branch
          ? `/subjects/${course.subject.slug}/${branch.slug}`
          : `/subjects/${course.subject.slug}`;
        const rows = facts(course);

        return (
          <article className="coursecard" key={course.id}>
            <div className="coursecard__top">
              <span className="coursecard__type">
                {[course.courseLevel?.name ?? 'Programme', course.shortName]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>

            <h3 className="coursecard__name">
              <Link href={href}>{course.name}</Link>
            </h3>

            <Link className="coursecard__uni" href={branchHref}>
              <span className="unimark unimark--xs" aria-hidden="true">
                {initials(branch?.name ?? course.subject.name)}
              </span>
              <span>
                <b>{branch?.name ?? course.subject.name}</b>
                {branch ? <em>{course.subject.name}</em> : null}
              </span>
            </Link>

            {rows.length ? (
              <dl className="coursecard__facts">
                {rows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd className={row.datum ? 'datum' : undefined}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="coursecard__foot">
              <Link className="btn btn--sm" href={href}>
                View programme{' '}
                <span className="btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
