import Link from 'next/link';
import type { Course } from '@/lib/catalog';

/**
 * The reference's programme card, used wherever a run of courses appears: a
 * subject page, a specialization page and the course index all show the same
 * thing, so they show it the same way.
 */
export function CourseCards({ courses }: { courses: Course[] }) {
  return (
    <div className="coursegrid coursegrid--3">
      {courses.map((course) => {
        const duration = [course.duration?.min, course.duration?.max]
          .filter(Boolean)
          .join('–');
        return (
          <article className="coursecard" key={course.id}>
            <Link className="coursecard__top" href={`/courses/${course.slug}`}>
              <span className="coursecard__type">
                {course.courseLevel?.name ?? 'Programme'}
              </span>
              <span className="coursecard__name">{course.name}</span>
              {course.subSubject ? (
                <span className="coursecard__uni">{course.subSubject.name}</span>
              ) : course.subject ? (
                <span className="coursecard__uni">{course.subject.name}</span>
              ) : null}
            </Link>
            <div className="coursecard__facts">
              {duration ? (
                <span className="datum">
                  {duration} {course.duration?.unit?.toLowerCase() ?? ''}
                </span>
              ) : null}
              {course.studyModes?.length ? (
                <span className="datum">
                  {course.studyModes.map((mode) => mode.name).join(', ')}
                </span>
              ) : null}
              {course.availableCountryCount ? (
                <span className="datum">
                  {course.availableCountryCount}{' '}
                  {course.availableCountryCount === 1
                    ? 'destination'
                    : 'destinations'}
                </span>
              ) : null}
            </div>
            <div className="coursecard__foot">
              <Link className="linkcta" href={`/courses/${course.slug}`}>
                View programme <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
