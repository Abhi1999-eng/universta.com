import Link from 'next/link';
import type { OfferingCardData } from '@/lib/university-courses';
import { CompareCheck } from './CourseCompare';

/**
 * One university's course, as the design's course card.
 *
 * The behaviour reference's card always says what it knows and what it does
 * not -- "Fee information currently unavailable" rather than a missing row --
 * and leads to the course and straight to its eligibility. So the four facts
 * here are always the same four, "Not listed" where the record is silent,
 * and the foot carries "Check eligibility" to the course page's own
 * eligibility section.
 *
 * On a university's own list every card would name the same university, so
 * there the card's second line names what the course is filed under -- its
 * specialization or subject -- and where it is taught. Away from that list
 * (the related courses on a course page) it names the university.
 */

const NOT_LISTED = 'Not listed';

function initials(name: string) {
  const letters = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase());
  return letters.slice(0, 3).join('') || name.slice(0, 2).toUpperCase();
}

export function OfferingCard({
  course,
  show = 'subject',
  headingLevel = 3,
}: {
  course: OfferingCardData;
  show?: 'subject' | 'university';
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  const country = course.university.country;
  const branch = course.specialization ?? course.subject;
  const facts = [
    { label: 'Duration', value: course.duration, datum: true },
    { label: 'Study mode', value: course.studyMode },
    { label: 'Tuition', value: course.tuition, datum: true },
    {
      label: course.intakes.length > 1 ? 'Intakes' : 'Intake',
      value: course.intakes.join(' · ') || null,
    },
  ];

  return (
    <article className="coursecard">
      <div className="coursecard__top">
        <span className="coursecard__type">
          {[course.level?.name ?? 'Programme', course.qualification]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <div className="coursecard__tools">
          <CompareCheck
            item={{
              slug: course.slug,
              name:
                show === 'university'
                  ? `${course.name} · ${course.university.name}`
                  : course.name,
            }}
          />
        </div>
      </div>

      <Heading className="coursecard__name">
        <Link href={course.href}>{course.name}</Link>
      </Heading>

      {show === 'university' ? (
        <Link className="coursecard__uni" href={course.university.href}>
          <span className="unimark unimark--xs" aria-hidden="true">
            {initials(course.university.name)}
          </span>
          <span>
            <b>{course.university.name}</b>
            {course.university.location ? (
              <em>{course.university.location}</em>
            ) : null}
          </span>
        </Link>
      ) : branch ? (
        <Link
          className="coursecard__uni"
          href={
            course.specialization && course.subject
              ? `/subjects/${course.subject.slug}/${course.specialization.slug}`
              : `/subjects/${branch.slug}`
          }
        >
          <span className="unimark unimark--xs" aria-hidden="true">
            {initials(branch.name)}
          </span>
          <span>
            <b>{branch.name}</b>
            {/* The subject a specialization sits in, or where the course is
                taught; the campus itself is the tag below. */}
            <em>
              {(course.specialization ? course.subject?.name : null) ??
                course.university.location}
            </em>
          </span>
        </Link>
      ) : null}

      <dl className="coursecard__facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd
              className={
                fact.value
                  ? fact.datum
                    ? 'datum'
                    : undefined
                  : 'coursecard__none'
              }
            >
              {fact.value ?? NOT_LISTED}
            </dd>
          </div>
        ))}
      </dl>

      {course.specialization || course.campus || course.courseCode || course.nextDeadline ? (
        <div className="coursecard__tags">
          {course.specialization && course.subject && country ? (
            <Link
              className="tag"
              href={`/study-abroad/${country.slug}/${course.subject.slug}/${course.specialization.slug}`}
            >
              {course.specialization.name} in {country.name}
            </Link>
          ) : null}
          {course.campus ? (
            <span className="tag">Campus: {course.campus.name}</span>
          ) : null}
          {course.nextDeadline ? (
            <span className="tag">Apply by {course.nextDeadline}</span>
          ) : null}
          {course.courseCode ? (
            <span className="tag">Code {course.courseCode}</span>
          ) : null}
        </div>
      ) : null}

      <div className="coursecard__foot">
        <Link className="btn btn--sm" href={course.href}>
          View course{' '}
          <span className="btn__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
        <Link className="linkbtn" href={`${course.href}#eligibility`}>
          Check eligibility
        </Link>
      </div>
    </article>
  );
}
