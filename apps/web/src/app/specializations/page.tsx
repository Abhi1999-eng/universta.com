import type { Metadata } from 'next';
import Link from 'next/link';
import { getSpecializations } from '@/lib/catalog';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 120;

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export const metadata: Metadata = {
  title: 'Specialisations | Universta',
  description:
    'Every specialisation across our subjects, with the subject each one belongs to.',
  alternates: { canonical: '/specializations' },
};

/**
 * The flat view of the taxonomy.
 *
 * Students search for the branch rather than the field it sits in -- nobody
 * looks for "Agriculture & Environmental Sciences" on the way to "Viticulture".
 * Every row still links into /subjects/<subject>/<specialization>, because that
 * pair is what makes a specialization unique: the same name is taught under
 * several subjects and those are different pages.
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

  /* Grouped under their subject so the list reads as a taxonomy rather than
     as an alphabetical wall of nine hundred links. */
  const grouped = rows.reduce<Map<string, { name: string; slug: string; rows: typeof rows }>>(
    (map, row) => {
      const entry = map.get(row.subject.slug) ?? {
        name: row.subject.name,
        slug: row.subject.slug,
        rows: [],
      };
      entry.rows.push(row);
      map.set(row.subject.slug, entry);
      return map;
    },
    new Map(),
  );

  return (
    <div className="cref cref-subj">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <Link href="/subjects">Subjects</Link> ›{' '}
          <span aria-current="page">Specialisations</span>
        </nav>
      </div>

      <section className="wrap" style={{ paddingTop: 8 }}>
        <div className="hero-banner">
          <span className="hero-parent">Find your field</span>
          <h1>Specialisations</h1>
          <p className="lede">
            Every branch across our subjects. Pick one to see where it is taught.
          </p>
          <div className="hero-metrics">
            <div className="hm">
              <div className="v">{formatNumber(total) || '—'}</div>
              <div className="k">Specialisations</div>
            </div>
            <div className="hm">
              <div className="v">{grouped.size || '—'}</div>
              <div className="k">Subjects on this page</div>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ paddingTop: 32 }}>
        <form method="get" className="srch" role="search">
          <label className="sr-only" htmlFor="specialization-search">
            Search specialisations
          </label>
          <input
            id="specialization-search"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search specialisations"
            className="srch__input"
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>

        {rows.length === 0 ? (
          <p className="prose" style={{ marginTop: 24 }}>
            {search
              ? `No specialisations match “${search}”.`
              : 'No specialisations are published yet.'}
          </p>
        ) : null}

        {[...grouped.values()].map((group) => (
          <section className="block" key={group.slug}>
            <div className="block-head">
              <span className="eyebrow">Subject</span>
              <h2>
                <Link href={`/subjects/${group.slug}`}>{group.name}</Link>
              </h2>
            </div>
            <div className="chip-row">
              {group.rows.map((row) => (
                <Link
                  key={row.id}
                  href={`/subjects/${group.slug}/${row.slug}`}
                  className="chip"
                >
                  {row.name}
                </Link>
              ))}
            </div>
          </section>
        ))}

        {pages > 1 ? (
          <nav className="pager" aria-label="Pagination">
            {page > 1 ? (
              <Link
                href={`/specializations?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(page - 1) })}`}
                className="btn btn-outline"
              >
                Previous
              </Link>
            ) : null}
            <span className="prose">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link
                href={`/specializations?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(page + 1) })}`}
                className="btn btn-outline"
              >
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
