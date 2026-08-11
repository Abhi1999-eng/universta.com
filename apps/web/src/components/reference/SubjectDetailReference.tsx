import Link from 'next/link';
import type { Course, SubjectDetail } from '@/lib/catalog';
import { counsellingHref } from '@/lib/counselling-link';
import { formatNumber } from '@/lib/format';

/** The client-approved subject detail page.
 *
 * The template runs 21 blocks around a sample Computer Science page: skills,
 * curriculum, careers, hiring industries, admission requirements, a monthly
 * cost estimate, a career-outlook dashboard, future scope, student stories, a
 * "is this right for you" quiz and a resource rail. Universta stores a subject
 * as a name, description, overview, specialisations, level breakdown and the
 * courses attached to it — so the blocks that have data are rendered and the
 * rest are dropped rather than filled with invented career and salary claims.
 *
 * The sub-navigation is assembled from the blocks that rendered, so it can
 * never link to an anchor that is not on the page. */

export type SubjectDetailReferenceProps = {
  subject: SubjectDetail;
  countries: Array<{ value: string; label: string; count: number }>;
  universities: Array<{ name: string; slug: string; country: string | null }>;
  scholarships: Array<{ title: string; slug: string; amount: string | null; type: string | null }>;
  relatedSubjects: Array<{ name: string; slug: string; courses: number }>;
};

const SKIP_WORDS = new Set(['of', 'in', 'and', 'the', 'for', 'a', 'an', '&']);

function initials(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word && !SKIP_WORDS.has(word.toLowerCase()));
  if (words.length === 0) return value.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function courseSubtitle(course: Course) {
  return [course.courseLevel.name, course.subSubject?.name].filter(Boolean).join(' · ');
}

