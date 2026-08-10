'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  const [suggestions, setSuggestions] = useState<Array<{ name: string; slug: string }>>([]);
  const [letter, setLetter] = useState('all');
  const searchRef = useRef<HTMLFormElement | null>(null);

  function commit(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    setSuggestions([]);
    router.push(`${pathname}${params.size ? `?${params}` : ''}#regions`);
  }

  function filterHref(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get(key) === value) params.delete(key);
    else params.set(key, value);
    params.delete('page');
    return `${pathname}${params.size ? `?${params}` : ''}#regions`;
  }

  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));
    return `${pathname}${params.size ? `?${params}` : ''}#regions`;
  }

  /** Live suggestions come from the real countries endpoint; the prototype
   * searched its own in-page array. */
  useEffect(() => {
    const term = query.trim();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (term.length < 2) {
        setSuggestions([]);
        return;
      }
      void (async () => {
        try {
          const response = await fetch(`/api/countries/suggestions?q=${encodeURIComponent(term)}`);
          if (!response.ok) return;
          const body = (await response.json()) as { data?: Array<{ name: string; slug: string }> };
          if (!cancelled) setSuggestions((body.data ?? []).slice(0, 5));
        } catch {
          if (!cancelled) setSuggestions([]);
        }
      })();
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) setSuggestions([]);
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

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

  const activeLetters = useMemo(
    () => new Set(directory.map((record) => record.letter?.toUpperCase()).filter(Boolean)),
    [directory],
  );
  const azList = useMemo(
    () =>
      [...directory]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((record) => letter === 'all' || record.letter?.toUpperCase() === letter),
    [directory, letter],
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

          <form
            className="searchwrap"
            ref={searchRef}
            style={{ marginTop: 28 }}
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
                placeholder="Search a destination…"
                aria-label="Search a destination"
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </div>
            {suggestions.length ? (
              <div className="suggest">
                {suggestions.map((item) => (
                  <Link key={item.slug} href={`/countries/${item.slug}`}>
                    {item.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </form>

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
          <div className="tabs" role="tablist" aria-label="Filter destinations by region">
            <Link
              href={
                (() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('region');
                  params.delete('page');
                  return `${pathname}${params.size ? `?${params}` : ''}#regions`;
                })() as string
              }
              className={`tab${activeRegion === 'all' ? ' on' : ''}`}
            >
              All destinations <span className="n">{props.directoryMeta.total}</span>
            </Link>
            {props.continents.map((continent) => (
              <Link
                key={continent.id}
                href={filterHref('region', continent.slug)}
                className={`tab${activeRegion === continent.slug ? ' on' : ''}`}
              >
                {continent.name} <span className="n">{continent.count}</span>
              </Link>
            ))}
          </div>
        </div>

        <p className="res-count" data-testid="country-count">
          Showing {countries.length} of {meta.total} destination{meta.total === 1 ? '' : 's'}
        </p>

        {countries.length === 0 ? (
          <div className="cref-empty" data-testid="country-empty">
            <h3>No destinations match these filters</h3>
            <p>Try a different region, or clear the filters to see every published destination.</p>
            <Link className="btn btn-primary" href="/countries#regions">
              Clear all
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
            <button
              type="button"
              className={`wide${letter === 'all' ? ' on' : ''}`}
              aria-pressed={letter === 'all'}
              onClick={() => setLetter('all')}
            >
              All
            </button>
            {LETTERS.map((value) =>
              activeLetters.has(value) ? (
                <button
                  type="button"
                  key={value}
                  className={letter === value ? 'on' : undefined}
                  aria-pressed={letter === value}
                  onClick={() => setLetter(value)}
                >
                  {value}
                </button>
              ) : (
                <span key={value} aria-hidden="true">
                  {value}
                </span>
              ),
            )}
          </div>

          <div className="az-grid">
            {azList.map((record) => {
              const counts = [
                ['UG', record.programCounts.ug],
                ['PG', record.programCounts.pg],
                ['PGDM', record.programCounts.pgdm],
                ['MBA', record.programCounts.mba],
              ].filter(([, value]) => value) as Array<[string, number]>;
              return (
                <article className="az-tile" key={record.slug}>
                  <div className="t">
                    <span className="flag" style={{ width: 34, height: 34, fontSize: 13 }} aria-hidden="true">
                      {record.flag?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={record.flag.url} alt="" />
                      ) : (
                        initials(record.name)
                      )}
                    </span>
                    <h3>Study in {record.name}</h3>
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
