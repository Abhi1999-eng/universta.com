import type { Metadata } from 'next';
import Link from 'next/link';
import { getSpecializations } from '@/lib/catalog';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { formatNumber } from '@/lib/format';

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

  const result = await getSpecializations({
    ...(search ? { search } : {}),
    limit: String(PAGE_SIZE),
    page: String(page),
  }).catch(() => null);

  const rows = result?.data ?? [];
  const total = result?.meta?.total ?? rows.length;
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const qs = (next: number) =>
    `/specializations?${new URLSearchParams({
      ...(search ? { q: search } : {}),
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
            <p className="hero__eyebrow">
              Narrow down<b>·</b>
              {formatNumber(total)} specializations
            </p>
            <h1 className="hero__h1">Specializations</h1>
            <p className="hero__sub">
              Every branch across our subjects. Pick one to see where it is
              taught.
            </p>
          </div>
          <form className="h-filters" method="get" role="search">
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
            <button className="btn btn--sm" type="submit">
              Search{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </button>
          </form>
        </div>
      </section>

      <section className="sec sec--white" id="specializations">
        <div className="wrap">
          {rows.length === 0 ? (
            <p className="h-empty">
              {search
                ? `No specializations match “${search}”.`
                : 'No specializations are published yet.'}
            </p>
          ) : null}

          <p className="h-count">
            {formatNumber(rows.length)} shown of {formatNumber(total)}
          </p>
          <div className="h-grid">
            {rows.map((row) => (
              <Link
                className="h-card"
                key={row.id}
                href={`/subjects/${row.subject.slug}/${row.slug}`}
              >
                <strong className="h-card__t">{row.name}</strong>
                <span className="h-card__d">{row.subject.name}</span>
                {row.shortDescription ? (
                  <span className="h-card__m">{row.shortDescription}</span>
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
