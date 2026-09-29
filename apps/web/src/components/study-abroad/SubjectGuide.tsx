import Link from 'next/link';
import type { Course, SubjectDetail } from '@/lib/catalog';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { formatNumber } from '@/lib/format';
import { CourseCards } from './CourseCards';
import { Crumbs } from './Crumbs';
import { FlagMark } from './FlagMark';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { Longform } from './Longform';
import { PlanBand } from './PlanBand';
import { SectionHead } from './SectionHead';
import { SubjectSpecializations } from './SubjectSpecializations';

/**
 * A subject's guide, in the approved design.
 *
 * The reference builds subjects from the same stylesheet and the same section
 * bands as the country guides, so this is the study-abroad language rather
 * than a second one: numbered eyebrows, paper and white alternating, the
 * closing navy band.
 *
 * Sections stand down rather than render empty, and both the numbering and the
 * shade are taken from what actually renders, so a subject with no courses yet
 * still reads as a finished page and never shows two paper bands touching.
 */
export function SubjectGuide({
  subject,
  scholarships,
  universities = [],
}: {
  subject: SubjectDetail;
  scholarships: Array<{ id: string; name: string; slug: string }>;
  /** Cross-links only: the reference gives a subject no universities section,
   *  so these close the page in the connect band rather than open one. */
  universities?: Array<{ id: string; name: string; slug: string }>;
}) {
  const specializations = subject.subSubjects ?? [];
  const countries = subject.countries ?? [];
  const courses: Course[] = subject.featuredCourses ?? [];
  const levels = subject.courseCountsByLevel ?? [];
  const tests = subject.tests ?? [];
  const overview = subject.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));

  /* Only the figures this record actually has: a strip of dashes says less
     than a shorter strip does. */
  const stats = [
    specializations.length
      ? { label: 'Specializations', value: formatNumber(specializations.length) }
      : null,
    levels.length
      ? { label: 'Study levels', value: levels.map((row) => row.level.name).join(', ') }
      : null,
    subject.publishedCourseCount
      ? { label: 'Programmes profiled', value: formatNumber(subject.publishedCourseCount) }
      : null,
    universities.length
      ? { label: 'Universities', value: formatNumber(universities.length) }
      : null,
    countries.length
      ? { label: 'Destinations', value: formatNumber(countries.length) }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const order: string[] = [];
  if (hasOverview) order.push('about');
  if (specializations.length) order.push('specializations');
  if (countries.length) order.push('destinations');
  if (courses.length) order.push('programs');
  if (tests.length) order.push('tests');
  if (scholarships.length) order.push('scholarship-funding');

  const n = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? null : String(index + 1).padStart(2, '0');
  };
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
              { label: subject.name },
            ]}
          />
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
                Subject<b>·</b>
                {specializations.length} specializations
              </p>
              <h1 className="hero__h1">Study {subject.name} abroad</h1>
              {subject.shortDescription ? (
                <p className="hero__sub">{subject.shortDescription}</p>
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
                <Link className="btn btn--lg btn--ghost" href="/universities">
                  Browse universities
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The reference states the shape of a subject before it explains it:
          how many branches, which levels, and how much of it we have profiled.
          Each figure stands down on its own rather than showing a zero. */}
      {stats.length ? (
        <section className="sec sec--white sec--tight">
          <div className="wrap">
            <div className="unisnap unisnap--fit">
              {stats.map((row) => (
                <div className="unisnap__cell" key={row.label}>
                  <span className="label">{row.label}</span>
                  <b>{row.value}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hasOverview ? (
        <section className={band('about')} id="about">
          <div className="wrap">
            <SectionHead
              n={n('about')}
              eyebrow="Overview"
              title={`About ${subject.name}`}
              lead={`${formatNumber(subject.publishedCourseCount) || '—'} programmes · ${specializations.length || '—'} specializations · ${countries.length || '—'} destinations`}
            />
            <Longform label={`More about ${subject.name}`}>
              <div className="prose">
                <RichText value={overview!} />
              </div>
            </Longform>
          </div>
        </section>
      ) : null}

      {specializations.length ? (
        <section className={band('specializations')} id="specializations">
          <div className="wrap">
            <SectionHead
              n={n('specializations')}
              eyebrow="Specializations"
              title="Choose a specialization"
              lead={`The branches of ${subject.name} we cover. Each one has its own page.`}
            />
            <SubjectSpecializations
              subjectName={subject.name}
              subjectSlug={subject.slug}
              branches={specializations}
            />
          </div>
        </section>
      ) : null}

      {countries.length ? (
        <section className={band('destinations')} id="destinations">
          <div className="wrap">
            <SectionHead
              n={n('destinations')}
              eyebrow="Destinations"
              title={`Where you can study ${subject.name}`}
              lead="Open a destination to see its fees, visa route and intakes."
            />
            <div className="switcher">
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

      {courses.length ? (
        <section className={band('programs')} id="programs">
          <div className="wrap">
            <SectionHead
              n={n('programs')}
              eyebrow="Programmes"
              title={`${subject.name} programmes`}
              lead={
                levels.length
                  ? levels
                      .map((row) => `${row.level.name} (${row.count})`)
                      .join(' · ')
                  : undefined
              }
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

      {tests.length ? (
        <section className={band('tests')} id="tests">
          <div className="wrap">
            <SectionHead
              n={n('tests')}
              eyebrow="Requirements"
              title={`Tests you may need for ${subject.name}`}
              lead="Language tests accepted by the destinations that teach this subject. Requirements are set per programme, so confirm with the university before you book one."
            />
            <div className="examtests">
              <div className="examtests__group">
                <p className="path__h">English language tests</p>
                <ul className="examtests__list">
                  {tests.map((test) => (
                    <li className="examchip" key={test.code}>
                      <span className="examchip__main">
                        <span className="examchip__name">{test.name}</span>
                        <span className="examchip__cat">
                          English language test
                        </span>
                      </span>
                      {test.minScore ? (
                        <span className="examchip__meta">
                          <em>Highest published minimum: {test.minScore}</em>
                        </span>
                      ) : null}
                      <span className="examchip__side">
                        <span className="badge badge--neutral">
                          Accepted by {test.countries}{' '}
                          {test.countries === 1 ? 'destination' : 'destinations'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="examtests__note">
                  A destination that lists a test as optional still accepts it;
                  many waive it when your earlier study was in English.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {scholarships.length ? (
        <section className={band('scholarship-funding')} id="scholarship-funding">
          <div className="wrap">
            <SectionHead
              n={n('scholarship-funding')}
              eyebrow="Funding"
              title={`Scholarships for ${subject.name}`}
              lead="Awards recorded against this subject."
            />
            <div className="schgroup">
              <div className="schgroup__head">
                <p className="path__h">
                  Recorded against {subject.name}{' '}
                  <span className="schgroup__n datum">{scholarships.length}</span>
                </p>
              </div>
              <div className="schgrid schgrid--3">
                {scholarships.map((row) => (
                  <article className="schcard" key={row.id}>
                    <div className="schcard__top">
                      <span className="badge badge--neutral">Scholarship</span>
                    </div>
                    <h3 className="schcard__t">
                      <Link href={`/scholarships/${row.slug}`}>{row.name}</Link>
                    </h3>
                    <div className="schcard__foot">
                      <Link className="linkcta" href={`/scholarships/${row.slug}`}>
                        View award{' '}
                        <span className="linkcta__arrow" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="consultcta">
              <div className="consultcta__copy">
                <p className="eyebrow eyebrow--plain">Consultants</p>
                <h3 className="consultcta__t">
                  Consultants who cover {subject.name}
                </h3>
                <p className="consultcta__d">
                  Compare the destinations they work with, the services they
                  offer and how they are verified.
                </p>
              </div>
              <div className="consultcta__actions">
                <Link className="btn" href="/study-abroad-consultants">
                  Find consultants{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <MatchBand
        heading="Found your field?"
        href={`/courses?subject=${subject.slug}`}
      />

      <PlanBand
        heading={`Thinking about ${subject.name}?`}
        body="Tell us your academic profile, goals and budget, and we'll show you which destinations run it and what you would need."
        secondary={{ href: '/subjects', label: 'Browse all subjects' }}
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
            items: specializations.map((row) => ({
              id: row.id,
              name: row.name,
              href: `/subjects/${subject.slug}/${row.slug}`,
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
          {
            title: 'Universities',
            items: universities.map((row) => ({
              id: row.id,
              name: row.name,
              href: `/universities/${row.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}
