import type { Metadata } from 'next';
import Link from 'next/link';
import { getCourses, getSubjects } from '@/lib/catalog';
import { CourseCards } from '@/components/study-abroad/CourseCards';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { SectionHead } from '@/components/study-abroad/SectionHead';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 24;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export const metadata: Metadata = {
  title: 'Courses',
  description:
    'Published programmes by subject and level, with the destinations that run them.',
  alternates: { canonical: '/courses' },
};

/**
 * The programme index.
 *
 * Filtering is a set of links rather than a script: the subject filter is the
 * one people reach for, it has to survive a shared URL, and a page that only
 * works once JavaScript arrives is a page search engines read as empty.
 */
export default async function CoursesIndexPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = first(params.q).trim();
  const subject = first(params.subject).trim();
  const page = Math.max(Number(first(params.page)) || 1, 1);

  const [result, subjects] = await Promise.all([
    getCourses({
      ...(search ? { q: search } : {}),
      ...(subject ? { subject } : {}),
      limit: String(PAGE_SIZE),
      page: String(page),
    }).catch(() => null),
    getSubjects({ limit: '100' })
      .then((response) => response.data)
      .catch(() => []),
  ]);

  const courses = result?.data ?? [];
  const total = result?.meta?.total ?? courses.length;
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const active = subjects.find((row) => row.slug === subject);

  const href = (next: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const merged = { q: search, subject, page: String(page), ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== '1') query.set(key, value);
    }
    const text = query.toString();
    return `/courses${text ? `?${text}` : ''}`;
  };

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Courses</span>
          </nav>
          <div className="hero__lead">
            <p className="hero__eyebrow">
              Programme discovery<b>·</b>
              {formatNumber(total)} programmes
            </p>
            <h1 className="hero__h1">
              {active ? `${active.name} programmes` : 'Find a programme'}
            </h1>
            <p className="hero__sub">
              Published programmes by subject and level, with the destinations
              that run them.
            </p>
          </div>
          <form className="bigsearch" method="get" role="search">
            {subject ? (
              <input type="hidden" name="subject" value={subject} />
            ) : null}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#667085"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="bigsearch__input"
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Search programmes"
              aria-label="Search programmes"
              autoComplete="off"
            />
            <button className="btn btn--sm" type="submit">
              Search{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </button>
          </form>
        </div>
      </section>

      <section className="sec sec--white" id="courses">
        <div className="wrap">
          <SectionHead
            n="01"
            eyebrow="Programmes"
            title={active ? active.name : 'All programmes'}
            lead={`${formatNumber(total)} published ${total === 1 ? 'programme' : 'programmes'}.`}
          />

          <div className="levelbar levelbar--wide" role="group" aria-label="Subject">
            <span className="filters__label">Subject</span>
            <Link
              className="chipbtn"
              href={href({ subject: undefined, page: undefined })}
              aria-pressed={!subject}
            >
              All
            </Link>
            {subjects.map((row) => (
              <Link
                key={row.id}
                className="chipbtn"
                href={href({ subject: row.slug, page: undefined })}
                aria-pressed={subject === row.slug}
              >
                {row.name}
              </Link>
            ))}
          </div>

          {courses.length ? (
            <CourseCards courses={courses} />
          ) : (
            <p className="sec-lead">
              No programmes match that search yet.{' '}
              <Link href="/courses">Clear the filters</Link> to see everything.
            </p>
          )}

          {pages > 1 ? (
            <nav className="btn-row" aria-label="Pagination" style={{ marginTop: 24 }}>
              {page > 1 ? (
                <Link
                  className="btn btn--sm btn--ghost"
                  href={href({ page: String(page - 1) })}
                >
                  Previous
                </Link>
              ) : null}
              <span className="datum">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Link
                  className="btn btn--sm btn--ghost"
                  href={href({ page: String(page + 1) })}
                >
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </section>

      <PlanBand
        heading="Not sure which programme fits?"
        body="Tell us about your academic profile, goals and budget. We'll help you understand your options across every destination we cover."
        secondary={{ href: '/subjects', label: 'Browse subjects' }}
      />
    </>
  );
}
