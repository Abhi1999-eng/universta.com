'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatNumber } from '@/lib/format';

/** The client-approved Universities page.
 *
 * The template's "35,000+ universities", QS/THE rank badges, acceptance rates,
 * tuition-from figures, international-student percentages, star ratings and
 * the ranking, tuition-band and acceptance-rate filters are prototype copy:
 * Universta stores none of them. So the card carries what the record does have
 * — destination, institution type, published programme count, verification
 * state — and the filter rail offers only the facets `/universities` honours
 * (destination, institution type, subject, state, city, search, sort).
 *
 * Filter state lives in the URL so a narrowed directory is shareable; the
 * prototype held it in page-local JavaScript. */

export type UniversityRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  country: { name: string; slug: string } | null;
  institutionType: string | null;
  offerings: number;
  campuses: number;
  featured: boolean;
  verified: boolean;
};

export type UniversitiesReferenceProps = {
  rows: UniversityRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  filters: Record<string, string>;
  countries: Array<{ name: string; slug: string }>;
  subjects: Array<{ name: string; slug: string }>;
  continents: Array<{ name: string; slug: string }>;
  levels: Array<{ name: string; code: string }>;
  institutionTypes: string[];
  /** The whole published directory, for the A–Z and per-country blocks. */
  directory: Array<{ name: string; slug: string; country: string | null; offerings: number }>;
  heading: string;
  headingAccent: string;
  lede: string;
  ctaHeading: string;
  ctaBody: string;
};

const SORTS = [
  { value: 'featured', label: 'Featured first' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'newest', label: 'Recently published' },
];

const FAQS = [
  {
    q: 'How are these universities chosen?',
    a: 'Every institution here is a published record in the Universta catalogue. There is no paid placement and no ranking: the default order puts featured records first, and you can re-sort alphabetically or by recency.',
  },
  {
    q: 'Why are there no rankings on this page?',
    a: 'Universta does not publish league-table positions. Where ranking matters to you, check the ranking body directly — this directory is built around the courses each institution actually offers.',
  },
  {
    q: 'What does the programme count mean?',
    a: 'It is the number of published course offerings attached to that university. Open the university to see them and filter by level, subject and intake.',
  },
  {
    q: 'Can I compare universities?',
    a: 'Yes — the comparison tool lines up published universities side by side on the fields the catalogue records.',
  },
];

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

