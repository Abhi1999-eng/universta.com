import Link from 'next/link';
import type { ReactNode } from 'react';
import { StudentCatalogueActions } from '@/components/student/StudentCatalogueActions';
import { inCountry } from '@/lib/country-article';
import {
  programmeType,
  tuitionParts,
  type OfferingCardData,
} from '@/lib/university-courses';
import { CompareCheck } from './CourseCompare';
import { universityInitials } from '@/lib/university-initials';

/**
 * One university's course, as the design's course card.
 *
 * The behaviour reference's card always says what it knows and what it does
 * not -- "Fee information currently unavailable" rather than a missing row --
 * and leads to the course and straight to its eligibility. So the four facts
 * here are always the design's four, in its order -- duration, language,
 * tuition, intake -- "Not listed" where the record is silent, and the foot
 * carries "Check eligibility" to the course page's own eligibility section.
 * The study mode, a fact the old card carried, moves to the tags.
 *
 * The language is named on the course's own evidence only, the rule its page
 * uses: an English test it asks for means English, with the score. Nothing
 * is borrowed from the country.
 *
 * The heart saves the course to the student's account, as Save does on the
 * course page; the tick beside it adds it to the comparison shared by every
 * list. "Course guide" opens the course in general, across universities,
 * everywhere but on that guide's own page.
 *
 * On a university's own list every card would name the same university, so
 * there the card's second line names what the course is filed under -- its
 * specialization or subject -- and where it is taught. Away from that list
 * (the related courses on a course page) it names the university.
 */

const NOT_LISTED = 'Not listed';

/* The list's card data, with the three fields the card reads beyond its
   facts optional: the offering's own id for the save, the language on the
   course's evidence and the course it is an instance of. A row built
   without them still draws the card, with "Not listed" and no guide link. */
type CardExtras = 'offeringId' | 'language' | 'genericCourse';
export type ProgrammeCardData = Omit<OfferingCardData, CardExtras> &
  Partial<Pick<OfferingCardData, CardExtras>>;

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
  guideLink = true,
}: {
  course: ProgrammeCardData;
  show?: 'subject' | 'university';
  headingLevel?: 2 | 3;
  /** Whether the foot links the course guide. A course guide's own cards
   *  leave it out: every one of them would lead back to the page being
   *  read. */
  guideLink?: boolean;
}) {
  const Heading = `h${headingLevel}` as const;
  const country = course.university.country;
  const branch = course.specialization ?? course.subject;
  const language = course.language ?? null;
  /* The tests a course names are its evidence for "English": they go to the
     tag row, each as its own tag, so the Language cell stays one word as on
     the design's card. A row built without the list splits the note. */
  const tests = language
    ? (language.tests ?? (language.note ? language.note.split(' · ') : []))
    : [];
  const fee = course.tuition ? tuitionParts(course.tuition) : null;
  const facts: Array<{ label: string; value: ReactNode; datum?: boolean }> = [
    { label: 'Duration', value: course.duration, datum: true },
    { label: 'Language', value: language?.value ?? null },
    {
      label: 'Tuition',
      /* Held together as "JPY 535,800", then "/yr": it breaks there or not
         at all, never as "JPY / 535,800/ / yr". */
      value: fee ? (
        <>
          {fee.amount}
          {fee.period ? (
            <>
              <wbr />
              <span className="coursecard__per">{fee.period}</span>
            </>
          ) : null}
        </>
      ) : null,
      datum: true,
    },
    {
      label: course.intakes.length > 1 ? 'Intakes' : 'Intake',
      value: course.intakes.join(' · ') || null,
    },
  ];
  const type = programmeType(course);
  /* The account save takes the offering's id; a row that only had its slug
     to stand in for one gets no heart rather than one that cannot save. */
  const savedId = course.offeringId ?? (course.id !== course.slug ? course.id : null);
  const guide = guideLink ? (course.genericCourse ?? null) : null;

  return (
    <article className="coursecard">
      {/* The picture an editor chose for the programme, at the top of its
          card; a card without one is drawn as before. */}
      {course.media?.url ? (
        <span className="coursecard__media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={course.media.url} alt="" loading="lazy" />
        </span>
      ) : null}
      <div className="coursecard__top">
        {/* The design's short type line, "MASTER'S · MIST", on one line;
            a course without a short name shows its qualification there,
            clamped, and whole in the title. */}
        <span
          className={`coursecard__type${type.short ? '' : ' coursecard__type--long'}`}
          title={
            !type.short && course.qualification
              ? `${type.level} · ${course.qualification}`
              : undefined
          }
        >
          {[type.level, type.kind].filter(Boolean).join(' · ')}
        </span>
        <div className="coursecard__tools">
          {savedId ? (
            <StudentCatalogueActions
              kind="offerings"
              entityId={savedId}
              variant="heart"
              compact
              label={`${course.name} at ${course.university.name}`}
            />
          ) : null}
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
            {universityInitials(course.university.name)}
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

      {course.specialization ||
      course.studyMode ||
      tests.length ||
      course.campus ||
      course.courseCode ||
      course.nextDeadline ? (
        <div className="coursecard__tags">
          {course.specialization && course.subject && country ? (
            <Link
              className="tag"
              href={`/study-abroad/${country.slug}/${course.subject.slug}/${course.specialization.slug}`}
            >
              {course.specialization.name} in {inCountry(country.name, country.iso2Code)}
            </Link>
          ) : null}
          {course.studyMode ? <span className="tag">{course.studyMode}</span> : null}
          {tests.map((test) => (
            <span className="tag coursecard__test" key={test}>
              {test}
            </span>
          ))}
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
        <span className="coursecard__links">
          <Link className="linkbtn" href={`${course.href}#eligibility`}>
            Check eligibility
          </Link>
          {guide ? (
            <Link
              className="linkbtn coursecard__guide"
              href={`/courses/${guide.slug}`}
              aria-label={`Course guide: ${guide.name}`}
            >
              Course guide
            </Link>
          ) : null}
        </span>
      </div>
    </article>
  );
}
