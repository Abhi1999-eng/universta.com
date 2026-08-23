'use client';
/* API-selected media can come from approved external asset hosts; use a plain image to avoid an unbounded Next image allowlist. */
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Country, DirectoryRecord, PaginationMeta } from '@/lib/countries';

type Continent = { id: string; name: string; slug: string; status: string };
type FilterKey = 'budgetBand' | 'ieltsOptional' | 'intake' | 'visaSuccessBand' | 'pathwayStrength' | 'hasTopRankedUniversities';
const filterLabels: Record<FilterKey, string> = {
  budgetBand: 'Budget',
  ieltsOptional: 'IELTS optional',
  intake: 'Intake',
  visaSuccessBand: 'Visa success',
  pathwayStrength: 'Pathway strength',
  hasTopRankedUniversities: 'Top-ranked universities',
};
const filterOptions: Record<FilterKey, Array<{ value: string; label: string }>> = {
  budgetBand: [
    { value: 'BUDGET_FRIENDLY', label: 'Budget friendly' },
    { value: 'MID_RANGE', label: 'Mid range' },
    { value: 'PREMIUM', label: 'Premium' },
  ],
  ieltsOptional: [{ value: 'true', label: 'IELTS optional or waived' }],
  intake: [
    { value: 'fall', label: 'Fall intake' },
    { value: 'spring', label: 'Spring intake' },
    { value: 'winter', label: 'Winter intake' },
  ],
  visaSuccessBand: [
    { value: 'HIGH', label: 'High visa success' },
    { value: 'MEDIUM', label: 'Medium visa success' },
    { value: 'LOW', label: 'Low visa success' },
  ],
  pathwayStrength: [
    { value: 'STRONG', label: 'Strong pathway' },
    { value: 'MODERATE', label: 'Moderate pathway' },
    { value: 'LIMITED', label: 'Limited pathway' },
  ],
  hasTopRankedUniversities: [{ value: 'true', label: 'Has top-ranked universities' }],
};

type Props = {
  countries: Country[];
  meta: PaginationMeta;
  continents: Continent[];
  directory: DirectoryRecord[];
  directoryMeta: PaginationMeta;
  filters: Record<string, string | undefined>;
};
function queryFrom(params: URLSearchParams): Record<string, string> {
  return Object.fromEntries(params.entries());
}

