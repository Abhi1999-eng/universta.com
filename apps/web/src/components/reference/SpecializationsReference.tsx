import Link from 'next/link';
import type { Course, SubjectDetail } from '@/lib/catalog';
import { counsellingHref } from '@/lib/counselling-link';
import { formatNumber } from '@/lib/format';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { SpecializationSearch } from './SpecializationSearch';

/** The client-approved specialisations page.
 *
 * The reference has no page of its own for this: a subject lists its
 * specializations inline. So this is built from that page's vocabulary --
 * numbered section bands, `sec-head`, the `specgrid` of `speccard`s -- rather
 * than invented, and the behaviour the catalogue specs pin is unchanged: the
 * results region is still `#all` and still takes focus on submit, every card
 * still carries its slug as an anchor, and the call to action still opens the
 * courses filtered to that specialisation.
 */

export type SpecializationsReferenceProps = {
  subject: SubjectDetail;
  /** Real per-specialisation course counts from the course filter options. */
  counts: Record<string, number>;
  countries: Array<{ value: string; label: string; count: number }>;
  /** Search term from the URL, so a filtered list is shareable and reloadable. */
  query: string;
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

function courseLabel(count: number) {
  return `${formatNumber(count)} course${count === 1 ? '' : 's'}`;
}

export function SpecializationsReference(props: SpecializationsReferenceProps) {
  const { subject, counts, countries, universities, courses, scholarships, query } = props;
  const term = query.trim().toLowerCase();
  const all = subject.subSubjects ?? [];
  const specialisations = term
    ? all.filter((item) => item.name.toLowerCase().includes(term))
    : all;
  const ranked = [...specialisations].sort(
    (a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0),
  );
  // While a search is running the whole page is the result set, so the
  // "popular" shortcut into it would only repeat what is already below.
  const popular = term ? [] : ranked.slice(0, 6);

  /** Counselling booked from a specialisation list keeps its subject. */
  const counselling = counsellingHref({
    source: 'subject',
    subject: subject.slug,
    from: `/subjects/${subject.slug}/specializations`,
  });

  /* The reference numbers its sections in the order they appear, so the
     numbering has to be built from the sections this record actually fills
     rather than hard-coded and left with gaps. */
  const order: string[] = [];
  if (popular.length) order.push('popular');
  order.push('all');
  if (courses.length) order.push('courses');
  if (countries.length) order.push('destinations');
  if (universities.length) order.push('universities');
  if (scholarships.length) order.push('scholarships');
  order.push('faq');

  const n = (key: string) => String(order.indexOf(key) + 1).padStart(2, '0');
  const band = (key: string) =>
    `sec ${order.indexOf(key) % 2 === 0 ? 'sec--paper' : 'sec--white'}`;

  return (
    /* No older stylesheet on top of this one. The wrapper carried the
       classes of the page this replaced, and they centred every heading in
       a narrow column, centred the search bar under a left-aligned title
       and drew the small labels as pale pills. */
    <div>
      <section className="hero hero--compact">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href="/subjects">Subjects</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href={`/subjects/${subject.slug}`}>{subject.name}</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Specialisations</span>
          </nav>

          <div className="hero__lead">
            <p className="hero__eyebrow">
              Narrow your path<b>·</b>
              {specialisations.length} specialisations<b>·</b>
              {formatNumber(subject.publishedCourseCount)} courses
            </p>
            <h1 className="hero__h1">Explore {subject.name} specialisations</h1>
            <p className="hero__sub">
              Each specialisation below opens the published courses mapped to
              it, with the universities and destinations that teach them.
            </p>
          </div>

          <SpecializationSearch query={query} subject={subject.name} />

          <div className="btn-row" style={{ marginTop: 22 }}>
            <a href="#all" className="btn btn--lg">
              Explore specialisations{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </a>
            <Link
              href={`/courses?subject=${subject.slug}#discovery`}
              className="btn btn--ghost btn--lg"
            >
              All {subject.name} courses
            </Link>
          </div>
        </div>
      </section>

      {/* POPULAR */}
      {popular.length ? (
        <section className={band('popular')} id="popular">
          <div className="wrap">
            <div className="sec-head sec-head--split">
              <div className="sec-head__aside">
                <p className="eyebrow">
                  <span className="eyebrow__n">{n('popular')}</span> Most courses
                </p>
                <h2 className="sec-title">Popular {subject.name} specialisations</h2>
              </div>
              <div>
                <p className="sec-lead">
                  Ranked by the number of published courses mapped to each.
                </p>
                <p className="sec-head__cta">
                  <a className="linkcta" href="#all">
                    All specialisations{' '}
                    <span aria-hidden="true">→</span>
                  </a>
                </p>
              </div>
            </div>

            <div className="specgrid">
              {popular.map((item) => (
                <article className="speccard speccard--hl" key={item.id}>
                  <div className="speccard__btn">
                    <span className="speccard__top">
                      <span className="label">Specialization</span>
                      <span className="badge badge--req">Popular</span>
                    </span>
                    <h3 className="speccard__name">{item.name}</h3>
                    {item.shortDescription ? (
                      <p className="speccard__desc">{item.shortDescription}</p>
                    ) : null}
                    <span className="speccard__foot">
                      <span className="speccard__levels">{initials(subject.name)}</span>
                      <span className="speccard__count datum">
                        {counts[item.slug] ? courseLabel(counts[item.slug]) : 'No courses yet'}
                      </span>
                    </span>
                    <Link
                      className="speccard__cta"
                      href={`/courses?subject=${subject.slug}&subSubject=${item.slug}#discovery`}
                    >
                      Explore specialisation <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ALL */}
      {/* The results region takes focus on submit, so it is a real target. */}
      <section className={band('all')} id="all" tabIndex={-1}>
        <div className="wrap">
          <div className="sec-head sec-head--split">
            <div className="sec-head__aside">
              <p className="eyebrow">
                <span className="eyebrow__n">{n('all')}</span> Every focus area
              </p>
              <h2 className="sec-title">All {subject.name} specialisations</h2>
            </div>
            <div>
              <p className="sec-lead">
                {term
                  ? `${specialisations.length} specialisation${specialisations.length === 1 ? '' : 's'} matching “${query}”.`
                  : specialisations.length
                    ? `${specialisations.length} published specialisation${specialisations.length === 1 ? '' : 's'}, each with its own course list.`
                    : 'No specialisations are published for this subject yet.'}
              </p>
            </div>
          </div>

          {specialisations.length === 0 ? (
            <div className="h-empty h-empty--box" data-testid="specialization-empty">
              <h3>
                {term
                  ? 'No specialisations match that search'
                  : 'No specialisations published yet'}
              </h3>
              <p>Browse every {subject.name} course instead.</p>
              <Link className="btn" href={`/courses?subject=${subject.slug}#discovery`}>
                Browse courses{' '}
                <span className="btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          ) : (
            <div className="specgrid">
              {ranked.map((item) => (
                /* The slug is the anchor the subject page and search results
                   link into, so it stays on the card itself. */
                <article className="speccard" id={item.slug} key={item.id}>
                  <div className="speccard__btn">
                    <span className="speccard__top">
                      <span className="label">Specialization</span>
                    </span>
                    <h3 className="speccard__name">{item.name}</h3>
                    {item.shortDescription ? (
                      <p className="speccard__desc">{item.shortDescription}</p>
                    ) : null}
                    <span className="speccard__foot">
                      <span className="speccard__levels">{subject.name}</span>
                      <span className="speccard__count datum">
                        {counts[item.slug] ? courseLabel(counts[item.slug]) : 'No courses yet'}
                      </span>
                    </span>
                    <Link
                      className="speccard__cta"
                      href={`/courses?subject=${subject.slug}&subSubject=${item.slug}`}
                    >
                      Explore courses <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* COURSES */}
      {courses.length ? (
        <section className={band('courses')} id="courses">
          <div className="wrap">
            <div className="sec-head sec-head--split">
              <div className="sec-head__aside">
                <p className="eyebrow">
                  <span className="eyebrow__n">{n('courses')}</span> Programmes
                </p>
                <h2 className="sec-title">Courses across these specialisations</h2>
              </div>
              <div>
                <p className="sec-lead">
                  A sample of the published programmes mapped to {subject.name}.
                </p>
                <p className="sec-head__cta">
                  <Link className="linkcta" href={`/courses?subject=${subject.slug}#discovery`}>
                    All courses <span aria-hidden="true">→</span>
                  </Link>
                </p>
              </div>
            </div>

            <div className="specgrid">
              {courses.map((course) => (
                <article className="speccard" key={course.id}>
                  <div className="speccard__btn">
                    <span className="speccard__top">
                      <span className="label">{course.courseLevel.name}</span>
                    </span>
                    <h3 className="speccard__name">{course.name}</h3>
                    {course.subSubject ? (
                      <p className="speccard__desc">{course.subSubject.name}</p>
                    ) : null}
                    <Link className="speccard__cta" href={`/courses/${course.slug}`}>
                      View programme <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* DESTINATIONS */}
      {countries.length ? (
        <section className={band('destinations')} id="best-countries">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">
                <span className="eyebrow__n">{n('destinations')}</span> Where to study
              </p>
              <h2 className="sec-title">Best destinations for {subject.name}</h2>
              <p className="sec-lead">
                Destinations with published course offerings in this subject.
              </p>
            </div>

            <div className="pillrow">
              {countries.map((country) => (
                <Link
                  key={country.value}
                  className="pill"
                  href={`/courses?subject=${subject.slug}&country=${country.value}#discovery`}
                >
                  {country.label}{' '}
                  <em>{formatNumber(country.count)}</em>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* UNIVERSITIES */}
      {universities.length ? (
        <section className={band('universities')} id="universities">
          <div className="wrap">
            <div className="sec-head sec-head--split">
              <div className="sec-head__aside">
                <p className="eyebrow">
                  <span className="eyebrow__n">{n('universities')}</span> Institutions
                </p>
                <h2 className="sec-title">Universities teaching {subject.name}</h2>
              </div>
              <div>
                <p className="sec-lead">
                  Institutions with published programmes in this subject.
                </p>
                <p className="sec-head__cta">
                  <Link className="linkcta" href="/universities">
                    All universities <span aria-hidden="true">→</span>
                  </Link>
                </p>
              </div>
            </div>

            <div className="specgrid">
              {universities.map((university) => (
                <article className="speccard" key={university.slug}>
                  <div className="speccard__btn">
                    <span className="speccard__top">
                      <span className="label">University</span>
                    </span>
                    <h3 className="speccard__name">{university.name}</h3>
                    {university.country ? (
                      <p className="speccard__desc">{university.country}</p>
                    ) : null}
                    <Link className="speccard__cta" href={`/universities/${university.slug}`}>
                      View university <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* SCHOLARSHIPS */}
      {scholarships.length ? (
        <section className={band('scholarships')} id="scholarships">
          <div className="wrap">
            <div className="sec-head sec-head--split">
              <div className="sec-head__aside">
                <p className="eyebrow">
                  <span className="eyebrow__n">{n('scholarships')}</span> Funding
                </p>
                <h2 className="sec-title">Scholarships</h2>
              </div>
              <div>
                <p className="sec-lead">
                  Published awards that can go towards a {subject.name} programme.
                </p>
                <p className="sec-head__cta">
                  <Link className="linkcta" href={`/scholarships?subject=${subject.slug}`}>
                    All scholarships <span aria-hidden="true">→</span>
                  </Link>
                </p>
              </div>
            </div>

            <div className="specgrid">
              {scholarships.map((scholarship) => (
                <article className="speccard" key={scholarship.slug}>
                  <div className="speccard__btn">
                    <span className="speccard__top">
                      <span className="label">{scholarship.type ?? 'Scholarship'}</span>
                    </span>
                    <h3 className="speccard__name">{scholarship.title}</h3>
                    {scholarship.amount ? (
                      <span className="speccard__foot">
                        <span className="speccard__count datum">{scholarship.amount}</span>
                      </span>
                    ) : null}
                    <Link className="speccard__cta" href={`/scholarships/${scholarship.slug}`}>
                      View scholarship <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      <section className={band('faq')} id="faq">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">
              <span className="eyebrow__n">{n('faq')}</span> Answers
            </p>
            <h2 className="sec-title">Frequently asked questions</h2>
          </div>

          <div className="faq">
            {FAQS.map((item) => (
              <details className="faq__item" key={item.q}>
                <summary className="faq__q">
                  {item.q}
                  <span className="faq__plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="faq__a">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <PlanBand
        heading="Not sure which strand fits?"
        body={`A counsellor can help you pick a ${subject.name} specialisation that matches your background, your grades and where you want to study.`}
        secondary={{ href: counselling, label: 'Book free counselling' }}
      />

      {/* EXPLORE */}
      <section className="sec sec--paper sec--tight h-connect" id="explore">
        <div className="wrap">
          <div className="sec-head sec-head--compact">
            <p className="eyebrow">Keep exploring</p>
            <h2 className="sec-title sec-title--sm">Explore more</h2>
          </div>
          <div className="pillrow">
            {(
              [
                [`Back to ${subject.name}`, `/subjects/${subject.slug}`],
                ['All subjects', '/subjects'],
                ['All courses', '/courses'],
                ['Universities', '/universities'],
                ['Scholarships', '/scholarships'],
                ['Free counselling', '/counselling'],
              ] as Array<[string, string]>
            ).map(([label, href]) => (
              <Link className="pill" key={href} href={href}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
