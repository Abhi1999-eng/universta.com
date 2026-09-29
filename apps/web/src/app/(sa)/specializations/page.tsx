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

  /* Grouped under their subject, so the page reads as a taxonomy rather than
     as an alphabetical wall of nine hundred links. */
  const grouped = new Map<
    string,
    { name: string; slug: string; rows: typeof rows }
  >();
  for (const row of rows) {
    const entry = grouped.get(row.subject.slug) ?? {
      name: row.subject.name,
      slug: row.subject.slug,
      rows: [],
    };
    entry.rows.push(row);
    grouped.set(row.subject.slug, entry);
  }

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
          <form className="bigsearch" method="get" role="search">
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
              placeholder="Search specializations"
              aria-label="Search specializations"
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

      <section className="sec sec--white" id="specializations">
        <div className="wrap">
          {rows.length === 0 ? (
            <p className="sec-lead">
              {search
                ? `No specializations match “${search}”.`
                : 'No specializations are published yet.'}
            </p>
          ) : null}

          {[...grouped.values()].map((group) => (
            <div className="subjcard" key={group.slug}>
              <div className="subjcard__head">
                <div>
                  <h2 className="subjcard__name">
                    <Link href={`/subjects/${group.slug}`}>{group.name}</Link>
                  </h2>
                  <p className="subjcard__meta">
                    {group.rows.length} specializations
                  </p>
                </div>
              </div>
              <div className="subjcard__specs">
                {group.rows.map((row) => (
                  <Link
                    key={row.id}
                    className="specpill"
                    href={`/subjects/${group.slug}/${row.slug}`}
                  >
                    {row.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}

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
