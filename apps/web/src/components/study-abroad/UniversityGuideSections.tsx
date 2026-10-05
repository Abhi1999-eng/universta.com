import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  deadlineLabel,
  intakeSummary,
  moneyRange,
  monthName,
  tuitionByLevel,
  tuitionPeriod,
  type ProfileOffering,
} from '@/lib/university-profile';
import { countryUniversitiesHref, universityHref } from '@/lib/university-links';
import { FlagMark } from './FlagMark';
import { SectionHead } from './SectionHead';
import { UniversityAssessmentButton } from './UniversityAssessmentButton';
import { universityInitials } from '@/lib/university-initials';

/**
 * The sections of a university's page that read more than its own record:
 * what its courses say about fees and intakes, the questions the record can
 * answer, and the other universities in its country. Each stands down when
 * it has nothing true to show, like every other section on the page.
 */

/** Another university in the same destination, as the page's foot shows it. */
export type NearbyUniversity = {
  id: string;
  name: string;
  slug: string;
  institutionType: string | null;
  qsRanking: number | null;
  shortDescription: string | null;
  totalStudents: number | null;
  internationalStudentsPercent: string | number | null;
  city: string | null;
  programmes: number;
};

function typeLabel(value: string | null) {
  if (!value) return null;
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}


const arrow = (
  <span className="linkcta__arrow" aria-hidden="true">
    &rarr;
  </span>
);

/**
 * "What a year here costs": tuition by level, from the fees the courses
 * record. The zip's fee table also lists living costs, insurance and an
 * application fee; the catalogue keeps none of those per institution, so
 * the rows are the levels that state a fee and nothing is estimated. The
 * budget link opens the destination's cost section, which does carry
 * living costs, and only when the guide has that section to open.
 */
