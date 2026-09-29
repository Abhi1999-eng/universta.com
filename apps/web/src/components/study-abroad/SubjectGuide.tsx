import Link from 'next/link';
import type { Course, SubjectDetail } from '@/lib/catalog';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { formatNumber } from '@/lib/format';
import { CourseCards } from './CourseCards';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { Longform } from './Longform';
import { PlanBand } from './PlanBand';
import { SectionHead } from './SectionHead';

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
}: {
  subject: SubjectDetail;
  scholarships: Array<{ id: string; name: string; slug: string }>;
}) {
  const specializations = subject.subSubjects ?? [];
  const countries = subject.countries ?? [];
  const courses: Course[] = subject.featuredCourses ?? [];
  const levels = subject.courseCountsByLevel ?? [];
  const tests = subject.tests ?? [];
  const overview = subject.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));

  const order: string[] = ['about'];
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
      <section className={band('about')} id="about">
        <div className="wrap">
          <nav className="crumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true"> › </span>
            <Link href="/subjects">Subjects</Link>
            <span aria-hidden="true"> › </span>
            <span aria-current="page">{subject.name}</span>
          </nav>

          <SectionHead
            n={n('about')}
            eyebrow="Subject"
            title={subject.name}
            lead={subject.shortDescription ?? undefined}
          >
            <p className="sec-lead">
              {formatNumber(subject.publishedCourseCount) || '—'} programmes ·{' '}
              {specializations.length || '—'} specializations ·{' '}
              {countries.length || '—'} destinations
            </p>
          </SectionHead>

          {hasOverview ? (
            <Longform label={`More about ${subject.name}`}>
              <div className="prose">
                <RichText value={overview!} />
              </div>
            </Longform>
          ) : null}
        </div>
      </section>

      {specializations.length ? (
        <section className={band('specializations')} id="specializations">
          <div className="wrap">
            <SectionHead
              n={n('specializations')}
              eyebrow="Specializations"
              title="Choose a specialization"
              lead={`The branches of ${subject.name} we cover. Each one has its own page.`}
            />
            <div className="specgrid">
              {specializations.map((row) => (
                <article className="speccard" key={row.id}>
                  <Link
                    className="speccard__btn"
                    href={`/subjects/${subject.slug}/${row.slug}`}
                  >
                    <span className="speccard__top">
                      <span className="label">Specialization</span>
                      {row.featured ? (
                        <span className="badge badge--req">Popular</span>
                      ) : null}
                    </span>
                    <span className="speccard__name">{row.name}</span>
                    {row.shortDescription ? (
                      <span className="speccard__desc">
                        {row.shortDescription}
                      </span>
                    ) : null}
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

      {countries.length ? (
        <section className={band('destinations')} id="destinations">
          <div className="wrap">
            <SectionHead
              n={n('destinations')}
              eyebrow="Destinations"
              title={`Where you can study ${subject.name}`}
              lead="Open a destination to see its fees, visa route and intakes."
            />
            <div className="chip-row">
              {countries.map((country) => (
                <Link
                  key={country.id}
                  className="chipbtn"
                  href={`/study-abroad/${country.slug}`}
                >
                  {country.name}
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
            <div className="chip-row">
              {scholarships.map((row) => (
                <Link
                  key={row.id}
                  className="chipbtn"
                  href={`/scholarships/${row.slug}`}
                >
                  {row.name}
                </Link>
              ))}
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
        ]}
      />
    </>
  );
}
