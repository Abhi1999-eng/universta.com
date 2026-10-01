import Link from 'next/link';
import type { SpecializationDetail } from '@/lib/catalog';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { CourseCards } from './CourseCards';
import { Crumbs } from './Crumbs';
import { FlagMark } from './FlagMark';
import { sparseBandClass, switcherClass } from './switcher';
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
}: {
  specialization: SpecializationDetail;
}) {
  const { subject, siblings, countries } = specialization;
  const subjectPath = `/subjects/${subject.slug}`;
  const overview = specialization.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));

  /* Numbered in the order they appear, counting only the ones that render. */
  const courses = specialization.courses ?? [];
  const order: string[] = [];
  if (hasOverview) order.push('about');
  if (courses.length) order.push('programs');
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
          <div className="hero__lead">
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

      {courses.length ? (
        <section className={band('programs')} id="programs">
          <div className="wrap">
            <SectionHead
              n={n('programs')}
              eyebrow="Programmes"
              title={`${specialization.name} programmes`}
              lead="Published programmes recorded against this specialization."
            >
              <p className="sec-lead">
                <Link href={`/courses?subject=${subject.slug}`}>
                  Every {subject.name} programme{' '}
                  <span aria-hidden="true">→</span>
                </Link>
              </p>
            </SectionHead>
            <CourseCards courses={courses} />
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
              lead={`${countries.length} ${countries.length === 1 ? 'destination lists' : 'destinations list'} this specialization. Open one to see its fees, visa route and intakes.`}
            />
            <div className={switcherClass(countries.length)}>
              {countries.map((country) => (
                <Link
                  key={country.id}
                  className="switcher__item"
                  href={`/study-abroad/${country.slug}`}
                >
                  <FlagMark iso2Code={country.iso2Code} bands={null} />
                  <span className="cchip__name">{country.name}</span>
                  <span className="switcher__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {siblings.length ? (
        <section className={band('related')} id="related">
          <div className="wrap">
            <SectionHead
              n={n('related')}
              eyebrow="Related"
              title={`Other ${subject.name} specializations`}
              lead="The rest of this subject, if this one is not quite the fit."
            />
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
