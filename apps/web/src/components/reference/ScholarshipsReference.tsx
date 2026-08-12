'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ScholarshipRow } from '@/components/templates/ListingCards';

/** The client-approved Scholarships page.
 *
 * Layout, section order and styling follow the approved template exactly. The
 * numbers do not: the template's "100,000+ scholarships", per-country counts
 * and sample awards are prototype copy, so every figure here comes from the
 * real catalogue and any figure the catalogue cannot support is left out
 * rather than invented.
 *
 * Filters are the same: the template offers nationality, intake and provider
 * facets that the scholarships endpoint does not implement. Rendering them
 * would give an admin-facing lie -- a control that looks live and filters
 * nothing -- so only the supported facets appear. */

export type FacetOption = { value: string; label: string };

export type ScholarshipsReferenceProps = {
  rows: ScholarshipRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  filters: Record<string, string>;
  countries: FacetOption[];
  subjects: FacetOption[];
  levels: FacetOption[];
  universities: FacetOption[];
  benefitTypes: FacetOption[];
  /** Real catalogue totals for the stat strip. */
  totals: { scholarships: number; countries: number; universities: number };
  heading: string;
  headingAccent: string;
  lede: string;
};

const SORTS = [
  { value: 'featured', label: 'Featured first' },
  { value: 'deadline', label: 'Deadline (soonest)' },
  { value: 'amount-desc', label: 'Award (highest)' },
  { value: 'amount-asc', label: 'Award (lowest)' },
  { value: 'name-asc', label: 'Title (A–Z)' },
];

const FAQS = [
  {
    q: 'What is a fully funded scholarship?',
    a: 'A fully funded scholarship covers all major study costs — usually tuition, living expenses, travel and sometimes health insurance — so you can study abroad with little to no personal financial burden.',
  },
  {
    q: 'Who can apply for international scholarships?',
    a: 'Eligibility varies by award. Most are open to students who hold or plan to apply for a place at an eligible institution and who meet the academic, language, nationality and field-of-study conditions set by the funder.',
  },
  {
    q: 'How do I find scholarships for my course?',
    a: 'Use the filters on this page to narrow scholarships by destination, university, degree level, subject area and funding type — or browse by category below.',
  },
  {
    q: 'Can I apply for multiple scholarships?',
    a: "Yes. You can apply to as many scholarships as you're eligible for. Build a shortlist and keep track of every deadline.",
  },
  {
    q: 'Do scholarships cover living expenses?',
    a: 'Some do. Fully funded awards usually include a living stipend, while partial or tuition-waiver scholarships may not. Every scholarship page lists exactly what the funding covers.',
  },
  {
    q: 'When should I apply?',
    a: 'Most deadlines fall several months before the intake, often alongside or before your university application. Apply as early as you can.',
  },
  {
    q: 'How can Universta help with scholarship applications?',
    a: 'Universta gives you a published scholarship directory, filters to narrow it down, and access to counsellors who can guide you through eligibility, documents and submission.',
  },
];

const WHY = [
  { ic: '🗄️', h: 'Published directory', p: 'Funding opportunities from universities, governments and organisations, kept in one place.' },
  { ic: '🎛️', h: 'Smart search & filters', p: 'Narrow results by destination, university, degree, subject and funding type.' },
  { ic: '✅', h: 'Source-aware information', p: 'Scholarship details are recorded against the provider that publishes them.' },
  { ic: '🔖', h: 'Shortlist as you go', p: 'Open any award to see eligibility, amount and deadline in full before you apply.' },
  { ic: '🧭', h: 'Application guidance', p: 'Talk to a counsellor about eligibility, documents and submission.' },
  { ic: '🌍', h: 'Destination context', p: 'See the destination and university each award belongs to before applying.' },
];

