'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatNumber } from '@/lib/format';

/** The client-approved study abroad consultants marketplace.
 *
 * The template sells the marketplace on star ratings, review counts, success
 * rates, "students placed", response times, next available slots, premium
 * tiers and a paid-placement badge. Universta records a consultant's name,
 * description, contact details, verification state, destinations, services and
 * languages — nothing else — so the card carries those and the rating,
 * placement and availability blocks are omitted rather than invented.
 *
 * Every facet maps to a parameter the consultants endpoint honours
 * (destination, service, language, location), so the rail cannot offer a
 * control that filters nothing, and the selection lives in the URL. */

export type ConsultantRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  verified: boolean;
  countries: string[];
  services: string[];
  languages: string[];
  locations: string[];
};

export type ConsultantsReferenceProps = {
  /** True when the directory could not be loaded at all, which is not the same
   * fact as a directory that is legitimately empty. */
  loadFailed?: boolean;
  rows: ConsultantRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  filters: Record<string, string>;
  facets: {
    countries: Array<{ value: string; label: string }>;
    services: Array<{ value: string; label: string }>;
    languages: Array<{ value: string; label: string }>;
    locations: Array<{ value: string; label: string }>;
  };
  heading: string;
  headingAccent: string;
  lede: string;
};

const HOW_IT_WORKS = [
  { h: 'Search the directory', p: 'Filter published consultants by destination, service and language.' },
  { h: 'Check what they cover', p: 'Every profile lists its destinations, services and contact details.' },
  { h: 'Get in touch directly', p: 'Contact details come from the consultant’s own published record.' },
  { h: 'Or talk to Universta', p: 'Book a free counselling session if you would rather start with us.' },
];

