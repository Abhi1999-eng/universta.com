'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchCombobox } from './SearchCombobox';
import type { Country, DirectoryRecord, PaginationMeta } from '@/lib/countries';
import { intakeRange } from '@/lib/intake-range';
import { formatNumber } from '@/lib/format';

/** The client-approved Study Destinations page.
 *
 * The template's hero counts ("25+ destinations", "12,000+ universities",
 * "95% visa success", "50,000+ students guided") are prototype copy. Universta
 * publishes real per-country statistics, so the strip is summed from those and
 * the two figures with no backing record -- visa success rate and students
 * guided -- are replaced by figures that do exist rather than invented.
 *
 * The prototype held region, letter and quick-filter state in page-local
 * JavaScript, so a reload or a shared link lost it and the "filters" only
 * narrowed a hard-coded array. Here every control writes to the URL and the
 * server re-queries `/countries`, which is what makes a filtered destination
 * list shareable and the counts honest. */

export type ConsultantSummary = {
  name: string;
  slug: string;
  summary: string | null;
  /** Real verification state; the template's blanket "Free consultation"
   * badge is a claim Universta does not record. */
  verified: boolean;
};

export type SectionCopy = { eyebrow?: string; heading?: string; subheading?: string };

export type CountriesReferenceProps = {
  countries: Country[];
  meta: PaginationMeta;
  /** Only regions that actually hold a published destination, each with its
   * real count. The prototype hard-coded six region tabs, so tapping one could
   * land on an empty list. */
  continents: Array<{ id: string; name: string; slug: string; count: number }>;
  directory: DirectoryRecord[];
  directoryMeta: PaginationMeta;
  consultants: ConsultantSummary[];
  filters: Record<string, string>;
  content: Record<string, SectionCopy | undefined>;
};

/** Every quick filter maps onto a parameter `/countries` already honours, so
 * none of them is decorative. */
const QUICK_FILTERS = [
  { key: 'budgetBand', value: 'BUDGET_FRIENDLY', label: 'Budget friendly' },
  { key: 'ieltsOptional', value: 'true', label: 'IELTS optional' },
  { key: 'visaSuccessBand', value: 'HIGH', label: 'High visa success' },
  { key: 'pathwayStrength', value: 'STRONG', label: 'PR friendly' },
  { key: 'hasTopRankedUniversities', value: 'true', label: 'Top ranked universities' },
] as const;