function formatDeadline(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatAmount(row: ScholarshipRow) {
  if (row.amount === null || row.amount === undefined || row.amount === '') return null;
  const amount =
    typeof row.amount === 'number' ? row.amount.toLocaleString('en-GB') : String(row.amount);
  return row.currencyCode ? `${row.currencyCode} ${amount}` : amount;
}

/** Stored benefit types are enum-shaped (FIXED_GRANT, TUITION_REDUCTION).
 * Visitors should never read a database value, so they are turned back into
 * words here rather than shown raw. */
function humanise(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (character) => character.toUpperCase());
}

/** Initials for the award tile, so a card reads as a card even with no logo. */
function initials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function ScholarshipsReference(props: ScholarshipsReferenceProps) {
  const { rows, meta, filters, totals } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q ?? '');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const facetGroups = useMemo(
    () =>
      [
        { key: 'country', label: 'Study destination', options: props.countries, open: true },
        { key: 'degreeLevel', label: 'Degree level', options: props.levels, open: true },
        { key: 'subject', label: 'Subject area', options: props.subjects, open: false },
        { key: 'type', label: 'Scholarship type', options: props.benefitTypes, open: true },
        { key: 'university', label: 'University', options: props.universities, open: false },
      ].filter((group) => group.options.length > 0),
    [props.countries, props.levels, props.subjects, props.benefitTypes, props.universities],
  );

  /** One place that turns a facet change into a URL, so the browser back button
   * and a shared link both keep working -- the prototype held all of this in
   * page-local JavaScript and lost it on reload. */
  function commit(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    router.push(`${pathname}${params.size ? `?${params}` : ''}`);
    setDrawerOpen(false);
  }

  const activeCount = Object.keys(filters).filter(
    (key) => key !== 'q' && key !== 'sort' && key !== 'page',
  ).length;

  const from = rows.length ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = rows.length ? from + rows.length - 1 : 0;

  return (
    <div className="cref">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/scholarships" aria-current="page">
            Scholarships
          </Link>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap hero-in">
          <span className="chip">🎓 Published scholarship directory</span>
          <h1 style={{ marginTop: 16 }}>
            {props.heading} {props.headingAccent ? <span className="g">{props.headingAccent}</span> : null}
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
                aria-label="Search scholarships"
                placeholder="Search scholarships by title…"
              />
              <button className="btn btn-primary" type="submit">
                Search
              </button>
            </div>
          </form>

          {props.countries.length ? (
            <div className="pop">
              <b>Popular:</b>
              {props.countries.slice(0, 4).map((country) => (
                <button
                  key={country.value}
                  type="button"
                  className="chip chip-gray"
                  onClick={() => commit({ country: country.value })}
                >
                  {country.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* Real catalogue counts only. The template's headline figures were
              prototype values and are deliberately not reproduced. */}
          <div className="statgrid">
            <div className="stat">
              <b>{totals.scholarships.toLocaleString('en-GB')}</b>
              <span>Published scholarships</span>
            </div>
            <div className="stat">
              <b>{totals.countries.toLocaleString('en-GB')}</b>
              <span>Study destinations</span>
            </div>
            <div className="stat">
              <b>{totals.universities.toLocaleString('en-GB')}</b>
              <span>Universities</span>
            </div>
            <div className="stat">
              <b>{props.levels.length || '—'}</b>
              <span>Degree levels</span>
            </div>
            <div className="stat">
              <b>{props.subjects.length || '—'}</b>
              <span>Subject areas</span>
            </div>
            <div className="stat">
              <b>{props.benefitTypes.length || '—'}</b>
              <span>Funding types</span>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap listing">
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
          aria-label="Filter scholarships"
          data-testid="scholarship-filters"
        >
          <div className="fhead">
            <h3>Filters</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {activeCount ? (
                <Link
                  href="/scholarships"
                  style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}
                >
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

          {facetGroups.map((group) => (
            <details className="fgroup" key={group.key} open={group.open}>
              <summary>
                {group.label} <span className="caret">▾</span>
              </summary>
              <div className="opts">
                {group.options.slice(0, 12).map((option) => {
                  const checked = filters[group.key] === option.value;
                  return (
                    <label className="opt" key={option.value}>
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

          <details className="fgroup" open>
            <summary>
              Application status <span className="caret">▾</span>
            </summary>
            <div className="opts">
              <label className="opt">
                <input
                  type="checkbox"
                  checked={filters.deadline === 'open'}
                  onChange={() =>
                    commit({ deadline: filters.deadline === 'open' ? null : 'open' })
                  }
                />
                Open deadlines only
              </label>
            </div>
          </details>
        </aside>

        <div className="main-col">
          <div className="main-head">
            <button
              type="button"
              className="btn btn-ghost btn-sm filter-toggle"
              onClick={() => setDrawerOpen(true)}
            >
              ⚙ Filters{activeCount ? ` (${activeCount})` : ''}
            </button>
            <div className="count" data-testid="scholarship-count">
              {meta.total ? (
                <>
                  <span>Showing</span> {from}–{to}{' '}
                  <span>
                    of {meta.total.toLocaleString('en-GB')}{' '}
                    {meta.total === 1 ? 'scholarship' : 'scholarships'}
                  </span>
                </>
              ) : (
                <span>No scholarships published yet</span>
              )}
            </div>
            <div className="sortsel" style={{ marginLeft: 'auto' }}>
              <label htmlFor="scholarship-sort" style={{ fontSize: 13, color: 'var(--muted)' }}>
                Sort by
              </label>
              <select
                id="scholarship-sort"
                value={filters.sort ?? 'featured'}
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

          <div className="slist" aria-live="polite">
            {rows.map((row) => {
              const amount = formatAmount(row);
              const deadline = formatDeadline(row.deadline);
              return (
                <article className="scard" key={row.id}>
                  <div className="st-top">
                    <div className="logo">{initials(row.title)}</div>
                    <div style={{ flex: 1 }}>
                      <h3>
                        <Link href={`/scholarships/${row.slug}`}>{row.title}</Link>
                      </h3>
                      {row.provider?.name ? <div className="org">{row.provider.name}</div> : null}
                    </div>
                  </div>

                  <div className="rowchips">
                    {row.isFeatured ? <span className="chip">Featured</span> : null}
                    {row.benefitType ? (
                      <span className="chip chip-green">{humanise(row.benefitType)}</span>
                    ) : null}
                  </div>

                  {row.summary ? <p className="desc">{row.summary}</p> : null}

                  <div className="facts">
                    {amount ? (
                      <div className="f">
                        <small>Funding</small>
                        <b className="amt">{amount}</b>
                      </div>
                    ) : null}
                    {deadline ? (
                      <div className="f">
                        <small>Deadline</small>
                        <b className="dl">{deadline}</b>
                      </div>
                    ) : null}
                    {row.eligibility ? (
                      <div className="f">
                        <small>Eligibility</small>
                        <b>{row.eligibility}</b>
                      </div>
                    ) : null}
                  </div>

                  <div className="actions">
                    <Link href={`/scholarships/${row.slug}`} className="btn btn-primary btn-sm">
                      View details
                    </Link>
                    <Link href="/counselling" className="btn btn-ghost btn-sm">
                      Ask a counsellor
                    </Link>
                  </div>
                </article>
              );
            })}

            {rows.length === 0 ? (
              <div className="cref-empty" data-testid="scholarship-empty">
                <h3>
                  {activeCount || filters.q
                    ? 'No scholarships match these filters'
                    : 'No scholarships published yet'}
                </h3>
                <p>
                  {activeCount || filters.q
                    ? 'Clear one or more filters to return to the published directory.'
                    : 'Published scholarships will appear here as they are added.'}
                </p>
                {activeCount || filters.q ? (
                  <Link href="/scholarships" className="btn btn-primary" style={{ marginTop: 18 }}>
                    Clear all filters
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          {meta.totalPages > 1 ? (
            <nav className="pager" aria-label="Pagination">
              {Array.from({ length: meta.totalPages }, (_, index) => index + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === meta.totalPages ||
                    Math.abs(page - meta.page) <= 1,
                )
                .map((page, index, list) => {
                  const params = new URLSearchParams(searchParams.toString());
                  if (page === 1) params.delete('page');
                  else params.set('page', String(page));
                  const gap = index > 0 && page - list[index - 1] > 1;
                  return (
                    <span key={page} style={{ display: 'contents' }}>
                      {gap ? <span aria-hidden="true">…</span> : null}
                      <Link
                        href={`/scholarships${params.size ? `?${params}` : ''}`}
                        aria-current={page === meta.page ? 'page' : undefined}
                      >
                        {page}
                      </Link>
                    </span>
                  );
                })}
            </nav>
          ) : null}
        </div>
      </div>

      {/* Browse by category — every link is a real, crawlable filtered view. */}
      {props.countries.length || props.levels.length || props.subjects.length ? (
        <section className="sec sec-soft">
          <div className="wrap">
            <div className="sec-head left">
              <span className="eyebrow">Explore</span>
              <h2>Browse scholarships by category</h2>
              <p>Jump straight to the funding that fits.</p>
            </div>
            <div className="browse">
              {props.countries.length ? (
                <div className="bcol">
                  <h4>
                    <span className="d">🌍</span>By destination
                  </h4>
                  {props.countries.slice(0, 6).map((country) => (
                    <Link key={country.value} href={`/scholarships?country=${country.value}`}>
                      Scholarships in {country.label}
                    </Link>
                  ))}
                </div>
              ) : null}
              {props.levels.length ? (
                <div className="bcol">
                  <h4>
                    <span className="d">🎓</span>By degree
                  </h4>
                  {props.levels.slice(0, 6).map((level) => (
                    <Link key={level.value} href={`/scholarships?degreeLevel=${level.value}`}>
                      {level.label} scholarships
                    </Link>
                  ))}
                </div>
              ) : null}
              {props.subjects.length ? (
                <div className="bcol">
                  <h4>
                    <span className="d">📚</span>By subject
                  </h4>
                  {props.subjects.slice(0, 6).map((subject) => (
                    <Link key={subject.value} href={`/scholarships?subject=${subject.value}`}>
                      {subject.label} scholarships
                    </Link>
                  ))}
                </div>
              ) : null}
              {props.benefitTypes.length ? (
                <div className="bcol">
                  <h4>
                    <span className="d">💰</span>By funding type
                  </h4>
                  {props.benefitTypes.slice(0, 6).map((type) => (
                    <Link key={type.value} href={`/scholarships?type=${type.value}`}>
                      {type.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Why Universta</span>
            <h2>Why use the Universta scholarship finder?</h2>
            <p>Everything you need to find and shortlist funding for your studies abroad.</p>
          </div>
          <div className="why">
            {WHY.map((card) => (
              <div className="wcard" key={card.h}>
                <div className="ic">{card.ic}</div>
                <h3>{card.h}</h3>
                <p>{card.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec sec-soft">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Answers</span>
            <h2>Frequently asked questions</h2>
          </div>
          <div className="faq">
            {FAQS.map((faq, index) => (
              <details className="qa" key={faq.q} open={index === 0}>
                <summary>
                  {faq.q}
                  <span className="plus">+</span>
                </summary>
                <div className="ans">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="ctaband">
            <h2>Discover scholarships that match your goals</h2>
            <p>
              Talk to a counsellor about which published awards fit your profile, and what each one
              needs from you before the deadline.
            </p>
            <div className="row">
              <Link href="/counselling" className="btn btn-lg" style={{ background: '#fff', color: 'var(--blue)' }}>
                Book free counselling
              </Link>
              <Link
                href="/universities"
                className="btn btn-lg"
                style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}
              >
                Explore universities
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
