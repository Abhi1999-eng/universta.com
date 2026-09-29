import type { Metadata } from 'next';
import Link from 'next/link';
import { getCourseFilterOptions, getCourses } from '@/lib/catalog';
import { CourseCards } from '@/components/study-abroad/CourseCards';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import {
  ConnectBand,
  MatchBand,
} from '@/components/study-abroad/DiscoveryBands';
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
    'Published programmes by subject, level and destination, with the universities that run them.',
  alternates: { canonical: '/courses' },
};

/** Every filter is a link, so a filtered view survives being shared and is
 *  readable without JavaScript. The reference does this with checkboxes and a
 *  script; the shape on screen is the same, the state lives in the URL. */
type Facet = {
  key: string;
  title: string;
  options: Array<{ value: string; label: string; count?: number }>;
};

export default async function CoursesIndexPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = first(params.q).trim();
  const page = Math.max(Number(first(params.page)) || 1, 1);
  const selected = {
    subject: first(params.subject),
    level: first(params.level),
    country: first(params.country),
    mode: first(params.mode),
    intake: first(params.intake),
  };

  const [result, options] = await Promise.all([
    getCourses({
      ...(search ? { q: search } : {}),
      ...Object.fromEntries(
        Object.entries(selected).filter(([, value]) => value),
      ),
      limit: String(PAGE_SIZE),
      page: String(page),
    }).catch(() => null),
    getCourseFilterOptions().catch(() => null),
  ]);

  const courses = result?.data ?? [];
  const total = result?.meta?.total ?? courses.length;
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const facets: Facet[] = [
    { key: 'subject', title: 'Subject', options: options?.subjects ?? [] },
    { key: 'level', title: 'Study level', options: options?.levels ?? [] },
    { key: 'country', title: 'Country', options: options?.countries ?? [] },
    { key: 'mode', title: 'Study mode', options: options?.studyModes ?? [] },
    { key: 'intake', title: 'Intake', options: options?.intakes ?? [] },
  ].filter((facet) => facet.options.length > 0);

  const href = (next: Record<string, string | undefined>) => {
    const merged: Record<string, string> = {};
    for (const [key, value] of Object.entries({
      q: search,
      ...selected,
      ...next,
    }))
      if (value) merged[key] = value;
    const query = new URLSearchParams(merged).toString();
    return `/courses${query ? `?${query}` : ''}`;
  };

  const active = Object.entries(selected).filter(([, value]) => value);

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
            <h1 className="hero__h1">Find a programme</h1>
            <p className="hero__sub">
              Published programmes by subject, level and destination, with the
              universities that run them.
            </p>
          </div>
        </div>
      </section>

      <section className="sec sec--white" id="courses">
        <div className="wrap">
          <div className="courselayout">
            <aside className="filters-panel" aria-label="Course filters">
              <div className="filters-panel__head">
                <span className="filters-panel__title">Filters</span>
                {active.length ? (
                  <Link className="linkbtn" href="/courses">
                    Clear all
                  </Link>
                ) : null}
              </div>
              <div className="filters-panel__body">
                {facets.map((facet) => (
                  <div className="fgroup" key={facet.key}>
                    <p className="fgroup__t">{facet.title}</p>
                    <div
                      className={`fgroup__opts${
                        facet.options.length > 8 ? ' fgroup__opts--scroll' : ''
                      }`}
                    >
                      {facet.options.map((option) => {
                        const on =
                          selected[facet.key as keyof typeof selected] ===
                          option.value;
                        return (
                          <Link
                            className="fcheck"
                            key={option.value}
                            href={href({
                              [facet.key]: on ? undefined : option.value,
                              page: undefined,
                            })}
                            aria-pressed={on}
                          >
                            <span>{option.label}</span>
                            {typeof option.count === 'number' ? (
                              <em>{option.count}</em>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="fgroup__note">
                  Counts come from programmes published in this catalogue, not
                  from the whole sector.
                </p>
              </div>
            </aside>

            <div className="cresults">
              <form
                className="bigsearch bigsearch--sm cresults__search"
                method="get"
                role="search"
              >
                {active.map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
                <svg
                  width="17"
                  height="17"
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
                  Search
                </button>
              </form>

              {active.length ? (
                <div className="activechips">
                  {active.map(([key, value]) => (
                    <Link
                      className="chipbtn chipbtn--sm"
                      key={key}
                      href={href({ [key]: undefined, page: undefined })}
                    >
                      {value} <span aria-hidden="true">×</span>
                    </Link>
                  ))}
                </div>
              ) : null}

              <p className="h-count">
                {formatNumber(courses.length)} shown of {formatNumber(total)}
              </p>

              {courses.length ? (
                <CourseCards courses={courses} />
              ) : (
                <p className="dir__none">
                  No programmes match that search yet.{' '}
                  <Link href="/courses">Clear the filters</Link> to see
                  everything.
                </p>
              )}

              {pages > 1 ? (
                <nav className="cresults__more" aria-label="Pagination">
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
          </div>
        </div>
      </section>

      <MatchBand
        heading="Narrowed it down?"
        lead="Tell us your profile and we'll show which of these you are a fit for."
        href="/contact"
      />

      <PlanBand
        heading="Not sure which programme fits?"
        body="Tell us about your academic profile, goals and budget. We'll help you understand your options across every destination we cover."
        secondary={{ href: '/subjects', label: 'Browse subjects' }}
      />

      <ConnectBand
        actions={[
          { href: '/subjects', label: 'Browse subjects' },
          { href: '/specializations', label: 'All specializations', ghost: true },
          { href: '/study-abroad', label: 'Compare destinations', ghost: true },
        ]}
        groups={[
          {
            title: 'Subjects',
            items: (options?.subjects ?? []).slice(0, 6).map((row) => ({
              id: row.value,
              name: row.label,
              href: `/subjects/${row.value}`,
            })),
          },
          {
            title: 'Destinations',
            items: (options?.countries ?? []).slice(0, 6).map((row) => ({
              id: row.value,
              name: row.label,
              href: `/study-abroad/${row.value}`,
            })),
          },
        ]}
      />
    </>
  );
}
