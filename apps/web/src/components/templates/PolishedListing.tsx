'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { counsellingHref } from '@/lib/counselling-link';

/** Shared presentation for the three listing pages that were still on the
 * plain template (Universities, Scholarships, Consultants).
 *
 * It renders the same structure the rest of the site already uses -- the
 * `visual-courses-page` scope owns the filter sidebar, mobile filter drawer,
 * results bar, result cards and pagination -- so these pages inherit the
 * established design language instead of introducing a fourth one.
 *
 * Filters are declarative: each page passes the groups its own API genuinely
 * supports. Nothing here invents a filter the backend cannot honour, and no
 * card renders a rating, ranking or outcome claim -- only stored values. */

export type FilterOption = { value: string; label: string };
export type FilterGroup =
  | { key: string; label: string; kind: 'select'; options: FilterOption[] }
  | { key: string; label: string; kind: 'text'; placeholder?: string }
  | { key: string; label: string; kind: 'number'; placeholder?: string }
  | { key: string; label: string; kind: 'toggle'; onValue: string };

export type ListingMeta = { page: number; limit: number; total: number; totalPages: number };

export function PolishedListing({
  eyebrow,
  heading,
  headingAccent,
  lede,
  crumbLabel,
  basePath,
  noun,
  searchLabel,
  searchPlaceholder,
  filterGroups,
  sortOptions,
  filters,
  meta,
  children,
  emptyTitle,
  emptyBody,
  ctaHeading,
  ctaBody,
  railHeading,
  railBody,
  counsellingSource,
}: {
  eyebrow: string;
  heading: string;
  headingAccent: string;
  lede: string;
  crumbLabel: string;
  basePath: string;
  noun: { one: string; many: string };
  searchLabel: string;
  searchPlaceholder: string;
  filterGroups: FilterGroup[];
  sortOptions: FilterOption[];
  filters: Record<string, string>;
  meta: ListingMeta;
  children: ReactNode;
  emptyTitle: string;
  emptyBody: string;
  ctaHeading: string;
  ctaBody: string;
  railHeading: string;
  railBody: string;
  counsellingSource: 'general';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  /** Every control writes through the URL, so filter state survives refresh,
   * Back/Forward and sharing without a second client-side store. */
  const navigate = (next: Record<string, string | undefined>, replace = false) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };

  const activeFilterCount = useMemo(
    () => filterGroups.filter((group) => filters[group.key]).length,
    [filterGroups, filters],
  );

  const applyFromForm = (form: FormData) => {
    const next: Record<string, string | undefined> = { page: undefined };
    for (const group of filterGroups) {
      const raw = form.get(group.key);
      next[group.key] = typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
    }
    navigate(next);
    setDrawerOpen(false);
  };

  const clearAll = () => {
    const cleared: Record<string, string | undefined> = { page: undefined, q: undefined };
    for (const group of filterGroups) cleared[group.key] = undefined;
    navigate(cleared);
    setDrawerOpen(false);
  };

  const hasResults = meta.total > 0;
  const filterFormKey = filterGroups.map((group) => `${group.key}=${filters[group.key] ?? ''}`).join('&');

  return (
    <main className="visual-courses-page usta-listing">
      <div className="wrap crumbs">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><Link href="/">Home</Link></li>
            <li className="sep">/</li>
            <li aria-current="page">{crumbLabel}</li>
          </ol>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap hero-inner">
          <span className="hero-pill">
            <b>{meta.total}</b> published {meta.total === 1 ? noun.one : noun.many}
          </span>
          <h1>
            {heading} <span>{headingAccent}</span>
          </h1>
          <p className="lede">{lede}</p>
          <form
            className="search-shell"
            role="search"
            key={`q=${filters.q ?? ''}`}
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get('q');
              navigate({ q: typeof value === 'string' && value.trim() ? value.trim() : undefined, page: undefined });
            }}
          >
            <div className="search-box">
              <label className="sr-only" htmlFor="listing-search">{searchLabel}</label>
              <input
                id="listing-search"
                name="q"
                defaultValue={filters.q ?? ''}
                placeholder={searchPlaceholder}
                aria-label={searchLabel}
              />
              <button className="btn btn-primary" type="submit">Search</button>
            </div>
          </form>
        </div>
      </section>

      <div className="wrap">
        <div className="section-head row-between">
          <div>
            <span className="eyebrow">Discover → Filter</span>
            <h2>Refine your results</h2>
            <p className="sub">Combine filters and sorting across the published catalog.</p>
          </div>
          <button
            type="button"
            className="btn btn-outline filter-toggle-mobile"
            aria-expanded={drawerOpen}
            aria-controls="listing-filter-panel"
            onClick={() => setDrawerOpen((current) => !current)}
          >
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        <button
          type="button"
          className={`scrim${drawerOpen ? ' show' : ''}`}
          aria-label="Close filters"
          tabIndex={drawerOpen ? 0 : -1}
          onClick={() => setDrawerOpen(false)}
        />

        <div className="discovery">
          <aside
            className={`filters${drawerOpen ? ' open' : ''}`}
            id="listing-filter-panel"
            aria-label={`${crumbLabel} filters`}
          >
            <div className="filters-head">
              <h3>Filters</h3>
              <span className="course-filter-head-actions">
                <button type="button" className="clear" onClick={clearAll}>Clear all</button>
                <button
                  type="button"
                  className="course-filter-close"
                  aria-label="Close filters"
                  onClick={() => setDrawerOpen(false)}
                >
                  ✕
                </button>
              </span>
            </div>
            <div className="filters-body">
              {/* Keyed on the applied filter values so browser Back/Forward
                  remounts the uncontrolled inputs. Without this the fields keep
                  the previously typed/selected values while the results below
                  reflect the restored URL -- the two would disagree. */}
              <form
                key={filterFormKey}
                onSubmit={(event) => {
                  event.preventDefault();
                  applyFromForm(new FormData(event.currentTarget));
                }}
              >
                {filterGroups.map((group) => (
                  <div className="fgroup open" key={group.key}>
                    <div className="fgroup-btn">{group.label}</div>
                    <div className="fgroup-body">
                      {group.kind === 'select' ? (
                        <label className="sr-only" htmlFor={`filter-${group.key}`}>{group.label}</label>
                      ) : null}
                      {group.kind === 'select' ? (
                        <select
                          id={`filter-${group.key}`}
                          name={group.key}
                          defaultValue={filters[group.key] ?? ''}
                          aria-label={group.label}
                        >
                          <option value="">Any {group.label.toLowerCase()}</option>
                          {group.options.map((option) => (
                            <option value={option.value} key={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : null}
                      {group.kind === 'text' || group.kind === 'number' ? (
                        <>
                          <label className="sr-only" htmlFor={`filter-${group.key}`}>{group.label}</label>
                          <input
                            id={`filter-${group.key}`}
                            name={group.key}
                            type={group.kind === 'number' ? 'number' : 'text'}
                            inputMode={group.kind === 'number' ? 'numeric' : undefined}
                            defaultValue={filters[group.key] ?? ''}
                            placeholder={group.placeholder}
                            aria-label={group.label}
                          />
                        </>
                      ) : null}
                      {group.kind === 'toggle' ? (
                        <label className="fcheck">
                          <input
                            type="checkbox"
                            name={group.key}
                            value={group.onValue}
                            defaultChecked={filters[group.key] === group.onValue}
                          />
                          {group.label}
                        </label>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div className="filters-foot">
                  <button className="btn btn-primary btn-sm" type="submit">Apply filters</button>
                </div>
              </form>
            </div>
          </aside>

          <div>
            <div className="results-bar">
              <div className="results-count" role="status">
                <b>{meta.total}</b> {meta.total === 1 ? noun.one : noun.many}{' '}
                {meta.total === 1 ? 'matches' : 'match'} your search
                {meta.totalPages > 1 ? ` · page ${meta.page} of ${meta.totalPages}` : ''}
              </div>
              <div className="sort-wrap">
                <label htmlFor="listing-sort">Sort by</label>
                <span className="select">
                  <select
                    id="listing-sort"
                    aria-label={`Sort ${noun.many}`}
                    value={filters.sort ?? 'featured'}
                    onChange={(event) =>
                      navigate({
                        sort: event.target.value === 'featured' ? undefined : event.target.value,
                        page: undefined,
                      })
                    }
                  >
                    {sortOptions.map((option) => (
                      <option value={option.value} key={option.value}>{option.label}</option>
                    ))}
                  </select>
                </span>
              </div>
            </div>

            <div className="course-list">
              {hasResults ? (
                children
              ) : (
                <div className="template-empty course-zero-state">
                  <h3>{emptyTitle}</h3>
                  <p>{emptyBody}</p>
                  <button type="button" className="btn btn-outline btn-sm" onClick={clearAll}>
                    Clear all filters
                  </button>
                </div>
              )}
            </div>

            {meta.totalPages > 1 || meta.page > 1 ? (
              <nav className="template-pagination" aria-label={`${crumbLabel} results pagination`}>
                <button
                  type="button"
                  aria-label="Previous results page"
                  disabled={meta.page <= 1}
                  onClick={() => navigate({ page: String(meta.page - 1) }, true)}
                >
                  Previous
                </button>
                <span aria-current="page">Page {meta.page} of {Math.max(meta.totalPages, 1)}</span>
                <button
                  type="button"
                  aria-label="Next results page"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => navigate({ page: String(meta.page + 1) }, true)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </div>

          <aside className="side" aria-label="Counselling help">
            <div className="side-card">
              <span className="eyebrow">Need a hand?</span>
              <h3>{railHeading}</h3>
              <p>{railBody}</p>
              <Link
                className="btn btn-primary btn-block"
                href={counsellingHref({ source: counsellingSource, from: basePath })}
              >
                Book free counselling
              </Link>
            </div>
          </aside>
        </div>
      </div>

      <section className="section wrap">
        <div className="final-cta">
          <h2>{ctaHeading}</h2>
          <p>{ctaBody}</p>
          <div className="cta-row">
            <Link href="/countries" className="btn btn-secondary">Explore destinations</Link>
            <Link
              href={counsellingHref({ source: counsellingSource, from: basePath })}
              className="btn btn-outline"
            >
              Get study guidance
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
