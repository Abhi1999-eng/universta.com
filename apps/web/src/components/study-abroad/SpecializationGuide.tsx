import Link from 'next/link';
import type { CourseLevelGroup, SpecializationDetail } from '@/lib/catalog';
import { counsellingHref } from '@/lib/counselling-link';
import { inCountry } from '@/lib/country-article';
import { levelCoursesHref, levelTotal } from '@/lib/course-levels';
import { formatNumber } from '@/lib/format';
import type { ScholarshipCard } from '@/lib/scholarship-card';
import { universityHref } from '@/lib/university-links';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { ConsultantsCta } from './ConsultantsCta';
import { CourseCards } from './CourseCards';
import { CourseLevels } from './CourseLevels';
import { Crumbs } from './Crumbs';
import { DestinationSwitcher } from './DestinationSwitcher';
import {
  destinationsLead,
  programmeCount,
  rankDestinations,
  sparseBandClass,
  teachingDestinations,
  type CountedDestination,
} from './switcher';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { PlanBand } from './PlanBand';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import { SectionHead } from './SectionHead';

/** A sibling as the record now sends it: enough to fill a card. Older
 *  records send the name alone, and the card shows what there is. */
type Sibling = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  publishedCourseCount?: number | null;
  levels?: Array<{ id: string; name: string; code: string | null }> | null;
};

/** What the specialization record carries beyond the catalogue's type:
 *  programme counts per destination, the universities that teach it and how
 *  many siblings there are in all. Each is optional, so a page served by an
 *  older API still renders as it did. */
export type SpecializationRecord = Omit<SpecializationDetail, 'siblings' | 'countries'> & {
  siblings: Sibling[];
  siblingTotal?: number | null;
  countries: CountedDestination[];
  availableCountryCount?: number | null;
  universities?: {
    total: number;
    data: Array<{
      id: string;
      name: string;
      slug: string;
      country?: { name: string; slug: string } | null;
    }>;
  } | null;
};

/**
 * A specialization's guide, at /subjects/<subject>/<specialization>.
 *
 * It is addressed inside its subject because that pair is what makes it
 * unique: "Animal Science" is taught under Agriculture, under Science and
 * under Biological & Life Sciences, and those are three different pages.
 * Every link out of here keeps the pair together for the same reason --
 * including the course search, which used to open the whole subject (36
 * programmes) from a page about one branch of it (6).
 *
 * Sections stand down rather than render empty. 927 of these arrived at once
 * and the editorial work behind them lands over time, so the page has to read
 * as finished at every stage of that, not as a row of blank panels. The
 * numbered run is built from what actually renders, so the numbering never
 * skips.
 */