export function CountriesExplorer({ countries, meta, continents, directory, directoryMeta, filters: initialFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialFilters.q ?? '');
  const [suggestions, setSuggestions] = useState<Country[]>([]);
  const [suggestionState, setSuggestionState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const lastCommittedQuery = useRef(initialFilters.q ?? '');
  const filters = useMemo(() => queryFrom(searchParams), [searchParams]);
  const submitted = filters.q ?? '';
  const region = filters.region ?? 'all';
  const activeFilterCount = Object.keys(filters).filter((key) => key !== 'q' && key !== 'region' && key !== 'page').length;

  useEffect(() => {
    if (submitted === lastCommittedQuery.current) return undefined;
    lastCommittedQuery.current = submitted;
    const timer = window.setTimeout(() => setQuery(submitted), 0);
    return () => window.clearTimeout(timer);
  }, [submitted]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setSuggestionState('idle');
        setOpen(false);
        return;
      }
      setSuggestionState('loading');
      void fetch(`/api/countries/suggestions?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error('Suggestions unavailable');
          return response.json() as Promise<{ data?: Country[] }>;
        })
        .then((body) => {
          setSuggestions(body.data ?? []);
          setActiveSuggestion(0);
          setSuggestionState('ready');
          setOpen(true);
        })
        .catch((error: unknown) => {
          if ((error as { name?: string }).name !== 'AbortError') {
            setSuggestions([]);
            setSuggestionState('error');
            setOpen(true);
          }
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => {
    const syncFilterForm = () => {
      const form = document.getElementById('country-filter-form');
      if (!(form instanceof HTMLFormElement)) return;
      const current = new URL(window.location.href).searchParams;
      for (const key of Object.keys(filterOptions)) {
        const field = form.elements.namedItem(key);
        if (field instanceof HTMLSelectElement) field.value = current.get(key) ?? '';
      }
    };
    syncFilterForm();
    window.addEventListener('pageshow', syncFilterForm);
    return () => window.removeEventListener('pageshow', syncFilterForm);
  }, [searchParams]);

  function navigate(next: Record<string, string | undefined>, scroll = false) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [...params.keys()]) if (key !== 'q' && key !== 'region' && key !== 'budgetBand' && key !== 'ieltsOptional' && key !== 'intake' && key !== 'visaSuccessBand' && key !== 'pathwayStrength' && key !== 'hasTopRankedUniversities' && key !== 'page') params.delete(key);
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}${params.toString() ? `?${params}` : ''}`, {
      scroll,
    });
  }
  function commitSearch(value: string) {
    const next = value.trim();
    setQuery(next);
    setOpen(false);
    navigate({ q: next || undefined, page: undefined });
  }
  function choose(item: Country) {
    setQuery(item.name);
    setOpen(false);
    navigate({ q: item.name, page: undefined });
  }
  function chooseRegion(next: string) {
    navigate({ region: next === 'all' ? undefined : next, page: undefined });
  }
  function clearAll() {
    setQuery('');
    setOpen(false);
    router.push(pathname, { scroll: false });
  }
  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && suggestions[activeSuggestion]) choose(suggestions[activeSuggestion]);
      else commitSearch(query);
      return;
    }
    if (!open || !suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((value) => (value + 1) % suggestions.length);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((value) => (value - 1 + suggestions.length) % suggestions.length);
    }
  }

  const letters = useMemo(() => {
    const available = new Map<string, DirectoryRecord[]>();
    for (const item of directory) available.set(item.letter, [...(available.get(item.letter) ?? []), item]);
    return available;
  }, [directory]);
  return (
    <>
      <section className="country-search-band" aria-labelledby="country-search-heading">
        <div className="shell">
          <div className="search-intro">
            <div>
              <p className="eyebrow">Find your destination</p>
              <h2 id="country-search-heading">Explore study destinations</h2>
            </div>
            <div className="platform-metrics" aria-label="Destination platform metrics">
              <Metric value={meta.total} label="destinations" />
              <Metric value={continents.length} label="regions" />
              <Metric value={countries.filter((country) => country.featured).length} label="featured" />
            </div>
          </div>
          <div className="search-row" ref={searchRef}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                commitSearch(query);
              }}
              className="search-form"
            >
              <label htmlFor="country-search">Search by country</label>
              <div className="search-control">
                <input id="country-search" name="q" role="combobox" aria-expanded={open} aria-controls="country-suggestions" aria-activedescendant={open && suggestions[activeSuggestion] ? `suggestion-${suggestions[activeSuggestion].id}` : undefined} aria-autocomplete="list" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={keyDown} placeholder="Try Canada, France, or Australia" />
                <button type="submit">Search</button>
              </div>
              {open ? <SuggestionState state={suggestionState} suggestions={suggestions} active={activeSuggestion} onHover={setActiveSuggestion} onChoose={choose} /> : null}
            </form>
            <div className="quick-filters" aria-label="Quick filters">
              <button type="button" className={region === 'all' ? 'chip active' : 'chip'} onClick={() => chooseRegion('all')}>
                All destinations
              </button>
              {continents.map((continent) => (
                <button type="button" className={region === continent.slug ? 'chip active' : 'chip'} key={continent.id} onClick={() => chooseRegion(continent.slug)}>
                  {continent.name}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="filter-toggle" aria-expanded={drawerOpen} aria-controls="country-filter-panel" onClick={() => setDrawerOpen((value) => !value)}>
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
          <form key={searchParams.toString()} id="country-filter-form" method="get" action="/countries">
            <input type="hidden" name="q" value={filters.q ?? ''} />
            <input type="hidden" name="region" value={filters.region ?? ''} />
            <div id="country-filter-panel" className={drawerOpen ? 'filter-panel is-open' : 'filter-panel'} aria-label="Destination filters">
              <div className="filter-panel-heading">
                <h3>Filter published results</h3>
                <button type="button" className="text-link" onClick={clearAll}>
                  Clear all
                </button>
              </div>
              <div className="filter-grid">
                {(Object.keys(filterOptions) as FilterKey[]).map((key) => (
                  <label key={key} className="filter-field">
                    {filterLabels[key]}
                    <select name={key} defaultValue={filters[key] ?? ''}>
                      <option value="">Any</option>
                      {filterOptions[key].map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button type="submit" className="button secondary filter-submit">
                Apply filters
              </button>
            </div>
          </form>
        </div>
      </section>
      <section id="country-results" className="shell results-section" aria-labelledby="country-results-heading">
        <div className="section-kicker">
          <p className="eyebrow">Browse by region</p>
          <span className="result-count" role="status" aria-live="polite">
            {meta.total} {meta.total === 1 ? 'destination' : 'destinations'}
            {meta.totalPages > 1 ? ` · page ${meta.page} of ${meta.totalPages}` : ''}
          </span>
        </div>
        <div className="results-heading">
          <div>
            <h2 id="country-results-heading">{region === 'all' ? 'All destinations' : (continents.find((item) => item.slug === region)?.name ?? 'Destinations')}</h2>
            <p className="section-lede">Start with a country, then explore the verified profiles and editorial guidance available for that destination.</p>
          </div>
        </div>
        {countries.length ? (
          <div className="country-grid">
            {countries.map((country) => (
              <CountryCard key={country.id} country={country} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No destinations found</h3>
            <p>Try another country or clear the active filters.</p>
            <button type="button" className="button secondary" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}
        {meta.totalPages > 1 ? <Pagination meta={meta} onPage={(page) => navigate({ page: String(page) })} /> : null}
      </section>
      <section className="soft-band listing-cta">
        <div className="shell split-band">
          <div>
            <p className="eyebrow">Need a starting point?</p>
            <h2>Turn a destination into a plan.</h2>
            <p className="section-lede">Use the country guide to compare what is actually published, then talk to a counsellor when you are ready.</p>
          </div>
          <Link className="button" href="#consultation">
            Explore guidance
          </Link>
        </div>
      </section>
      <section className="shell directory-section" aria-labelledby="directory-heading">
        <div className="section-kicker">
          <p className="eyebrow">Dedicated directory</p>
          <span className="result-count">{directoryMeta.total} listed</span>
        </div>
        <h2 id="directory-heading">Find a country by name</h2>
        <p className="section-lede">The alphabetical directory is independent from search and result filters.</p>
        <div className="directory-letters" aria-label="Available country initials">
          {Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)).map((letter) => {
            const items = letters.get(letter) ?? [];
            return items.length ? (
              <a className="directory-letter" href={`#directory-letter-${letter}`} aria-label={`${letter}, ${items.length} available`} key={letter}>
                {letter}
              </a>
            ) : (
              <button type="button" className="directory-letter" disabled aria-label={`${letter}, unavailable`} key={letter}>
                {letter}
              </button>
            );
          })}
        </div>
        <div className="directory-grid">
          {Array.from(letters.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([letter, items]) => (
              <div className="directory-group" id={`directory-letter-${letter}`} key={letter}>
                <h3>{letter}</h3>
                {items.map((country) => (
                  <Link key={country.slug} href={`/countries/${country.slug}`}>
                    {country.name}
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            ))}
        </div>
      </section>
      <section id="consultation" className="consultation-band">
        <div className="shell consultation-inner">
          <div>
            <p className="eyebrow">Ready for a conversation?</p>
            <h2>Get guidance for your shortlist.</h2>
            <p>Country pages keep the next step clear and grounded in available information.</p>
          </div>
          <Link className="button light" href="#country-results">
            Review destinations
          </Link>
        </div>
      </section>
    </>
  );
}
function SuggestionState({ state, suggestions, active, onHover, onChoose }: { state: 'idle' | 'loading' | 'ready' | 'error'; suggestions: Country[]; active: number; onHover: (index: number) => void; onChoose: (country: Country) => void }) {
  if (state === 'loading')
    return (
      <div className="suggestion-status" role="status">
        Loading suggestions…
      </div>
    );
  if (state === 'error')
    return (
      <div className="suggestion-status" role="alert">
        Suggestions are temporarily unavailable.
      </div>
    );
  if (state === 'ready' && !suggestions.length)
    return (
      <div className="suggestion-status" role="status">
        No destinations found.
      </div>
    );
  return (
    <ul id="country-suggestions" role="listbox" className="suggestions">
      {suggestions.map((item, index) => (
        <li key={item.id} id={`suggestion-${item.id}`} role="option" aria-selected={index === active}>
          <button type="button" onMouseEnter={() => onHover(index)} onClick={() => onChoose(item)}>
            {item.name}
            <span>{item.continent.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
function Pagination({ meta, onPage }: { meta: PaginationMeta; onPage: (page: number) => void }) {
  return (
    <nav className="pagination" aria-label="Country results pages">
      <button type="button" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        Previous
      </button>
      <span>
        Page {meta.page} of {meta.totalPages}
      </span>
      <button type="button" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
        Next
      </button>
    </nav>
  );
}
function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
function CountryCard({ country }: { country: Country }) {
  return (
    <article className="country-card">
      <div className="card-top">
        <span className="country-flag">{country.flag ? <img src={country.flag.url} alt={country.flag.alt || `${country.name} flag`} /> : <span aria-hidden="true">◎</span>}</span>
        <span className="country-region">{country.continent.name}</span>
      </div>
      <h3>{country.name}</h3>
      <p>{country.shortDescription}</p>
      <div className="card-facts">
        {country.configuration?.features.slice(0, 2).map((feature) => (
          <span key={feature.code}>{feature.label}</span>
        ))}
        {country.configuration?.intakeMonths.length ? <span>{country.configuration.intakeMonths.length} intake months</span> : null}
      </div>
      <Link className="card-link" href={`/countries/${country.slug}`}>
        View country <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
