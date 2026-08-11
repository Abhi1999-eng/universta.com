import Link from 'next/link';
import type { Course, SubjectDetail } from '@/lib/catalog';
import { counsellingHref } from '@/lib/counselling-link';
import { formatNumber } from '@/lib/format';

/** The client-approved specialisations page.
 *
 * The template compares specialisations by salary, demand and difficulty, and
 * closes with skills, trends, stories and a resource rail. Universta records a
 * specialisation as a name, description and the courses mapped to it, so the
 * comparison rows are the real per-specialisation course counts and the blocks
 * with no backing data are omitted. */

export type SpecializationsReferenceProps = {
  subject: SubjectDetail;
  /** Real per-specialisation course counts from the course filter options. */
  counts: Record<string, number>;
  countries: Array<{ value: string; label: string; count: number }>;
  universities: Array<{ name: string; slug: string; country: string | null }>;
  courses: Course[];
  scholarships: Array<{ title: string; slug: string; amount: string | null; type: string | null }>;
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

const FAQS = [
  {
    q: 'What is a specialisation?',
    a: 'A specialisation is a named strand inside a subject — Artificial Intelligence inside Computer Science, for example. Courses are mapped to one, so filtering by a specialisation narrows the catalogue to the programmes that actually teach it.',
  },
  {
    q: 'Do I have to choose a specialisation before I apply?',
    a: 'Not always. Some programmes ask you to declare one at application, others let you choose after a common first year. The course record states which applies.',
  },
  {
    q: 'Can I compare courses across specialisations?',
    a: 'Yes. Shortlist courses from any specialisation and compare them side by side on tuition, duration, intakes and study modes.',
  },
];

export function SpecializationsReference(props: SpecializationsReferenceProps) {
  const { subject, counts, countries, universities, courses, scholarships } = props;
  const specialisations = subject.subSubjects ?? [];
  const ranked = [...specialisations].sort(
    (a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0),
  );
  const popular = ranked.slice(0, 6);

  /** Counselling booked from a specialisation list keeps its subject. */
  const counselling = counsellingHref({
    source: 'subject',
    subject: subject.slug,
    from: `/subjects/${subject.slug}/specializations`,
  });

  return (
    <div className="cref cref-subj">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <Link href="/subjects">Subjects</Link> ›{' '}
          <Link href={`/subjects/${subject.slug}`}>{subject.name}</Link> ›{' '}
          <span aria-current="page">Specialisations</span>
        </nav>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-in">
          <h1>
            Explore <span className="b">{subject.name}</span> specialisations
          </h1>
          <p className="lead">
            Narrow your path within {subject.name}. Each specialisation below opens the published
            courses mapped to it, with the universities and destinations that teach them.
          </p>

          <div className="hero-ctas">
            <a href="#all" className="btn btn-primary btn-lg">
              Explore specialisations
            </a>
            <Link
              href={`/courses?subject=${subject.slug}#discovery`}
              className="btn btn-outline btn-lg"
            >
              All {subject.name} courses
            </Link>
          </div>

          <div className="statgrid four">
            <div className="stat">
              <b>{specialisations.length || '—'}</b>
              <span>Specialisations</span>
            </div>
            <div className="stat">
              <b>{formatNumber(subject.publishedCourseCount) || '—'}</b>
              <span>Courses</span>
            </div>
            <div className="stat">
              <b>{universities.length || '—'}</b>
              <span>Universities</span>
            </div>
            <div className="stat">
              <b>{subject.availableCountryCount || '—'}</b>
              <span>Destinations</span>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap layout" style={{ paddingTop: 44 }}>
        <main className="main">
          {/* POPULAR */}
          {popular.length ? (
            <section className="section" id="popular" style={{ paddingTop: 0 }}>
              <div className="section-head row-between">
                <div>
                  <span className="eyebrow">Most courses</span>
                  <h2>Popular {subject.name} specialisations</h2>
                  <p className="sub">Ranked by the number of published courses mapped to each.</p>
                </div>
                <a className="link-more" href="#all">
                  All specialisations →
                </a>
              </div>
              <div className="grid g3">
                {popular.map((item, index) => (
                  <Link
                    key={item.id}
                    href={`/courses?subject=${subject.slug}&subSubject=${item.slug}#discovery`}
                    className="card subjtile"
                  >
                    <div className={`subj-img c${index % 6}`}>
                      <span className="si" aria-hidden="true">
                        {initials(item.name)}
                      </span>
                    </div>
                    <div className="subj-body">
                      <h3>{item.name}</h3>
                      {item.shortDescription ? (
                        <div className="subj-meta">
                          <span>{item.shortDescription}</span>
                        </div>
                      ) : null}
                      <div className="subj-foot">
                        <span className="tuit">
                          {counts[item.slug]
                            ? `${formatNumber(counts[item.slug])} course${counts[item.slug] === 1 ? '' : 's'}`
                            : ''}
                        </span>
                        <span className="go">Explore →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* ALL */}
          <section className="section" id="all">
            <div className="section-head">
              <span className="eyebrow">Every focus area</span>
              <h2>All {subject.name} specialisations</h2>
              <p className="sub">
                {specialisations.length
                  ? `${specialisations.length} published specialisation${specialisations.length === 1 ? '' : 's'}, each with its own course list.`
                  : 'No specialisations are published for this subject yet.'}
              </p>
            </div>
            {specialisations.length === 0 ? (
              <div className="cref-empty" data-testid="specialization-empty">
                <h3>No specialisations published yet</h3>
                <p>Browse every {subject.name} course instead.</p>
                <Link className="btn btn-primary" href={`/courses?subject=${subject.slug}#discovery`}>
                  Browse courses
                </Link>
              </div>
            ) : (
              <div className="grid g2">
                {ranked.map((item) => (
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
                      <div className="sd">
                        {counts[item.slug]
                          ? `${formatNumber(counts[item.slug])} course${counts[item.slug] === 1 ? '' : 's'}`
                          : (item.shortDescription ?? 'Published specialisation')}
                      </div>
                    </div>
                    <span className="go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* COURSES */}
          {courses.length ? (
            <section className="section" id="courses">
              <div className="section-head row-between">
                <div>
                  <span className="eyebrow">Programmes</span>
                  <h2>Courses across these specialisations</h2>
                </div>
                <Link className="link-more" href={`/courses?subject=${subject.slug}#discovery`}>
                  All courses →
                </Link>
              </div>
              <div className="grid g2">
                {courses.map((course) => (
                  <Link key={course.id} className="card course-chip" href={`/courses/${course.slug}`}>
                    <span className="cc-ic" aria-hidden="true">
                      {initials(course.subSubject?.name ?? course.courseLevel.name)}
                    </span>
                    <div>
                      <div className="cn">{course.name}</div>
                      <div className="cs">
                        {[course.courseLevel.name, course.subSubject?.name]
                          .filter(Boolean)
                          .join(' · ')}
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

          {/* DESTINATIONS */}
          {countries.length ? (
            <section className="section" id="best-countries">
              <div className="section-head">
                <span className="eyebrow">Where to study</span>
                <h2>Best destinations for {subject.name}</h2>
                <p className="sub">Destinations with published course offerings in this subject.</p>
              </div>
              <div className="card dest-block">
                <h3>Browse by destination</h3>
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
            <section className="section" id="universities">
              <div className="section-head row-between">
                <div>
                  <span className="eyebrow">Institutions</span>
                  <h2>Universities teaching {subject.name}</h2>
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
            <section className="section" id="scholarships">
              <div className="section-head row-between">
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

          {/* FAQ */}
          <section className="section" id="faq">
            <div className="section-head">
              <span className="eyebrow">Answers</span>
              <h2>Frequently asked questions</h2>
            </div>
            <div className="faq">
              {FAQS.map((item, index) => (
                <details className="qa" key={item.q} open={index === 0}>
                  <summary>
                    {item.q} <span className="plus">+</span>
                  </summary>
                  <p className="ans">{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* EXPLORE */}
          <section className="section" id="explore">
            <div className="section-head">
              <span className="eyebrow">Keep exploring</span>
              <h2>Explore more</h2>
            </div>
            <div className="explore-grid">
              {[
                [`Back to ${subject.name}`, `/subjects/${subject.slug}`],
                ['All subjects', '/subjects'],
                ['All courses', '/courses'],
                ['Universities', '/universities'],
                ['Scholarships', '/scholarships'],
                ['Free counselling', '/counselling'],
              ].map(([label, href]) => (
                <Link className="card explore-item" key={href} href={href}>
                  <span className="en">{label}</span>
                  <span className="go" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </main>

        <aside className="side">
          <div className="side-card">
            <h3>Not sure which strand fits?</h3>
            <p>A counsellor can help you pick a specialisation that matches your background.</p>
            <Link className="btn btn-primary btn-block" href={counselling}>
              Book free counselling
            </Link>
          </div>
          <div className="side-card">
            <h3>Jump to</h3>
            <div className="side-links">
              <a href="#popular">Popular specialisations</a>
              <a href="#all">All specialisations</a>
              <a href="#courses">Courses</a>
              <a href="#best-countries">Destinations</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