const FAQS = [
  {
    q: 'Does Universta charge consultants for placement here?',
    a: 'No. The directory lists published consultant records in the catalogue order; there is no paid placement and no ranking.',
  },
  {
    q: 'What does the “verified” badge mean?',
    a: 'It means an administrator has verified the record against a source and dated that check. An unverified profile is still published, just not yet checked.',
  },
  {
    q: 'Are consultants rated or reviewed?',
    a: 'Not on Universta. We do not collect ratings, so none are shown — a star rating here would be invented.',
  },
  {
    q: 'How do I contact a consultant?',
    a: 'Open the profile. Whatever contact details the consultant published — email, phone, website — appear there.',
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

export function ConsultantsReference(props: ConsultantsReferenceProps) {
  const loadFailed = props.loadFailed ?? false;
  const hasStats =
    Boolean(props.meta.total) ||
    Boolean(props.facets.countries.length) ||
    Boolean(props.facets.services.length) ||
    Boolean(props.facets.languages.length);
  const { rows, meta, filters, facets } = props;
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
    router.push(`${pathname}${params.size ? `?${params}` : ''}#results`);
  }

  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));
    return `${pathname}${params.size ? `?${params}` : ''}#results`;
  }

  const groups = [
    { key: 'country', label: 'Destination covered', options: facets.countries, open: true },
    { key: 'service', label: 'Service', options: facets.services, open: true },
    { key: 'language', label: 'Language', options: facets.languages, open: false },
    { key: 'location', label: 'Office location', options: facets.locations, open: false },
  ].filter((group) => group.options.length > 0);

  const activeCount = Object.keys(filters).filter((key) => !['q', 'page'].includes(key)).length;

  return (
    <div className="cref cref-dest">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/study-abroad-consultants" aria-current="page">
            Study abroad consultants
          </Link>
        </nav>
      </div>

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
                placeholder="Search consultants by name…"
                aria-label="Search consultants"
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </div>
          </form>

          {/* Four cards each reading "—" is chrome without information. The
            * strip earns its space only once there is at least one figure to
            * put in it, and each card appears only if its own figure exists. */}
          {hasStats ? (
            <div className="hstats">
              {meta.total ? (
                <div className="hstat">
                  <b>{formatNumber(meta.total)}</b>
                  <span>Consultants</span>
                </div>
              ) : null}
              {facets.countries.length ? (
                <div className="hstat">
                  <b>{facets.countries.length}</b>
                  <span>Destinations covered</span>
                </div>
              ) : null}
              {facets.services.length ? (
                <div className="hstat">
                  <b>{facets.services.length}</b>
                  <span>Services</span>
                </div>
              ) : null}
              {facets.languages.length ? (
                <div className="hstat">
                  <b>{facets.languages.length}</b>
                  <span>Languages</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="sec sec-alt" id="results">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">Directory</span>
            <h2>Find a consultant</h2>
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
              aria-label="Filter consultants"
              data-testid="consultant-filters"
            >
              <div className="f-head">
                <h3>Filters</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {activeCount ? (
                    <Link className="f-clear" href="/study-abroad-consultants#results">
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
                {groups.map((group) => (
                  <details className="fg" key={group.key} open={group.open}>
                    <summary>{group.label}</summary>
                    <div className="fb">
                      {group.options.slice(0, 12).map((option) => {
                        const checked = filters[group.key] === option.value;
                        return (
                          <label className="fopt" key={option.value}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                commit({ [group.key]: checked ? null : option.value })
                              }
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>

              <div className="ffoot">
                {/* Offering "Show 0 results" as the primary action invites a tap
                  * that cannot do anything. With nothing to show, the useful
                  * action is clearing the filters. */}
                {meta.total ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Show {formatNumber(meta.total)} result{meta.total === 1 ? '' : 's'}
                  </button>
                ) : activeCount ? (
                  <Link className="btn btn-ghost btn-block" href="/study-abroad-consultants#results">
                    Clear filters
                  </Link>
                ) : (
                  <button type="button" className="btn btn-ghost btn-block" onClick={() => setDrawerOpen(false)}>
                    Close
                  </button>
                )}
              </div>
            </aside>

            <div>
              <div className="resbar">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm filter-toggle"
                  onClick={() => setDrawerOpen(true)}
                >
                  ☰ Filters{activeCount ? ` (${activeCount})` : ''}
                </button>
                <p className="rescount" data-testid="consultant-count">
                  {loadFailed ? (
                    'Directory unavailable'
                  ) : (
                    <>
                      <b>{formatNumber(meta.total)}</b> consultant{meta.total === 1 ? '' : 's'}
                    </>
                  )}
                </p>
              </div>

              {loadFailed ? (
                <div className="cref-empty" data-testid="consultant-error" role="alert">
                  <h3>Consultants could not be loaded</h3>
                  <p>
                    The directory did not respond just now. This is a problem on our side, not a
                    sign that no consultants are published.
                  </p>
                  <Link className="btn btn-primary" href="/study-abroad-consultants#results">
                    Try again
                  </Link>
                </div>
              ) : rows.length === 0 ? (
                <div className="cref-empty" data-testid="consultant-empty">
                  {activeCount ? (
                    <>
                      <h3>No consultants match these filters</h3>
                      <p>Clear a filter to see the full published directory.</p>
                      <Link className="btn btn-primary" href="/study-abroad-consultants#results">
                        Clear filters
                      </Link>
                    </>
                  ) : (
                    <>
                      <h3>No consultants published yet</h3>
                      <p>
                        Consultant profiles appear here as they are published. In the meantime a
                        Universta counsellor can talk through your options.
                      </p>
                      <Link className="btn btn-primary" href="/counselling">
                        Book free counselling
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                <div className="clist">
                  {rows.map((row) => (
                    <article className="ccard" key={row.id}>
                      <div className="cc-cover" />
                      <div className="cc-in">
                        <span className="cc-logo" aria-hidden="true">
                          {initials(row.name)}
                        </span>
                        <div className="cc-main">
                          <div className="cc-name">
                            <h3>
                              <Link href={`/study-abroad-consultants/${row.slug}`}>{row.name}</Link>
                            </h3>
                          </div>
                          {row.locations.length ? (
                            <div className="cc-loc">{row.locations.join(' · ')}</div>
                          ) : null}
                          {row.shortDescription ? (
                            <p className="cc-desc">{row.shortDescription}</p>
                          ) : null}
                          <div className="cc-stats">
                            <div>
                              <span>Destinations</span>
                              <b>{row.countries.length || '—'}</b>
                            </div>
                            <div>
                              <span>Services</span>
                              <b>{row.services.length || '—'}</b>
                            </div>
                            <div>
                              <span>Languages</span>
                              <b>{row.languages.length || '—'}</b>
                            </div>
                          </div>
                          {row.countries.length || row.services.length ? (
                            <div className="cc-tags">
                              {row.countries.slice(0, 3).map((country) => (
                                <span className="pill-mini" key={country}>
                                  {country}
                                </span>
                              ))}
                              {row.services.slice(0, 3).map((service) => (
                                <span className="pill-mini" key={service}>
                                  {service}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="cc-side">
                          {row.verified ? (
                            <div className="cc-verified">
                              <span>Record</span>
                              <b>Verified</b>
                            </div>
                          ) : null}
                          <Link
                            className="btn btn-primary btn-sm"
                            href={`/study-abroad-consultants/${row.slug}`}
                          >
                            View profile
                          </Link>
                          <Link className="btn btn-ghost btn-sm" href="/counselling">
                            Free counselling
                          </Link>
                        </div>
                      </div>
                    </article>
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

      {/* BY DESTINATION */}
      {facets.countries.length ? (
        <section className="sec" id="destinations">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">By destination</span>
              <h2>Consultants by study destination</h2>
              <p>Every destination a published consultant covers.</p>
            </div>
            <div className="dest-flags">
              {facets.countries.map((country) => (
                <Link
                  key={country.value}
                  className="dest-flag"
                  href={`/study-abroad-consultants?country=${country.value}#results`}
                >
                  <span className="cc">{initials(country.label)}</span>
                  {country.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* HOW IT WORKS */}
      <section className="sec sec-alt" id="how">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">How it works</span>
            <h2>Finding the right help</h2>
          </div>
          <div className="grid g4">
            {HOW_IT_WORKS.map((step, index) => (
              <article className="card" key={step.h}>
                <span className="eyebrow">Step {index + 1}</span>
                <h3 style={{ fontSize: 17, marginTop: 8 }}>{step.h}</h3>
                <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>{step.p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec" id="faq">
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

      <section className="final">
        <div className="wrap">
          <span className="eyebrow">Next step</span>
          <h2>Would you rather start with us?</h2>
          <p>
            Book a free counselling session and we will help you narrow destinations, universities
            and courses before you approach a consultant.
          </p>
          <div className="final-btns">
            <Link href="/counselling" className="btn btn-w btn-lg">
              Book free counselling
            </Link>
            <Link href="/countries" className="btn btn-o btn-lg">
              Browse destinations
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