const COMPARE_POINTS = [
  'Tuition fees',
  'Living cost',
  'Scholarships',
  'Post-study work',
  'PR pathways',
  'English requirements',
  'Intakes',
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function initials(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function tuitionLabel(country: Country | DirectoryRecord) {
  const cost = country.profiles?.cost;
  if (!cost || (!cost.tuitionMin && !cost.tuitionMax)) return null;
  // ISO code only. Pairing it with the symbol produced "AED د.إ55,000" and, for
  // right-to-left symbols, reordered the whole range on screen.
  const code = cost.currencyCode ? `${cost.currencyCode} ` : '';
  const min = cost.tuitionMin ? formatNumber(cost.tuitionMin) : null;
  const max = cost.tuitionMax ? formatNumber(cost.tuitionMax) : null;
  const range = min && max && min !== max ? `${min}–${max}` : (min ?? max);
  const period = cost.tuitionPeriod === 'PER_YEAR' ? '/yr' : '';
  return `${code}${range}${period}`;
}

function workLabel(country: Country | DirectoryRecord) {
  const work = country.profiles?.work;
  if (!work?.postStudyWorkAvailable) return null;
  const min = work.postStudyWorkMinMonths;
  const max = work.postStudyWorkMaxMonths;
  if (!min && !max) return 'Available';
  const months = (value: number) =>
    value % 12 === 0 ? `${value / 12} yr${value === 12 ? '' : 's'}` : `${value} mo`;
  if (min && max && min !== max) return `${months(min)}–${months(max)}`;
  return months((min ?? max) as number);
}

function intakeLabel(country: Country | DirectoryRecord) {
  const intakes = country.profiles?.intakes ?? [];
  const usable = intakes
    .map((entry) => entry.intake ?? entry)
    .filter((entry) => entry && (entry.startMonth || entry.shortLabel || entry.name));
  if (!usable.length) return null;
  return usable
    .slice(0, 3)
    .map((entry) => intakeRange(entry))
    .join(', ');
}

function prFriendly(country: Country | DirectoryRecord) {
  return country.profiles?.work?.immigrationPathwayStrength === 'STRONG';
}

export function CountriesReference(props: CountriesReferenceProps) {
  const { countries, meta, directory, filters, content } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q ?? '');
  const [panelOpen, setPanelOpen] = useState(false);

  /** The structured filters are staged and applied together, so narrowing on
   * budget and English requirement costs one page load rather than two. Keyed
   * on the server-resolved filters so back/forward re-seeds the controls. */
  const filterKey = JSON.stringify(filters);
  const [panelDraft, setPanelDraft] = useState({
    budgetBand: filters.budgetBand ?? '',
    ieltsOptional: filters.ieltsOptional ?? '',
  });
  const [panelFor, setPanelFor] = useState(filterKey);
  if (panelFor !== filterKey) {
    setPanelDraft({
      budgetBand: filters.budgetBand ?? '',
      ieltsOptional: filters.ieltsOptional ?? '',
    });
    setPanelFor(filterKey);
  }

  function commit(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    setPanelOpen(false);
    router.push(`${pathname}${params.size ? `?${params}` : ''}#regions`);
  }

  /** Drops every filter and returns to the listing's own address, so the
   * cleared state is the one a visitor can bookmark or share. */
  function clearAll() {
    setQuery('');
    setPanelOpen(false);
    router.push(pathname);
  }

  function filterHref(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get(key) === value) params.delete(key);
    else params.set(key, value);
    params.delete('page');
    return `${pathname}${params.size ? `?${params}` : ''}#regions`;
  }

  /** Prev/Next name the page they land on explicitly -- arriving from an
   * out-of-range `?page=`, a URL that simply dropped the parameter would look
   * like nothing happened. */
  function pageUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(Math.max(page, 1)));
    return `${pathname}?${params}#regions`;
  }

  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));
    return `${pathname}${params.size ? `?${params}` : ''}#regions`;
  }

  const totals = useMemo(() => {
    let universities = 0;
    let courses = 0;
    let scholarships = 0;
    let topRanked = 0;
    for (const record of directory) {
      const stats = record.profiles?.statistics;
      universities += stats?.universitiesCount ?? 0;
      courses += stats?.coursesCount ?? 0;
      scholarships += stats?.scholarshipsCount ?? 0;
      topRanked += stats?.topRankedUniversitiesCount ?? 0;
    }
    return { universities, courses, scholarships, topRanked };
  }, [directory]);

  /** The directory is its own index of every published destination, so it is
   * grouped and anchored by letter rather than sharing the result filters. */
  const azGroups = useMemo(() => {
    const map = new Map<string, DirectoryRecord[]>();
    for (const record of [...directory].sort((a, b) => a.name.localeCompare(b.name))) {
      const initial = (record.letter ?? record.name[0] ?? '#').toUpperCase();
      const bucket = map.get(initial);
      if (bucket) bucket.push(record);
      else map.set(initial, [record]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [directory]);
  const activeLetters = useMemo(
    () => new Set(azGroups.map(([initial]) => initial)),
    [azGroups],
  );

  const activeRegion = filters.region ?? 'all';
  const hero = content.hero ?? {};
  const region = content.region ?? {};
  const ctaBand = content.ctaBand ?? {};
  const az = content.az ?? {};
  const ctaTwo = content.ctaTwo ?? {};
  const consultantsCopy = content.consultants ?? {};
  const final = content.final ?? {};

  const hasFilters = Object.keys(filters).some((key) => key !== 'page');
  const structuredCount = ['budgetBand', 'ieltsOptional', 'visaSuccessBand', 'pathwayStrength', 'hasTopRankedUniversities'].filter(
    (key) => filters[key],
  ).length;

  return (
    <div className="cref cref-dest">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/countries" aria-current="page">
            Study destinations
          </Link>
        </nav>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-in">
          <span className="hero-pill">
            <span className="dot" aria-hidden="true" /> <b>{props.directoryMeta.total}</b>&nbsp;destinations
            {totals.universities ? (
              <>
                {' '}
                · <b>{formatNumber(totals.universities)}</b>&nbsp;universities
              </>
            ) : null}
          </span>

          <h1 style={{ marginTop: 16 }}>
            {hero.heading ?? (
              <>
                Where will your degree <em>take you?</em>
              </>
            )}
          </h1>
          <p className="lead">
            {hero.subheading ??
              'Don’t just browse destinations — compare what actually decides your choice, side by side.'}
          </p>

          <div className="factchips">
            {COMPARE_POINTS.map((point) => (
              <span key={point}>{point}</span>
            ))}
          </div>

          <SearchCombobox
            label="Search a country"
            placeholder="Search a destination…"
            submitLabel="Search"
            endpoint="/api/countries/suggestions"
            emptyMessage="No destinations found."
            style={{ marginTop: 28 }}
            value={query}
            onValueChange={setQuery}
            onSubmit={(term) => commit({ q: term.trim() || null })}
          />

          <div className="qf">
            {QUICK_FILTERS.map((filter) => (
              <Link
                key={filter.key}
                href={filterHref(filter.key, filter.value)}
                className={filters[filter.key] === filter.value ? 'on' : undefined}
              >
                {filter.label}
              </Link>
            ))}
          </div>

          <div className="statgrid">
            <div className="stat">
              <b>{props.directoryMeta.total || '—'}</b>
              <span>Destinations</span>
            </div>
            <div className="stat">
              <b>{totals.universities ? formatNumber(totals.universities) : '—'}</b>
              <span>Universities</span>
            </div>
            <div className="stat">
              <b>{totals.courses ? formatNumber(totals.courses) : '—'}</b>
              <span>Courses</span>
            </div>
            <div className="stat">
              <b>{totals.scholarships ? formatNumber(totals.scholarships) : '—'}</b>
              <span>Scholarships</span>
            </div>
            <div className="stat">
              <b>{totals.topRanked ? formatNumber(totals.topRanked) : '—'}</b>
              <span>Top-ranked universities</span>
            </div>
            <div className="stat">
              <b>{props.continents.length || '—'}</b>
              <span>Regions</span>
            </div>
          </div>
        </div>
      </section>

      {/* REGIONS */}
      <section className="sec wrap" id="regions" style={{ paddingTop: 40 }}>
        <div className="sec-head left">
          <span className="eyebrow">{region.eyebrow ?? 'Browse by region'}</span>
          <h2>{region.heading ?? 'Start with the part of the world you’re drawn to.'}</h2>
          <p>
            {region.subheading ??
              'Every destination shown with the figures students actually decide on — tuition, post-study work rights and intakes.'}
          </p>
        </div>

        <div className="tabbar">
          <div className="tabs" aria-label="Filter destinations by region">
            <button
              type="button"
              className={`tab${activeRegion === 'all' ? ' on' : ''}`}
              onClick={() => commit({ region: null })}
            >
              All destinations <span className="n">{props.directoryMeta.total}</span>
            </button>
            {props.continents.map((continent) => (
              <button
                type="button"
                key={continent.id}
                className={`tab${activeRegion === continent.slug ? ' on' : ''}`}
                onClick={() => commit({ region: continent.slug })}
              >
                {continent.name} <span className="n">{continent.count}</span>
              </button>
            ))}
          </div>
          <div className="tabbar-actions">
            <button
              type="button"
              className={`btn btn-ghost btn-sm${panelOpen ? ' on' : ''}`}
              aria-expanded={panelOpen}
              aria-controls="country-filter-panel"
              onClick={() => setPanelOpen((current) => !current)}
            >
              Filters{structuredCount ? ` (${structuredCount})` : ''}
            </button>
            {hasFilters ? (
              <button type="button" className="linkbtn" onClick={clearAll}>
                Clear all filters
              </button>
            ) : null}
          </div>
        </div>

        {/* Structured filters, staged and applied together. */}
        <div
          id="country-filter-panel"
          className={`filtpanel${panelOpen ? ' is-open' : ''}`}
          aria-label="Destination filters"
        >
          <form
            className="filtpanel-in"
            onSubmit={(event) => {
              event.preventDefault();
              commit({
                budgetBand: panelDraft.budgetBand || null,
                ieltsOptional: panelDraft.ieltsOptional || null,
              });
            }}
          >
            <label className="fld">
              <span>Budget</span>
              <select
                value={panelDraft.budgetBand}
                onChange={(event) =>
                  setPanelDraft((current) => ({ ...current, budgetBand: event.target.value }))
                }
              >
                <option value="">Any budget</option>
                <option value="BUDGET_FRIENDLY">Budget friendly</option>
                <option value="MID_RANGE">Mid range</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </label>
            <label className="fld">
              <span>IELTS</span>
              <select
                value={panelDraft.ieltsOptional}
                onChange={(event) =>
                  setPanelDraft((current) => ({ ...current, ieltsOptional: event.target.value }))
                }
              >
                <option value="">Any requirement</option>
                <option value="true">Optional or waived</option>
              </select>
            </label>
            <div className="filtpanel-actions">
              <button type="submit" className="btn btn-primary btn-sm">
                Apply filters
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPanelOpen(false)}
              >
                Close
              </button>
            </div>
          </form>
        </div>

        <p className="res-count" data-testid="country-count">
          Showing {countries.length} of {meta.total} destination{meta.total === 1 ? '' : 's'}
        </p>

        {countries.length === 0 ? (
          <div className="cref-empty" data-testid="country-empty">
            <h3>No destinations match these filters</h3>
            <p>Try a different region, or clear the filters to see every published destination.</p>
            <Link className="btn btn-primary" href="/countries">
              Show every destination
            </Link>
          </div>
        ) : (
          <div className="cards">
            {countries.map((country) => {
              const tuition = tuitionLabel(country);
              const work = workLabel(country);
              const intake = intakeLabel(country);
              const universities = country.statistics?.universitiesCount;
              return (
                <article className="ccard" key={country.id}>
                  {prFriendly(country) ? <span className="pr-badge">PR friendly</span> : null}
                  <div className={`card-head${prFriendly(country) ? ' with-badge' : ''}`}>
                    <span className="flag" aria-hidden="true">
                      {country.flag?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={country.flag.url} alt="" />
                      ) : (
                        initials(country.name)
                      )}
                    </span>
                    <div>
                      <h3>{country.name}</h3>
                      {universities ? (
                        <div className="sub">
                          {formatNumber(universities)} universit{universities === 1 ? 'y' : 'ies'}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <p className="desc">{country.shortDescription}</p>
                  {tuition || work || intake ? (
                    <div className="facts">
                      {tuition ? (
                        <div className="f">
                          <span>Tuition</span>
                          <b>{tuition}</b>
                        </div>
                      ) : null}
                      {work ? (
                        <div className="f">
                          <span>Post-study work</span>
                          <b>{work}</b>
                        </div>
                      ) : null}
                      {intake ? (
                        <div className="f">
                          <span>Intakes</span>
                          <b>{intake}</b>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <Link className="card-cta" href={`/countries/${country.slug}`}>
                    Explore {country.name} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        {/* Rendered whenever the URL asks for a page, so an out-of-range one
            still offers a way back rather than a dead end. */}
        {meta.totalPages > 1 || meta.page > 1 ? (
          <nav className="pager" aria-label="Country results pages">
            <button
              type="button"
              disabled={meta.page <= 1}
              onClick={() => router.push(pageUrl(meta.page - 1))}
            >
              Previous
            </button>
            {Array.from({ length: meta.totalPages }, (_, index) => index + 1).map((page) =>
              page === meta.page ? (
                <span className="cur" key={page}>
                  {page}
                </span>
              ) : (
                <Link key={page} href={pageHref(page)}>
                  {page}
                </Link>
              ),
            )}
            <button
              type="button"
              disabled={meta.page >= meta.totalPages}
              onClick={() => router.push(pageUrl(meta.page + 1))}
            >
              Next
            </button>
            <span className="pager-status" aria-current="page">
              Page {meta.page} of {Math.max(meta.totalPages, 1)}
            </span>
          </nav>
        ) : null}
      </section>

      {/* CTA BAND */}
      <div className="wrap">
        <section className="cta-band">
          <div>
            <h2>{ctaBand.heading ?? 'Confused about choosing the right destination?'}</h2>
            <p>
              {ctaBand.subheading ??
                'Talk with a counsellor and get a clear, personalised plan — at no cost.'}
            </p>
            <ul className="cta-list">
              <li>Free profile evaluation</li>
              <li>University shortlisting</li>
              <li>Scholarship guidance</li>
              <li>Visa assistance</li>
            </ul>
            <div className="cta-btns">
              <Link href="/counselling" className="btn btn-w btn-lg">
                Get free counselling
              </Link>
              <Link href="/study-abroad-consultants" className="btn btn-o btn-lg">
                Browse consultants
              </Link>
            </div>
          </div>
          <div className="cta-art" aria-hidden="true">
            <svg viewBox="0 0 300 240" fill="none">
              <circle cx="150" cy="120" r="88" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />
              <circle cx="150" cy="120" r="62" stroke="rgba(255,255,255,.16)" strokeWidth="1.5" />
              <path
                d="M62 120h176M150 32c22 26 22 150 0 176M150 32c-22 26-22 150 0 176"
                stroke="rgba(255,255,255,.22)"
                strokeWidth="1.5"
              />
              <rect x="86" y="60" width="86" height="56" rx="12" fill="#fff" />
              <rect x="98" y="76" width="46" height="6" rx="3" fill="#1657cf" opacity=".85" />
              <rect x="98" y="90" width="30" height="6" rx="3" fill="#1657cf" opacity=".4" />
              <rect x="132" y="140" width="86" height="56" rx="12" fill="#a8c7ff" />
              <rect x="144" y="156" width="46" height="6" rx="3" fill="#0f3fa0" />
              <rect x="144" y="170" width="30" height="6" rx="3" fill="#0f3fa0" opacity=".55" />
              <circle cx="214" cy="66" r="16" fill="#fff" opacity=".9" />
              <path
                d="M208 66l4 4 8-8"
                stroke="#1657cf"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </section>
      </div>

      {/* A–Z */}
      {directory.length ? (
        <section className="sec wrap" id="az">
          <div className="sec-head left">
            <span className="eyebrow">{az.eyebrow ?? 'Every destination'}</span>
            <h2>{az.heading ?? 'Browse every destination A–Z'}</h2>
            <p>{az.subheading ?? 'Jump straight to a destination and see what’s on offer at each level.'}</p>
          </div>

          <div className="alpha">
            {LETTERS.map((value) =>
              activeLetters.has(value) ? (
                <a className="directory-letter" key={value} href={`#directory-letter-${value}`}>
                  {value}
                </a>
              ) : (
                <button
                  type="button"
                  className="directory-letter"
                  key={value}
                  disabled
                  aria-label={`No destinations starting with ${value}`}
                >
                  {value}
                </button>
              ),
            )}
          </div>

          {azGroups.map(([initial, records]) => (
            <div className="az-letter" id={`directory-letter-${initial}`} key={initial}>
              <h3 className="az-letter-head">{initial}</h3>
              <div className="az-grid">
                {records.map((record) => {
                  const counts = [
                    ['UG', record.programCounts.ug],
                    ['PG', record.programCounts.pg],
                    ['PGDM', record.programCounts.pgdm],
                    ['MBA', record.programCounts.mba],
                  ].filter(([, value]) => value) as Array<[string, number]>;
                  return (
                    <article className="az-tile" key={record.slug}>
                      <div className="t">
                        <span
                          className="flag"
                          style={{ width: 34, height: 34, fontSize: 13 }}
                          aria-hidden="true"
                        >
                          {record.flag?.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={record.flag.url} alt="" />
                          ) : (
                            initials(record.name)
                          )}
                        </span>
                        <h4>Study in {record.name}</h4>
                      </div>
                      <p>{record.shortDescription}</p>
                      {counts.length ? (
                        <div className="progs">
                          {counts.map(([label, value]) => (
                            <span key={label}>
                              <b>{formatNumber(value)}</b> {label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <Link className="go" href={`/countries/${record.slug}`}>
                        Explore →
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* CTA 2 */}
      <div className="wrap">
        <section className="cta2">
          <h2>{ctaTwo.heading ?? 'Ready to start your study abroad journey?'}</h2>
          <p>
            {ctaTwo.subheading ??
              'Compare destinations side by side, shortlist the courses that fit, and talk it through with a counsellor.'}
          </p>
          <div className="cta2-btns">
            <Link href="/compare/countries" className="btn btn-primary btn-lg">
              Compare destinations
            </Link>
            <Link href="/counselling" className="btn btn-ghost btn-lg">
              Book free consultation
            </Link>
          </div>
        </section>
      </div>

      {/* CONSULTANTS */}
      {props.consultants.length ? (
        <section className="sec wrap" id="consultants">
          <div className="sec-head left">
            <span className="eyebrow">{consultantsCopy.eyebrow ?? 'Study abroad consultants'}</span>
            <h2>{consultantsCopy.heading ?? 'Guidance from people who know your destination.'}</h2>
            <p>
              {consultantsCopy.subheading ??
                'Published consultants with listed destinations, services and contact details.'}
            </p>
          </div>
          <div className="cons-grid">
            {props.consultants.map((consultant) => (
              <article className="cons" key={consultant.slug}>
                <div className="cons-top">
                  <span className="fl" aria-hidden="true">
                    {initials(consultant.name)}
                  </span>
                  <h3>{consultant.name}</h3>
                </div>
                {consultant.summary ? <p>{consultant.summary}</p> : <p />}
                {consultant.verified ? <span className="free-badge">Verified profile</span> : null}
                <Link className="view" href={`/study-abroad-consultants/${consultant.slug}`}>
                  View consultant
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* FINAL */}
      <section className="final">
        <div className="wrap">
          <span className="eyebrow">{final.eyebrow ?? 'Personalised shortlist'}</span>
          <h2>{final.heading ?? 'Not sure which destination fits you?'}</h2>
          <p>
            {final.subheading ??
              'Tell a counsellor about your profile and get help narrowing the destinations, universities and courses that suit it.'}
          </p>
          <div className="final-btns">
            <Link href="/counselling" className="btn btn-w btn-lg">
              Talk to a counsellor
            </Link>
            <Link href="/courses" className="btn btn-o btn-lg">
              Browse courses
            </Link>
          </div>
          <div className="trust">
            <span>No cost, no obligation</span>
            <span>Published, source-referenced figures</span>
            {hasFilters ? <span>Filters are shareable — the URL keeps them</span> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