export function SpecializationGuide({
  specialization: record,
  levels = null,
  scholarships = [],
}: {
  specialization: SpecializationDetail | SpecializationRecord;
  /** Its courses filed under their study levels. Absent when that read
   *  failed; the mixed run of courses is shown instead, as before. */
  levels?: CourseLevelGroup[] | null;
  /** Awards recorded against its subject. Scholarships are recorded per
   *  subject, not per specialization, and the section says so. */
  scholarships?: ScholarshipCard[];
}) {
  const specialization = record as SpecializationRecord;
  const { subject, siblings } = specialization;
  /* The places that teach it first, most programmes first. The links'
     own order is 0 on every row, so the band opened on Vietnam, Saudi
     Arabia and Niger, with the United Kingdom 188th of 197. */
  const countries = rankDestinations(specialization.countries ?? []);
  const teaching = teachingDestinations(countries);
  const subjectPath = `/subjects/${subject.slug}`;
  const selfPath = `${subjectPath}/${specialization.slug}`;
  const overview = specialization.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));
  /* This specialization's programmes, not its subject's. */
  const coursesHref = levelCoursesHref({
    subject: subject.slug,
    subSubject: specialization.slug,
  });
  /* The enquiry says which specialization the student was reading about. */
  const counselling = counsellingHref({
    source: 'specialization',
    subject: subject.slug,
    specialization: specialization.slug,
    from: selfPath,
  });
  const universities = specialization.universities?.data ?? [];
  const universityTotal = specialization.universities?.total ?? universities.length;
  /* All of the subject's specializations, this one included, which is
     what the list the link opens shows. */
  const allInSubject =
    specialization.siblingTotal != null ? specialization.siblingTotal + 1 : null;

  /* Numbered in the order they appear, counting only the ones that render. */
  const courses = specialization.courses ?? [];
  const groups = levels ?? [];
  const filed = levelTotal(groups);
  const order: string[] = [];
  if (hasOverview) order.push('about');
  if (groups.length || courses.length) order.push('programs');
  if (countries.length) order.push('destinations');
  if (siblings.length) order.push('related');
  /* Funding, then the consultants hand-off; with no awards recorded the
     hand-off stands alone, since the reference shows consultants on every
     specialization page, programmes or not. */
  order.push(scholarships.length ? 'scholarship-funding' : 'consultants');
  const n = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? null : String(index + 1).padStart(2, '0');
  };
  /* Paper and white alternate by position, not by name: a section that stands
     down must not leave two of the same shade touching. */
  const band = (id: string) =>
    order.indexOf(id) % 2 === 0 ? 'sec sec--paper' : 'sec sec--white';

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Subjects', href: '/subjects' },
              { label: subject.name, href: subjectPath },
              { label: specialization.name },
            ]}
          />
          {/* The subject page's hero, tile and all, as the design draws a
              specialization: this page had the text alone, starting at the
              page edge, and did not look like the page one step above it. */}
          <div className="subjhero">
            <span className="subjhero__icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <path d="M4 5h16v14H4z M4 9h16" />
              </svg>
            </span>
            <div>
            <p className="hero__eyebrow">
              Specialization<b>·</b>
              <Link href={subjectPath}>{subject.name}</Link>
            </p>
            <h1 className="hero__h1">Study {specialization.name} abroad</h1>
            {specialization.shortDescription ? (
              <p className="hero__sub">{specialization.shortDescription}</p>
            ) : null}
            <div className="btn-row" style={{ marginTop: 22 }}>
              <Link className="btn btn--lg" href={coursesHref}>
                Find my programmes{' '}
                <span className="btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
              <Link className="btn btn--lg btn--ghost" href={subjectPath}>
                All {subject.name}
              </Link>
            </div>
            </div>
          </div>
        </div>
      </section>

      {hasOverview ? (
        <section className={band('about')} id="about">
          <div className="wrap">
            <SectionHead
              n={n('about')}
              eyebrow="Overview"
              title={`About ${specialization.name}`}
            />
            <div className="prose">
              <RichText value={overview!} />
            </div>
          </div>
        </section>
      ) : null}

      {groups.length || courses.length ? (
        <section className={band('programs')} id="programs">
          <div className="wrap">
            <SectionHead
              n={n('programs')}
              eyebrow="Programmes"
              title={
                groups.length
                  ? `${specialization.name} programmes by level`
                  : `${specialization.name} programmes`
              }
              lead={
                groups.length
                  ? `${formatNumber(filed)} published ${filed === 1 ? 'programme' : 'programmes'}, each under the level it is taught at.`
                  : 'Published programmes recorded against this specialization.'
              }
            >
              {/* The reference ends its course list with "View all N
                  courses", filtered to the specialization. The subject's
                  whole list stays as the second way out. */}
              <p className="sec-head__cta specprog__ctas">
                <Link className="linkcta" href={coursesHref}>
                  {groups.length
                    ? `View all ${formatNumber(filed)} ${specialization.name} ${filed === 1 ? 'programme' : 'programmes'}`
                    : `View all ${specialization.name} programmes`}{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
                <Link className="linkcta" href={`/courses?subject=${subject.slug}`}>
                  Every {subject.name} programme{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </p>
            </SectionHead>
            {groups.length ? (
              <CourseLevels
                groups={groups}
                branch={false}
                allHref={(level) =>
                  levelCoursesHref({
                    subject: subject.slug,
                    subSubject: specialization.slug,
                    level,
                  })
                }
              />
            ) : (
              <CourseCards courses={courses} />
            )}
          </div>
        </section>
      ) : null}

      {countries.length ? (
        <section
          className={band('destinations') + sparseBandClass(countries.length)}
          id="destinations"
        >
          <div className="wrap">
            <SectionHead
              n={n('destinations')}
              eyebrow="Destinations"
              title={`Where you can study ${specialization.name}`}
              lead={destinationsLead({
                name: specialization.name,
                countries,
                open: `Open one to see ${specialization.name} there.`,
                legacy: `${countries.length} ${countries.length === 1 ? 'destination lists' : 'destinations list'} this specialization. Open one to see ${specialization.name} there.`,
              })}
            >
              {/* The section's link, set as one: it was a second grey
                  paragraph with no gap, and read as the sentence's last
                  line. */}
              <p className="sec-head__cta">
                <Link className="linkcta" href="/study-abroad">
                  All destinations{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </p>
            </SectionHead>
            <DestinationSwitcher
              countries={countries}
              label={specialization.name}
              within={`${subject.slug}/${specialization.slug}`}
            />
          </div>
        </section>
      ) : null}

      {siblings.length ? (
        <section className={`${band('related')} sec--tight`} id="related">
          <div className="wrap">
            {/* The design's compact head for this one. With the full split
                head, a secondary section carried a three-line 48px title
                under a main section whose title was 29px. */}
            <div className="sec-head sec-head--compact">
              <div>
                <p className="eyebrow">
                  {n('related') ? (
                    <span className="eyebrow__n">{n('related')}</span>
                  ) : null}{' '}
                  Related
                </p>
                <h2 className="sec-title sec-title--sm">
                  Other {subject.name} specializations
                </h2>
                <p className="sec-lead">
                  The rest of this subject, if this one is not quite the fit.
                </p>
              </div>
            </div>
            {/* The design's card: a line about it, the levels it is taught
                at and how many programmes, as the subject page draws the
                same branches. Each part shows only when it is recorded. */}
            <div className="specgrid">
              {siblings.map((sibling) => {
                const levelNames = (sibling.levels ?? []).map((row) => row.name).join(', ');
                const count = sibling.publishedCourseCount ?? 0;
                return (
                  <article className="speccard" key={sibling.id}>
                    <Link
                      className="speccard__btn"
                      href={`${subjectPath}/${sibling.slug}`}
                    >
                      <span className="speccard__top">
                        <span className="label">Specialization</span>
                      </span>
                      <span className="speccard__name">{sibling.name}</span>
                      {sibling.shortDescription ? (
                        <span className="speccard__desc">{sibling.shortDescription}</span>
                      ) : null}
                      {levelNames || count ? (
                        <span className="speccard__foot">
                          <span className="speccard__levels">{levelNames}</span>
                          {count ? (
                            <span className="speccard__count datum">
                              {programmeCount(count)}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      <span className="speccard__cta">
                        Explore specialization <span aria-hidden="true">→</span>
                      </span>
                    </Link>
                  </article>
                );
              })}
            </div>
            {/* The page is sent a dozen of them and some subjects have
                more: the rest are on the subject's own list. */}
            <p className="h-more">
              <Link className="linkcta" href={`${subjectPath}/specializations`}>
                All {subject.name} specializations
                {allInSubject ? ` (${formatNumber(allInSubject)})` : ''}{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      {scholarships.length ? (
        <section className={band('scholarship-funding')} id="scholarship-funding">
          <div className="wrap">
            <SectionHead
              n={n('scholarship-funding')}
              eyebrow="Funding"
              title={`Scholarships for ${specialization.name}`}
              lead={`Awards are recorded against a subject, not a specialization, so these are the ones recorded against ${subject.name}. ${FUNDING_CAVEAT}`}
            >
              <p className="sec-head__cta">
                <Link className="linkcta" href={`/scholarships?subject=${subject.slug}`}>
                  All {subject.name} scholarships{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </p>
            </SectionHead>
            <div className="schgroup">
              <div className="schgroup__head">
                <p className="path__h">
                  Recorded against {subject.name}{' '}
                  <span className="schgroup__n datum">{scholarships.length}</span>
                </p>
              </div>
              <ScholarshipCards scholarships={scholarships} />
            </div>
            <ConsultantsCta field={specialization.name} />
          </div>
        </section>
      ) : (
        <section className={`${band('consultants')} sec--tight`} id="consultants">
          <div className="wrap">
            <ConsultantsCta field={specialization.name} />
          </div>
        </section>
      )}

      <MatchBand
        heading={`Found ${specialization.name}?`}
        href={coursesHref}
        talkHref={counselling}
      />

      <PlanBand
        heading={`Thinking about ${specialization.name}?`}
        body="Tell us your academic profile, goals and budget, and we'll show you which destinations run it and what you would need."
        secondary={{ href: '/specializations', label: 'Browse specializations' }}
      />

      <ConnectBand
        actions={[
          { href: coursesHref, label: 'Explore courses' },
          {
            href: `/scholarships?subject=${subject.slug}`,
            label: 'Find scholarships',
            ghost: true,
          },
          { href: counselling, label: 'Talk to a Universta advisor', ghost: true },
        ]}
        groups={[
          {
            title: 'Specializations',
            items: siblings.map((row) => ({
              id: row.id,
              name: row.name,
              href: `${subjectPath}/${row.slug}`,
            })),
            total: specialization.siblingTotal ?? undefined,
          },
          /* As the design has it: "Software Engineering in Australia",
             opening exactly that, where this used to open the country's
             general guide. The places that teach it, in the band's order. */
          {
            title: 'Destinations',
            items: (teaching.length ? teaching : countries).map((row) => ({
              id: row.id,
              name: `${specialization.name} in ${inCountry(row.name, row.iso2Code)}`,
              href: `/study-abroad/${row.slug}/${subject.slug}/${specialization.slug}`,
              note: row.courseCount ? programmeCount(row.courseCount) : null,
            })),
            total: teaching.length || countries.length,
          },
          {
            title: `Universities teaching ${specialization.name}`,
            items: universities.map((row) => ({
              id: row.id,
              name: row.name,
              href: universityHref(row.slug),
              note: row.country?.name ?? null,
            })),
            total: universityTotal,
          },
          {
            title: 'Scholarships',
            items: scholarships.map((row) => ({
              id: row.slug,
              name: row.title,
              href: `/scholarships/${row.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}
