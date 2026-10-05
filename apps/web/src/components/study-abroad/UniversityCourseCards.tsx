import Link from 'next/link';
import { durationLabel } from '@/lib/course-levels';
import {
  moneyRange,
  monthName,
  studyModeLabel,
  tuitionPeriod,
} from '@/lib/university-profile';
import { offeringHref } from '@/lib/university-links';
import type { UniversityOffering } from './UniversityGuide';
import { UniversityAssessmentButton } from './UniversityAssessmentButton';

/**
 * A university's own courses, as the zip's course card.
 *
 * The shared course card is built for a course in the catalogue, which is
 * taught in many places; these are one university's offerings, each with a
 * page of its own under the university, and the card says what a student
 * compares offerings on: how long, how it is taught, what it costs and when
 * it starts. Those four are the zip's facts. Tuition is always stated,
 * because the behaviour reference says outright when a fee is missing
 * rather than leaving the reader to wonder; the others appear when the
 * course records them.
 *
 * The subject and the specialization link to their pages in this
 * university's country -- the zip's "popular subjects" and spec tags both
 * do -- since a reader here has already chosen the destination.
 */

function initials(name: string) {
  const letters = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase());
  return letters.slice(0, 3).join('') || name.slice(0, 2).toUpperCase();
}

function facts(offering: UniversityOffering) {
  const rows: Array<{ label: string; value: string; datum?: boolean; missing?: boolean }> = [];
  const duration = durationLabel(offering);
  if (duration) rows.push({ label: 'Duration', value: duration, datum: true });
  const mode = studyModeLabel(offering.studyMode);
  if (mode) rows.push({ label: 'Study mode', value: mode });
  const tuition = offering.tuition;
  const fee = tuition ? moneyRange(tuition.min, tuition.max, tuition.currencyCode) : null;
  rows.push(
    fee
      ? {
          label: 'Tuition',
          value: [fee, tuitionPeriod(tuition?.period)].filter(Boolean).join(' '),
          datum: true,
        }
      : { label: 'Tuition', value: 'Not listed', missing: true },
  );
  const months = [
    ...new Set(
      (offering.intakes ?? [])
        .map((intake) => monthName(intake.month) ?? intake.name)
        .filter(Boolean),
    ),
  ];
  if (months.length)
    rows.push({ label: months.length === 1 ? 'Intake' : 'Intakes', value: months.join(' · ') });
  return rows;
}

export function UniversityCourseCards({
  offerings,
  universitySlug,
  countrySlug,
  countryName,
  countryWhere,
  nameOf,
}: {
  offerings: UniversityOffering[];
  universitySlug: string;
  countrySlug: string | null;
  countryName: string | null;
  /** The country as it reads in a sentence: "the United Kingdom". */
  countryWhere: string | null;
  /** The name a card shows: the offering's own, less the university's. */
  nameOf: (offering: UniversityOffering) => string;
}) {
  const where = countrySlug ? `/study-abroad/${countrySlug}` : null;
  return (
    <div className="coursegrid coursegrid--3">
      {offerings.map((offering) => {
        const href = countrySlug
          ? offeringHref(countrySlug, universitySlug, offering.slug)
          : `/universities/${universitySlug}/courses/${offering.slug}`;
        const subject = offering.subject?.slug ? offering.subject : null;
        const subjectHref = subject
          ? where
            ? `${where}/${subject.slug}`
            : `/subjects/${subject.slug}`
          : null;
        const specialization = offering.specialization?.slug ? offering.specialization : null;
        const name = nameOf(offering);
        const rows = facts(offering);
        return (
          <article className="coursecard" key={offering.id}>
            <div className="coursecard__top">
              <span className="coursecard__type">
                {[offering.courseLevel?.name ?? 'Programme', offering.qualificationName]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>

            <h3 className="coursecard__name">
              <Link href={href}>{name}</Link>
            </h3>

            {subject && subjectHref ? (
              <Link className="coursecard__uni" href={subjectHref}>
                <span className="unimark unimark--xs" aria-hidden="true">
                  {initials(subject.name)}
                </span>
                <span>
                  <b>{subject.name}</b>
                  {countryWhere ? <em>in {countryWhere}</em> : null}
                </span>
              </Link>
            ) : null}

            <dl className="coursecard__facts">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd
                    className={
                      [row.datum ? 'datum' : null, row.missing ? 'coursecard__missing' : null]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            {specialization && subject ? (
              <div className="coursecard__tags">
                <Link
                  className="tag"
                  href={
                    where
                      ? `${where}/${subject.slug}/${specialization.slug}`
                      : `/subjects/${subject.slug}/${specialization.slug}`
                  }
                >
                  {specialization.name}
                </Link>
              </div>
            ) : null}

            <div className="coursecard__foot">
              <Link className="btn btn--sm" href={href}>
                View programme{' '}
                <span className="btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
              <UniversityAssessmentButton
                className="linkbtn"
                intent="course-card"
                countrySlug={countrySlug ?? undefined}
                countryName={countryName ?? undefined}
                sourcePagePath={href}
              >
                Check eligibility
              </UniversityAssessmentButton>
            </div>
          </article>
        );
      })}
    </div>
  );
}