export function UniversityFees({
  offerings,
  n,
  band,
  costHref,
}: {
  offerings: ProfileOffering[];
  n: string | null;
  band: string;
  costHref: string | null;
}) {
  const rows = tuitionByLevel(offerings);
  if (!rows.length) return null;
  return (
    <section className={band} id="fees">
      <div className="wrap">
        <SectionHead
          n={n}
          eyebrow="Fees"
          title="What a year here costs"
          lead="Tuition as this university's courses record it, level by level. Fees change between intakes, so confirm every figure with the university before you plan your finances."
        />
        <div className="costlist">
          {rows.map((row) => (
            <div className="costrow" key={`${row.level}-${row.currencyCode}-${row.period}`}>
              <div className="costrow__l">{row.level}</div>
              <div className="costrow__v datum">
                {moneyRange(row.min, row.max, row.currencyCode)}
                {tuitionPeriod(row.period) ? (
                  <span className="costrow__u">{tuitionPeriod(row.period)}</span>
                ) : null}
              </div>
              <p className="costrow__d">
                {row.priced === row.courses
                  ? `From the fee ${row.courses === 1 ? 'its one course' : `each of its ${row.courses} courses`} at this level states.`
                  : `From the ${row.priced} of its ${row.courses} courses at this level that state a fee. The others do not record one.`}
              </p>
            </div>
          ))}
        </div>
        {costHref ? (
          <div className="btn-row uniguide__after">
            <Link className="linkcta" href={costHref}>
              Calculate my personalised budget {arrow}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * "Intakes & deadlines": one card per intake the courses list, with how
 * many courses start in it and the next deadline any of them records.
 * The zip's card also gives a decision window and a start date, which the
 * catalogue does not record per institution, so the card leaves them out
 * rather than guessing.
 */
export function UniversityIntakes({
  offerings,
  n,
  band,
  assessment,
}: {
  offerings: ProfileOffering[];
  n: string | null;
  band: string;
  assessment: { countrySlug?: string; countryName?: string; sourcePagePath: string };
}) {
  const intakes = intakeSummary(offerings);
  if (!intakes.length) return null;
  return (
    <section className={band} id="intakes">
      <div className="wrap">
        <SectionHead
          n={n}
          eyebrow="Intakes"
          title="Intakes & deadlines"
          lead="Deadlines are set per course, and a course may close earlier than these. Confirm on the course page before you plan around them."
        />
        <div className="intakes">
          {intakes.map((intake) => (
            <article className="intake" key={intake.key}>
              <div className="intake__head">
                <h3 className="intake__name">
                  {monthName(intake.month) ?? intake.name} intake
                </h3>
              </div>
              <dl className="intake__rows">
                <div className="intake__row">
                  <dt>Courses starting</dt>
                  <dd>{intake.courses}</dd>
                </div>
                <div className="intake__row">
                  {/* The next deadline still open; when every one has gone
                      by, the last of them, said to have passed rather than
                      left to read as a date that can still be met. */}
                  <dt>{intake.passed ? 'Last deadline' : 'Next deadline'}</dt>
                  <dd>
                    {deadlineLabel(intake.deadline)
                      ? `${deadlineLabel(intake.deadline)}${intake.passed ? ' (passed)' : ''}`
                      : 'Not recorded'}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <div className="btn-row uniguide__after">
          <UniversityAssessmentButton
            className="btn btn--ghost"
            intent="timeline"
            {...assessment}
          >
            Create my application timeline{' '}
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </UniversityAssessmentButton>
        </div>
      </div>
    </section>
  );
}

export type UniversityFaq = { id: string; question: string; answer: ReactNode };

/**
 * "Straight answers about X": the zip's question block. The catalogue keeps
 * no questions for a university, so these are asked of the record itself,
 * and a question it cannot answer is not asked. Native disclosure, because
 * the answers are static and need no script to open.
 */
export function UniversityFaqs({
  name,
  faqs,
  n,
  band,
}: {
  name: string;
  faqs: UniversityFaq[];
  n: string | null;
  band: string;
}) {
  if (!faqs.length) return null;
  return (
    <section className={band} id="faqs">
      <div className="wrap">
        <SectionHead
          n={n}
          eyebrow="Questions"
          title={`Straight answers about ${name}`}
          lead="What the catalogue can answer about this university. If your question is not here, the assessment is the fastest route to a specific answer."
        />
        <div className="faq">
          {faqs.map((faq, index) => (
            <details className="faq__item" key={faq.id} open={index === 0}>
              <summary className="faq__q">
                <span>{faq.question}</span>
                <span className="faq__plus" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="faq__a">
                <p>{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * "More universities in X": three others from the same destination, best
 * ranked first, the way the behaviour reference closes a university, in
 * the zip's similar-universities block and card. The zip picks its three
 * across countries by a similarity score this catalogue does not keep; the
 * reference picks from the same country, and that is a rule the page can
 * state truthfully.
 */
export function MoreUniversities({
  university,
  country,
  others,
  total,
  band,
}: {
  university: { name: string; slug: string };
  country: { name: string; slug: string; iso2Code: string | null; where: string };
  others: NearbyUniversity[];
  total: number;
  band: string;
}) {
  if (!others.length) return null;
  const ranked = others.some((other) => other.qsRanking);
  return (
    <section className={`${band} sec--tight`} id="similar">
      <div className="wrap">
        <div className="sec-head uniguide__simhead">
          <div>
            <p className="eyebrow">Same destination</p>
            <h2 className="sec-title">More universities in {country.where}</h2>
            <p className="sec-lead">
              {ranked
                ? 'Ranked universities first, in published rank order, then the rest A to Z.'
                : 'Listed A to Z.'}{' '}
              {total > others.length
                ? `${total} other universities in ${country.where} are on Universta.`
                : null}
            </p>
          </div>
        </div>

        <div className="unigrid unigrid--compact">
          {others.map((other) => {
            const href = universityHref(other.slug);
            const type = typeLabel(other.institutionType);
            return (
              <article className="unicard" key={other.id}>
                <div className="unicard__head">
                  <span className="unimark" aria-hidden="true">
                    {universityInitials(other.name)}
                  </span>
                  <div className="unicard__id">
                    <h3 className="unicard__name">
                      <Link href={href}>{other.name}</Link>
                    </h3>
                    <p className="unicard__where">
                      <FlagMark iso2Code={country.iso2Code} bands={null} />
                      {other.city ? `${other.city}, ${country.name}` : country.name}
                    </p>
                    {type ? <p className="unicard__type">{type}</p> : null}
                  </div>
                </div>

                <dl className="unicard__stats">
                  <div>
                    <dt>Programmes</dt>
                    <dd className="datum">{other.programmes}</dd>
                  </div>
                  {other.totalStudents ? (
                    <div>
                      <dt>Students</dt>
                      <dd className="datum">
                        {Number(other.totalStudents).toLocaleString('en-GB')}
                      </dd>
                    </div>
                  ) : null}
                  {other.internationalStudentsPercent ? (
                    <div>
                      <dt>International</dt>
                      <dd className="datum">{`${Number(other.internationalStudentsPercent)}%`}</dd>
                    </div>
                  ) : null}
                </dl>

                {other.shortDescription ? (
                  <p className="unicard__fields">{other.shortDescription}</p>
                ) : null}

                <div className="unicard__foot">
                  <Link className="btn btn--sm" href={href}>
                    View university{' '}
                    <span className="btn__arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </Link>
                  <Link
                    className="iconbtn"
                    href={`/compare/universities?items=${university.slug},${other.slug}`}
                    aria-label={`Compare ${other.name} with ${university.name}`}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
                    </svg>
                    <span>Compare</span>
                  </Link>
                  {other.qsRanking ? (
                    <span className="unicard__rank">
                      Ranked #{other.qsRanking} &middot; one factor among many
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <div className="btn-row uniguide__after">
          <Link className="linkcta" href={countryUniversitiesHref(country.slug)}>
            View all universities in {country.where} {arrow}
          </Link>
          <Link
            className="linkcta"
            href={`/compare/universities?items=${university.slug}`}
          >
            Compare universities {arrow}
          </Link>
          <Link className="linkcta" href={`/study-abroad/${country.slug}`}>
            Studying in {country.where} {arrow}
          </Link>
        </div>
      </div>
    </section>
  );
}