function humanise(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function UniversitiesReference(props: UniversitiesReferenceProps) {
  const { rows, meta, filters, countries, subjects, directory } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q ?? '');
  const [drawerOpen, setDrawerOpen] = useState(false);

  function commit(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    setDrawerOpen(false);
    router.push(`${pathname}${params.size ? `?${params}` : ''}#browse`);
  }

  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));
    return `${pathname}${params.size ? `?${params}` : ''}#browse`;
  }

  const active = Object.entries(filters).filter(
    ([key]) => !['q', 'sort', 'page'].includes(key),
  );

  const byCountry = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of directory) {
      if (!entry.country) continue;
      map.set(entry.country, (map.get(entry.country) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [directory]);

  const azGroups = useMemo(() => {
    const map = new Map<string, typeof directory>();
    for (const entry of [...directory].sort((a, b) => a.name.localeCompare(b.name))) {
      const letter = entry.name[0]?.toUpperCase() ?? '#';
      const bucket = map.get(letter);
      if (bucket) bucket.push(entry);
      else map.set(letter, [entry]);
    }
    return [...map.entries()];
  }, [directory]);

  const featured = rows.filter((row) => row.featured).slice(0, 3);
  const totalOfferings = directory.reduce((sum, entry) => sum + entry.offerings, 0);

  return (
    <div className="cref cref-dest">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/universities" aria-current="page">
            Universities
          </Link>
        </nav>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-in">
          <h1>
            {props.heading}{' '}
            {props.headingAccent ? <span className="b">{props.headingAccent}</span> : null}
          </h1>
          <p className="lead">{props.lede}</p>

          <form
            className="searchwrap"
            onSubmit={(event) => {
              event.preventDefault();
              commit({ q: query.trim() || null });
            }}
          >
            <div className="searchbar">
              <span className="ic" aria-hidden="true">
                🔍
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search universities by name…"
                aria-label="Search universities"
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </div>
          </form>

          <div className="hero-ctas">
            <a href="#browse" className="btn btn-primary btn-lg">
              Find universities
            </a>
            <Link href="/compare/universities" className="btn btn-ghost btn-lg">
              Compare universities
            </Link>
          </div>

          <div className="hstats">
            <div className="hstat">
              <b>{meta.total ? formatNumber(meta.total) : '—'}</b>
              <span>Universities</span>
            </div>
            <div className="hstat">
              <b>{byCountry.length || '—'}</b>
              <span>Destinations</span>
            </div>
            <div className="hstat">
              <b>{totalOfferings ? formatNumber(totalOfferings) : '—'}</b>
              <span>Programmes</span>
            </div>
            <div className="hstat">
              <b>{subjects.length || '—'}</b>
              <span>Subjects</span>
            </div>
            <div className="hstat">
              <b>{props.levels.length || '—'}</b>
              <span>Degree levels</span>
            </div>
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      {byCountry.length ? (
        <section className="sec sec-alt" id="destinations">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Most published</span>
              <h2>Browse universities by destination</h2>
              <p>Every destination with a published institution.</p>
            </div>
            <div className="dest-flags">
              {byCountry.map(([name, count]) => {
                const slug = countries.find((country) => country.name === name)?.slug;
                return (
                  <Link
                    key={name}
                    className="dest-flag"
                    href={slug ? `/universities?country=${slug}#browse` : '/universities#browse'}
                  >
                    <span className="cc">{initials(name)}</span>
                    {name}
                    <span style={{ color: 'var(--muted)' }}>{count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* FEATURED */}
      {featured.length ? (
        <section className="sec" id="featured">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Editor’s picks</span>
              <h2>Featured universities</h2>
              <p>Institutions an admin has marked as featured in the catalogue.</p>
            </div>
            <div className="unis">
              {featured.map((row, index) => (
                <UniversityCard key={row.id} row={row} tint={index % 4} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* BROWSE */}
      <section className="sec sec-alt" id="browse">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">Full search</span>
            <h2>Search and filter universities</h2>
          </div>

          <div className="market">
            {drawerOpen ? (
              <button
                type="button"
                className="cref-overlay"
                aria-label="Close filters"
                onClick={() => setDrawerOpen(false)}
              />
            ) : null}

            <aside
              className={`filters${drawerOpen ? ' open' : ''}`}
              aria-label="Filter universities"
              data-testid="university-filters"
            >
              <div className="f-head">
                <h3>Filters</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {active.length ? (
                    <Link className="f-clear" href="/universities#browse">
                      Clear all
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm filter-toggle"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close filters"
                    style={{ padding: '6px 10px' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="fscroll">
                {countries.length ? (
                  <details className="fg" open>
                    <summary>Destination</summary>
                    <div className="fb">
                      {countries.slice(0, 12).map((country) => {
                        const checked = filters.country === country.slug;
                        return (
                          <label className="fopt" key={country.slug}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => commit({ country: checked ? null : country.slug })}
                            />
                            {country.name}
                          </label>
                        );
                      })}
                    </div>
                  </details>
                ) : null}

                {props.institutionTypes.length ? (
                  <details className="fg" open>
                    <summary>Institution type</summary>
                    <div className="fb">
                      {props.institutionTypes.map((type) => {
                        const checked = filters.type === type;
                        return (
                          <label className="fopt" key={type}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => commit({ type: checked ? null : type })}
                            />
                            {humanise(type)}
                          </label>
                        );
                      })}
                    </div>
                  </details>
                ) : null}

                {subjects.length ? (
                  <details className="fg">
                    <summary>Subject</summary>
                    <div className="fb">
                      {subjects.slice(0, 12).map((subject) => {
                        const checked = filters.subject === subject.slug;
                        return (
                          <label className="fopt" key={subject.slug}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => commit({ subject: checked ? null : subject.slug })}
                            />
                            {subject.name}
                          </label>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
              </div>

              <div className="ffoot">
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => setDrawerOpen(false)}
                >
                  Show {formatNumber(meta.total)} result{meta.total === 1 ? '' : 's'}
                </button>
              </div>
            </aside>

            <div>
              <div className="resbar">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm filter-toggle"
                  onClick={() => setDrawerOpen(true)}
                >
                  ☰ Filters{active.length ? ` (${active.length})` : ''}
                </button>
                <p className="rescount" data-testid="university-count">
                  <b>{formatNumber(meta.total)}</b> universit{meta.total === 1 ? 'y' : 'ies'}
                </p>
                <div className="sortsel">
                  <label htmlFor="university-sort">Sort</label>
                  <select
                    id="university-sort"
                    value={filters.sort ?? SORTS[0].value}
                    onChange={(event) => commit({ sort: event.target.value })}
                  >
                    {SORTS.map((sort) => (
                      <option key={sort.value} value={sort.value}>
                        {sort.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {active.length ? (
                <div className="achips">
                  {active.map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      className="achip"
                      onClick={() => commit({ [key]: null })}
                    >
                      {humanise(value)} <b aria-hidden="true">✕</b>
                    </button>
                  ))}
                </div>
              ) : null}

              {rows.length === 0 ? (
                <div className="cref-empty" data-testid="university-empty">
                  <h3>No universities match these filters</h3>
                  <p>Clear one or more filters to return to the published directory.</p>
                  <Link className="btn btn-primary" href="/universities#browse">
                    Clear filters
                  </Link>
                </div>
              ) : (
                <div className="unis">
                  {rows.map((row, index) => (
                    <UniversityCard key={row.id} row={row} tint={index % 4} />
                  ))}
                </div>
              )}

              {meta.totalPages > 1 ? (
                <nav className="pager" aria-label="Pagination">
                  {meta.page > 1 ? <Link href={pageHref(meta.page - 1)}>‹</Link> : <span>‹</span>}
                  {Array.from({ length: meta.totalPages }, (_, index) => index + 1).map((page) => (
                    <Link
                      key={page}
                      href={pageHref(page)}
                      aria-current={page === meta.page ? 'page' : undefined}
                    >
                      {page}
                    </Link>
                  ))}
                  {meta.page < meta.totalPages ? (
                    <Link href={pageHref(meta.page + 1)}>›</Link>
                  ) : (
                    <span>›</span>
                  )}
                </nav>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* CONTINENTS */}
      {props.continents.length ? (
        <section className="sec" id="continents">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">By region</span>
              <h2>Browse universities by continent</h2>
            </div>
            <div className="dest-flags">
              {props.continents.map((continent) => (
                <Link
                  key={continent.slug}
                  className="dest-flag"
                  href={`/countries?region=${continent.slug}#regions`}
                >
                  <span className="cc">{initials(continent.name)}</span>
                  {continent.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* A–Z */}
      {azGroups.length ? (
        <section className="sec sec-alt" id="az">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Full index</span>
              <h2>Browse every university A–Z</h2>
              <p>Every published institution, listed alphabetically.</p>
            </div>
            {azGroups.map(([letter, entries]) => (
              <div key={letter} style={{ marginBottom: 22 }}>
                <h3 className="az-letter" style={{ color: 'var(--blue)', marginBottom: 10 }}>
                  {letter}
                </h3>
                <div className="azrows">
                  {entries.map((entry) => (
                    <Link key={entry.slug} className="azrow" href={`/universities/${entry.slug}`}>
                      {entry.name}
                      <span className="cnt">
                        {entry.offerings
                          ? `${formatNumber(entry.offerings)} programme${entry.offerings === 1 ? '' : 's'}`
                          : (entry.country ?? '')}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* BY LEVEL + SUBJECT */}
      {props.levels.length || subjects.length ? (
        <section className="sec" id="levels">
          <div className="wrap">
            <div className="grid g2" style={{ alignItems: 'start', gap: 26 }}>
              {props.levels.length ? (
                <div>
                  <div className="head">
                    <span className="eyebrow">By qualification</span>
                    <h2 style={{ fontSize: 26 }}>Browse by study level</h2>
                  </div>
                  <div className="grid g2">
                    {props.levels.map((level) => (
                      <Link
                        key={level.code}
                        className="card mini-card"
                        href={`/courses?level=${level.code}#discovery`}
                      >
                        <div>
                          <h3>{level.name}</h3>
                        </div>
                        <span className="go" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              {subjects.length ? (
                <div>
                  <div className="head">
                    <span className="eyebrow">By field</span>
                    <h2 style={{ fontSize: 26 }}>Browse by subject</h2>
                  </div>
                  <div className="grid g2">
                    {subjects.slice(0, 8).map((subject) => (
                      <Link
                        key={subject.slug}
                        className="card mini-card"
                        href={`/universities?subject=${subject.slug}#browse`}
                      >
                        <div>
                          <h3>{subject.name}</h3>
                        </div>
                        <span className="go" aria-hidden="true">
                          →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      <section className="sec sec-alt" id="faq">
        <div className="wrap">
          <div className="head">
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
        </div>
      </section>

      {/* FINAL */}
      <section className="final">
        <div className="wrap">
          <span className="eyebrow">Next step</span>
          <h2>{props.ctaHeading}</h2>
          <p>{props.ctaBody}</p>
          <div className="final-btns">
            <Link href="/counselling" className="btn btn-w btn-lg">
              Book free counselling
            </Link>
            <Link href="/compare/universities" className="btn btn-o btn-lg">
              Compare universities
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function UniversityCard({ row, tint }: { row: UniversityRow; tint: number }) {
  return (
    <article className="uni">
      <div className={`u-cover${tint ? ` c${tint}` : ''}`}>
        {row.verified ? <span className="u-badge">Verified</span> : null}
        <span className="u-logo" aria-hidden="true">
          {initials(row.name)}
        </span>
      </div>
      <div className="u-b">
        <h3>{row.name}</h3>
        {row.country ? <div className="u-loc">{row.country.name}</div> : null}
        <div className="u-meta">
          <div>
            <span>Programmes</span>
            <b>{row.offerings ? formatNumber(row.offerings) : '—'}</b>
          </div>
          <div>
            <span>Campuses</span>
            <b>{row.campuses ? formatNumber(row.campuses) : '—'}</b>
          </div>
          {row.institutionType ? (
            <div>
              <span>Type</span>
              <b>{humanise(row.institutionType)}</b>
            </div>
          ) : null}
          {row.country ? (
            <div>
              <span>Destination</span>
              <b>{row.country.name}</b>
            </div>
          ) : null}
        </div>
        {row.shortDescription ? <p className="u-desc">{row.shortDescription}</p> : null}
        <Link className="btn btn-ghost btn-sm" href={`/universities/${row.slug}`}>
          View university
        </Link>
      </div>
    </article>
  );
}