export function SubjectDetailReference(props: SubjectDetailReferenceProps) {
  const { subject, countries, universities, scholarships, relatedSubjects } = props;
  const specialisations = subject.subSubjects ?? [];
  const levels = (subject.courseCountsByLevel ?? []).filter((entry) => entry.count > 0);
  const courses = subject.featuredCourses ?? [];

  /** Counselling booked from a subject keeps that provenance on the lead. */
  const counselling = counsellingHref({
    source: 'subject',
    subject: subject.slug,
    from: `/subjects/${subject.slug}`,
  });

  const nav = [
    ['glance', 'At a glance'],
    subject.overview && ['about', `About ${subject.name}`],
    specialisations.length && ['specializations', 'Specialisations'],
    levels.length && ['levels', 'Degree levels'],
    courses.length && ['courses', 'Courses'],
    countries.length && ['countries', 'Destinations'],
    universities.length && ['universities', 'Universities'],
    scholarships.length && ['scholarships', 'Scholarships'],
    relatedSubjects.length && ['related', 'Related subjects'],
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <div className="cref cref-subj">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <Link href="/subjects">Subjects</Link> ›{' '}
          <span aria-current="page">{subject.name}</span>
        </nav>
      </div>

      {/* HERO */}
      <section className="wrap" style={{ paddingTop: 8 }}>
        <div className="hero-banner">
          <span className="hero-parent">Subject</span>
          <h1>{subject.name}</h1>
          {subject.shortDescription ? <p className="lede">{subject.shortDescription}</p> : null}
          <div className="hero-metrics">
            <div className="hm">
              <div className="v">{formatNumber(subject.publishedCourseCount) || '—'}</div>
              <div className="k">Published courses</div>
            </div>
            <div className="hm">
              <div className="v">{subject.publishedSubSubjectCount || '—'}</div>
              <div className="k">Specialisations</div>
            </div>
            <div className="hm">
              <div className="v">{subject.availableCountryCount || '—'}</div>
              <div className="k">Destinations</div>
            </div>
            <div className="hm">
              <div className="v">{levels.length || '—'}</div>
              <div className="k">Degree levels</div>
            </div>
          </div>
          <div className="hero-cta">
            <Link href={`/courses?subject=${subject.slug}#discovery`} className="btn btn-white btn-lg">
              Explore courses
            </Link>
            {specialisations.length ? (
              <Link
                href={`/subjects/${subject.slug}/specializations`}
                className="btn btn-glass btn-lg"
              >
                View specialisations
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="wrap layout" style={{ paddingTop: 32 }}>
        <main className="main">
          {/* AT A GLANCE */}
          <section className="block" id="glance" style={{ paddingTop: 28 }}>
            <div className="block-head">
              <span className="eyebrow">Snapshot</span>
              <h2>{subject.name} at a glance</h2>
            </div>
            <div className="kpi-grid">
              <div className="kpi">
                <div className="kk">Published courses</div>
                <div className="kv">{formatNumber(subject.publishedCourseCount) || '—'}</div>
              </div>
              <div className="kpi">
                <div className="kk">Specialisations</div>
                <div className="kv">{subject.publishedSubSubjectCount || '—'}</div>
              </div>
              <div className="kpi">
                <div className="kk">Destinations</div>
                <div className="kv">{subject.availableCountryCount || '—'}</div>
              </div>
              <div className="kpi">
                <div className="kk">Universities</div>
                <div className="kv">{universities.length ? formatNumber(universities.length) : '—'}</div>
              </div>
              <div className="kpi">
                <div className="kk">Linked scholarships</div>
                <div className="kv">{scholarships.length || '—'}</div>
              </div>
            </div>
          </section>

          {/* ABOUT */}
          {subject.overview ? (
            <section className="block" id="about">
              <div className="block-head">
                <span className="eyebrow">Overview</span>
                <h2>About {subject.name}</h2>
              </div>
              <div className="prose">
                {subject.overview.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : null}

          {/* SPECIALISATIONS */}
          {specialisations.length ? (
            <section className="block" id="specializations">
              <div className="block-head row-between">
                <div>
                  <span className="eyebrow">Focus areas</span>
                  <h2>Specialisations</h2>
                </div>
                <Link className="link-more" href={`/subjects/${subject.slug}/specializations`}>
                  All specialisations →
                </Link>
              </div>
              <div className="grid g2">
                {specialisations.slice(0, 8).map((item) => (
                  <Link
                    key={item.id}
                    className="card spec-card"
                    href={`/courses?subject=${subject.slug}&subSubject=${item.slug}#discovery`}
                  >
                    <span className="spec-ic" aria-hidden="true">
                      {initials(item.name)}
                    </span>
                    <div>
                      <div className="sn">{item.name}</div>
                      {item.shortDescription ? <div className="sd">{item.shortDescription}</div> : null}
                    </div>
                    <span className="go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* LEVELS */}
          {levels.length ? (
            <section className="block" id="levels">
              <div className="block-head">
                <span className="eyebrow">By qualification</span>
                <h2>Study {subject.name} at any level</h2>
                <p className="sub">Published course counts for each degree level.</p>
              </div>
              <div className="grid g3">
                {levels.map((entry) => (
                  <Link
                    key={entry.level.id}
                    className="card mini-card"
                    href={`/courses?subject=${subject.slug}${entry.level.code ? `&level=${entry.level.code}` : ''}#discovery`}
                  >
                    <span className="mini-ic" aria-hidden="true">
                      {initials(entry.level.name)}
                    </span>
                    <div>
                      <h3>{entry.level.name}</h3>
                      <div className="mc-sub">
                        {formatNumber(entry.count)} course{entry.count === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* COURSES */}
          {courses.length ? (
            <section className="block" id="courses">
              <div className="block-head row-between">
                <div>
                  <span className="eyebrow">Related programmes</span>
                  <h2>Courses in {subject.name}</h2>
                </div>
                <Link className="link-more" href={`/courses?subject=${subject.slug}#discovery`}>
                  All {subject.name} courses →
                </Link>
              </div>
              <div className="grid g2">
                {courses.map((course) => (
                  <Link key={course.id} className="card course-chip" href={`/courses/${course.slug}`}>
                    <span className="cc-ic" aria-hidden="true">
                      {initials(course.courseLevel.name)}
                    </span>
                    <div>
                      <div className="cn">{course.name}</div>
                      <div className="cs">{courseSubtitle(course)}</div>
                    </div>
                    <span className="go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* DESTINATIONS */}
          {countries.length ? (
            <section className="block" id="countries">
              <div className="block-head">
                <span className="eyebrow">Where to study</span>
                <h2>Destinations teaching {subject.name}</h2>
                <p className="sub">Every destination with a published course offering in this subject.</p>
              </div>
              <div className="card dest-block">
                <h3>Browse {subject.name} by destination</h3>
                <div className="dest-flags">
                  {countries.map((country) => (
                    <Link
                      key={country.value}
                      className="dest-flag"
                      href={`/courses?subject=${subject.slug}&country=${country.value}#discovery`}
                    >
                      <span className="cc">{initials(country.label)}</span>
                      {country.label}
                      <span style={{ color: 'var(--muted)' }}>{formatNumber(country.count)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* UNIVERSITIES */}
          {universities.length ? (
            <section className="block" id="universities">
              <div className="block-head row-between">
                <div>
                  <span className="eyebrow">Where it is taught</span>
                  <h2>Universities</h2>
                </div>
                <Link className="link-more" href="/universities">
                  All universities →
                </Link>
              </div>
              <div className="grid g2">
                {universities.map((university) => (
                  <Link
                    key={university.slug}
                    className="card uni-row"
                    href={`/universities/${university.slug}`}
                  >
                    <span className="ulogo" aria-hidden="true">
                      {initials(university.name)}
                    </span>
                    <div>
                      <h3>{university.name}</h3>
                      {university.country ? <div className="um">{university.country}</div> : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* SCHOLARSHIPS */}
          {scholarships.length ? (
            <section className="block" id="scholarships">
              <div className="block-head row-between">
                <div>
                  <span className="eyebrow">Funding</span>
                  <h2>Scholarships</h2>
                </div>
                <Link className="link-more" href={`/scholarships?subject=${subject.slug}`}>
                  All scholarships →
                </Link>
              </div>
              <div className="grid g3">
                {scholarships.map((scholarship) => (
                  <article className="card sch" key={scholarship.slug}>
                    {scholarship.type ? <span className="s-cat">{scholarship.type}</span> : null}
                    <h3>
                      <Link href={`/scholarships/${scholarship.slug}`}>{scholarship.title}</Link>
                    </h3>
                    {scholarship.amount ? <div className="s-amt">{scholarship.amount}</div> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* RELATED */}
          {relatedSubjects.length ? (
            <section className="block" id="related">
              <div className="block-head">
                <span className="eyebrow">Explore adjacent</span>
                <h2>Related subjects</h2>
              </div>
              <div className="grid g3">
                {relatedSubjects.map((item) => (
                  <Link key={item.slug} className="card mini-card" href={`/subjects/${item.slug}`}>
                    <span className="mini-ic" aria-hidden="true">
                      {initials(item.name)}
                    </span>
                    <div>
                      <h3>{item.name}</h3>
                      <div className="mc-sub">
                        {formatNumber(item.courses)} course{item.courses === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span className="go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* CTA */}
          <section className="block">
            <div className="final-cta">
              <h2>Ready to shortlist {subject.name} courses?</h2>
              <p>
                Filter the published catalogue by level, destination and study mode, then compare
                your shortlist side by side.
              </p>
              <div className="hero-ctas">
                <Link
                  href={`/courses?subject=${subject.slug}#discovery`}
                  className="btn btn-secondary btn-lg"
                >
                  Browse courses
                </Link>
                <Link href={counselling} className="btn btn-outline btn-lg">
                  Book free counselling
                </Link>
              </div>
            </div>
          </section>
        </main>

        <aside className="side">
          <div className="side-card">
            <h3>Talk it through</h3>
            <p>A counsellor can help you narrow {subject.name} down to a realistic shortlist.</p>
            <Link className="btn btn-primary btn-block" href={counselling}>
              Book free counselling
            </Link>
          </div>
          {nav.length ? (
            <div className="side-card">
              <h3>On this page</h3>
              <div className="side-links">
                {nav.map(([id, label]) => (
                  <a key={id} href={`#${id}`}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
