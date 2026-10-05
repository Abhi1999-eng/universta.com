import Link from 'next/link';
import type { CourseLevelGroup, SpecializationDetail } from '@/lib/catalog';
import { levelCoursesHref, levelTotal } from '@/lib/course-levels';
import { formatNumber } from '@/lib/format';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { CourseCards } from './CourseCards';
import { CourseLevels } from './CourseLevels';
import { Crumbs } from './Crumbs';
import { DestinationSwitcher } from './DestinationSwitcher';
import { sparseBandClass } from './switcher';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { PlanBand } from './PlanBand';
import { SectionHead } from './SectionHead';

/**
 * A specialization's guide, at /subjects/<subject>/<specialization>.
 *
 * It is addressed inside its subject because that pair is what makes it
 * unique: "Animal Science" is taught under Agriculture, under Science and
 * under Biological & Life Sciences, and those are three different pages.
 * Every link out of here keeps the pair together for the same reason.
 *
 * Sections stand down rather than render empty. 927 of these arrived at once
 * and the editorial work behind them lands over time, so the page has to read
 * as finished at every stage of that, not as a row of blank panels. The
 * numbered run is built from what actually renders, so the numbering never
 * skips.
 */
export function SpecializationGuide({
  specialization,
  levels = null,
}: {
  specialization: SpecializationDetail;
  /** Its courses filed under their study levels. Absent when that read
   *  failed; the mixed run of courses is shown instead, as before. */
  levels?: CourseLevelGroup[] | null;
}) {
  const { subject, siblings, countries } = specialization;
  const subjectPath = `/subjects/${subject.slug}`;
  const overview = specialization.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));

  /* Numbered in the order they appear, counting only the ones that render. */
  const courses = specialization.courses ?? [];
  const groups = levels ?? [];
  const filed = levelTotal(groups);
  const order: string[] = [];
  if (hasOverview) order.push('about');
  if (groups.length || courses.length) order.push('programs');
  if (countries.length) order.push('destinations');
  if (siblings.length) order.push('related');
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
              <Link
                className="btn btn--lg"
                href={`/courses?subject=${subject.slug}`}
              >
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
              <p className="sec-head__cta">
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
              lead={`${countries.length} ${countries.length === 1 ? 'destination lists' : 'destinations list'} this specialization. Open one to see ${specialization.name} there.`}
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
            <div className="specgrid">
              {siblings.map((sibling) => (
                <article className="speccard" key={sibling.id}>
                  <Link
                    className="speccard__btn"
                    href={`${subjectPath}/${sibling.slug}`}
                  >
                    <span className="speccard__top">
                      <span className="label">Specialization</span>
                    </span>
                    <span className="speccard__name">{sibling.name}</span>
                    <span className="speccard__cta">
                      View <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                </article>
              ))}
            </div>
            {/* The page is sent a dozen of them and some subjects have
                more: the rest are on the subject's own list. */}
            <p className="h-more">
              <Link className="linkcta" href={`${subjectPath}/specializations`}>
                All {subject.name} specializations{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      <MatchBand
        heading={`Found ${specialization.name}?`}
        href={`/courses?subject=${subject.slug}`}
      />

      <PlanBand
        heading={`Thinking about ${specialization.name}?`}
        body="Tell us your academic profile, goals and budget, and we'll show you which destinations run it and what you would need."
        secondary={{ href: '/specializations', label: 'Browse specializations' }}
      />

      <ConnectBand
        actions={[
          { href: `/courses?subject=${subject.slug}`, label: 'Explore courses' },
          {
            href: `/scholarships?subject=${subject.slug}`,
            label: 'Find scholarships',
            ghost: true,
          },
          { href: '/contact', label: 'Talk to a Universta advisor', ghost: true },
        ]}
        groups={[
          {
            title: 'Specializations',
            items: siblings.map((row) => ({
              id: row.id,
              name: row.name,
              href: `${subjectPath}/${row.slug}`,
            })),
          },
          {
            title: 'Destinations',
            items: countries.map((row) => ({
              id: row.id,
              name: row.name,
              href: `/study-abroad/${row.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}
