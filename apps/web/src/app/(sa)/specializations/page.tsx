import type { Metadata } from 'next';
import Link from 'next/link';
import { getCourseLevels, getSpecializations, getSubjects } from '@/lib/catalog';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { formatNumber } from '@/lib/format';
import { SpecializationFilters } from './SpecializationFilters';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 200;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export const metadata: Metadata = {
  title: 'Specializations',
  description:
    'Every specialization across our subjects, with the subject each one belongs to.',
  alternates: { canonical: '/specializations' },
};

/**
 * The flat view of the taxonomy.
 *
 * Students look for the branch rather than the field it sits in -- nobody
 * types "Agriculture & Environmental Sciences" on the way to "Viticulture".
 * Every row still links into /subjects/<subject>/<specialization>, because
 * that pair is what makes a specialization unique: the same name is taught
 * under several subjects and those are different pages.
 */
export default async function SpecializationsIndexPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = first(params.q).trim();
  const page = Math.max(Number(first(params.page)) || 1, 1);

  const subjectSlug = first(params.subject).trim();
  const level = first(params.level).trim();

  const filtered = Boolean(search || subjectSlug || level);

  /* The dropdowns are decoration around the list: if either lookup fails the
     page still lists specializations, it just cannot offer that filter. */
  const [result, subjects, levels, everything] = await Promise.all([
    getSpecializations({
      ...(search ? { search } : {}),
      ...(subjectSlug ? { subject: subjectSlug } : {}),
      ...(level ? { level } : {}),
      limit: String(PAGE_SIZE),
      page: String(page),
    }).catch(() => null),
    getSubjects({ limit: '100' })
      .then((response) => response.data)
      .catch(() => []),
    getCourseLevels().catch(() => []),
    /* How many there are before any filter, which the design keeps in the
       eyebrow and counts against ("12 of 55 shown"). One row's read: the
       total is in its meta. Unfiltered, the list itself already says. */
    filtered
      ? getSpecializations({ limit: '1' })
          .then((response) => response.meta?.total ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const rows = result?.data ?? [];
  const total = result?.meta?.total ?? rows.length;
  const allTotal = everything ?? (filtered ? null : total);
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = from + rows.length - 1;

  const qs = (next: number) =>
    `/specializations?${new URLSearchParams({
      ...(search ? { q: search } : {}),
      ...(subjectSlug ? { subject: subjectSlug } : {}),
      ...(level ? { level } : {}),
      page: String(next),
    })}`;

  return (
    <>
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
            <span aria-current="page">Specializations</span>
          </nav>
          <div className="hero__lead">
            {/* The whole catalogue's count, as the design keeps it: the
                filtered figure is the count line's job, and it read "1
                specializations". */}
            {allTotal != null ? (
              <p className="hero__eyebrow">
                Narrow down<b>·</b>
                {formatNumber(allTotal)}{' '}
                {allTotal === 1 ? 'specialization' : 'specializations'}
              </p>
            ) : (
              <p className="hero__eyebrow">Narrow down</p>
            )}
            <h1 className="hero__h1">Specializations</h1>
            <p className="hero__sub">
              Every branch across our subjects. Pick one to see where it is
              taught.
            </p>
            <div className="btn-row hero__actions">
              <Link className="btn btn--ghost" href="/subjects">
                Browse by subject{' '}
                <span className="btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The design's filter bar sits with the list it filters, in one
          tight band under the hero. Inside the hero it left a band of
          empty white between the filters and the first card. */}
      <section className="sec sec--white sec--tight specresults" id="specializations">
        <div className="wrap">
          <SpecializationFilters>
            <label className="h-filter h-filter--q">
              <span>Search</span>
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Search specializations"
                autoComplete="off"
              />
            </label>
            {subjects.length ? (
              <label className="h-filter">
                <span>Subject</span>
                <select name="subject" defaultValue={subjectSlug}>
                  <option value="">All subjects</option>
                  {subjects.map((row) => (
                    <option key={row.id} value={row.slug}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {levels.length ? (
              <label className="h-filter">
                <span>Study level</span>
                <select name="level" defaultValue={level}>
                  <option value="">All levels</option>
                  {levels.map((row) => (
                    <option key={row.id} value={row.code}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button className="btn btn--sm" type="submit">
              Search{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </button>
          </SpecializationFilters>
          {rows.length === 0 ? (
            /* A filter that finds nothing is not an empty catalogue. */
            <p className="h-empty">
              {filtered ? (
                <>
                  {search
                    ? `No specializations match “${search}”${subjectSlug || level ? ' with those filters' : ''}.`
                    : 'No specializations match those filters.'}{' '}
                  <span>
                    {subjectSlug || level
                      ? 'Try another subject or level.'
                      : 'Try another word, or browse by subject.'}
                  </span>
                </>
              ) : (
                'No specializations are published yet.'
              )}
            </p>
          ) : (
            <p className="h-count" aria-live="polite">
              {pages > 1
                ? `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)}`
                : `${formatNumber(total)} of ${formatNumber(allTotal ?? total)} shown`}
            </p>
          )}
          <div className="h-grid">
            {rows.map((row) => (
              <Link
                className="h-card"
                key={row.id}
                href={`/subjects/${row.subject.slug}/${row.slug}`}
              >
                <strong className="h-card__t">{row.name}</strong>
                <span className="h-card__d">{row.subject.name}</span>
                {/* The reference states a branch's weight on the card: how
                    many programmes, and the levels that teach them. */}
                {row.publishedCourseCount || row.levels?.length ? (
                  <span className="h-card__m">
                    {row.publishedCourseCount
                      ? `${formatNumber(row.publishedCourseCount)} ${row.publishedCourseCount === 1 ? 'course' : 'courses'}`
                      : ''}
                    {row.publishedCourseCount && row.levels?.length ? ' · ' : ''}
                    {(row.levels ?? []).map((item) => item.name).join(', ')}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>

          {pages > 1 ? (
            <nav className="btn-row" aria-label="Pagination" style={{ marginTop: 24 }}>
              {page > 1 ? (
                <Link className="btn btn--sm btn--ghost" href={qs(page - 1)}>
                  Previous
                </Link>
              ) : null}
              <span className="datum">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Link className="btn btn--sm btn--ghost" href={qs(page + 1)}>
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </section>

      <PlanBand
        heading="Not sure which specialization fits?"
        body="Tell us about your academic profile, goals and budget. We'll help you understand your options across every subject we cover."
        secondary={{ href: '/subjects', label: 'Browse subjects' }}
      />
    </>
  );
}
