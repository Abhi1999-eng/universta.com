'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { DestinationDirectory, Destination } from '@/lib/study-abroad';
import { destinationCounts as countsLine } from '@/lib/study-abroad-view';
import { FlagMark } from './FlagMark';

/**
 * The destination directory: search, region, guide and "has" filters, grouped
 * by region.
 *
 * Filtering is local because the whole list is already on the page -- it is 206
 * names, not a catalogue query, and a round trip per keystroke would be slower
 * and worse offline. The counts always describe the filtered set, so the group
 * headings and the total agree with what is on screen.
 *
 * This is the merge of the two listings the approved design shipped separately:
 * the exhaustive directory (every destination, guide or not) and the data-rich
 * countries listing (what each destination has linked to it). One page does
 * both jobs, so a student never has to know which of the two to open.
 */

type StatusFilter = 'all' | 'published' | 'popular';
type HasFilter = 'any' | 'guide' | 'universities' | 'scholarships' | 'consultants';

/** Whether a destination satisfies the "has" filter. */
function satisfiesHas(entry: Destination, has: HasFilter): boolean {
  switch (has) {
    case 'any':
      return true;
    case 'guide':
      return entry.isAvailable;
    case 'universities':
      return entry.counts.universities > 0;
    case 'scholarships':
      return entry.counts.scholarships > 0;
    case 'consultants':
      return entry.counts.consultants > 0;
  }
}

export function DirectoryView({
  directory,
  alt = true,
  asPage = false,
  initialQuery = '',
}: {
  directory: DestinationDirectory;
  alt?: boolean;
  /** As the destinations page itself: a breadcrumb and the page's heading. */
  asPage?: boolean;
  /** A search carried in the address, as `/study-abroad?q=Canada`. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [region, setRegion] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [has, setHas] = useState<HasFilter>('any');

  const everything = useMemo<Destination[]>(
    () => [...directory.available, ...directory.comingSoon],
    [directory],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return everything.filter((entry) => {
      if (needle && !entry.name.toLowerCase().includes(needle)) return false;
      if (region !== 'all' && entry.region !== region) return false;
      if (status === 'published' && !entry.isAvailable) return false;
      if (status === 'popular' && !entry.isPopular) return false;
      if (!satisfiesHas(entry, has)) return false;
      return true;
    });
  }, [everything, query, region, status, has]);

  /* Grouped in the order the design lists the regions, so the page reads the
   * same way every time rather than by whatever the data happened to contain. */
  const groups = useMemo(() => {
    const byRegion = new Map<string, Destination[]>();
    for (const entry of matches) {
      const key = entry.region ?? 'Other';
      const bucket = byRegion.get(key);
      if (bucket) bucket.push(entry);
      else byRegion.set(key, [entry]);
    }
    const ordered: Array<{ region: string; entries: Destination[] }> = [];
    for (const name of directory.regions) {
      const entries = byRegion.get(name);
      if (entries?.length) ordered.push({ region: name, entries });
      byRegion.delete(name);
    }
    for (const [name, entries] of byRegion)
      if (entries.length) ordered.push({ region: name, entries });
    return ordered;
  }, [matches, directory.regions]);

  const regionFilters = ['all', ...directory.regions];
  const statusFilters: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'popular', label: 'Popular' },
  ];
  const hasFilters: Array<{ value: HasFilter; label: string }> = [
    { value: 'any', label: 'Anything' },
    { value: 'guide', label: 'Country guide' },
    { value: 'universities', label: 'Universities' },
    { value: 'scholarships', label: 'Scholarships' },
    { value: 'consultants', label: 'Consultants' },
  ];

  return (
    /* `sec--tight h-sec`, like every funnel section around it: the listing
       used to sit on a 64px rhythm between neighbours on 44px, so the page
       breathed unevenly exactly where its main content began. */
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-sec`} id="directory">
      <div className="wrap">
        {asPage ? (
          <nav className="crumbs dir__crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Destinations</span>
          </nav>
        ) : null}
        <div className="h-head">
          <p className="eyebrow eyebrow--plain">
            Destinations<b>·</b>
            {directory.counts.total} countries
          </p>
          {asPage ? (
            <h1 className="sec-title">Every study destination</h1>
          ) : (
            <h2 className="sec-title">Where do you want to study?</h2>
          )}
          <p className="sec-lead">
            Browse every destination we cover. Published guides carry full costs, intakes,
            entry requirements and visa pathways.
          </p>
        </div>

        <div className="dir__search">
          <input
            className="dir__input"
            type="search"
            placeholder="Search a country"
            aria-label="Search countries"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="directory-search"
          />
          <span className="dir__count" data-testid="directory-count">
            {matches.length} {matches.length === 1 ? 'country' : 'countries'}
          </span>
        </div>

        <div className="filters">
          <div className="filters__group" data-filter-group="region">
            <span className="filters__label">Region</span>
            {regionFilters.map((value) => (
              <button
                className="chipbtn"
                type="button"
                key={value}
                aria-pressed={region === value}
                onClick={() => setRegion(value)}
              >
                {value === 'all' ? 'All' : value}
              </button>
            ))}
          </div>
          <div className="filters__group" data-filter-group="status">
            <span className="filters__label">Guide</span>
            {statusFilters.map((filter) => (
              <button
                className="chipbtn"
                type="button"
                key={filter.value}
                aria-pressed={status === filter.value}
                onClick={() => setStatus(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="filters__group" data-filter-group="has">
            <span className="filters__label">Has</span>
            {hasFilters.map((filter) => (
              <button
                className="chipbtn"
                type="button"
                key={filter.value}
                aria-pressed={has === filter.value}
                onClick={() => setHas(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="dir__empty" data-testid="directory-empty">
            No destination matches that search. Try a different name, or clear the filters.
          </p>
        ) : (
          <div data-testid="directory-groups">
            {groups.map((group) => (
              <div className="dir__group" data-group={group.region} key={group.region}>
                <div className="dir__grouphead">
                  <h2 className="dir__groupname">{group.region}</h2>
                  <span className="dir__groupn">
                    {group.entries.length}{' '}
                    {group.entries.length === 1 ? 'country' : 'countries'}
                  </span>
                </div>
                <div className="dir__grid">
                  {group.entries.map((entry) =>
                    entry.slug ? (
                      <Link
                        className="dir__card"
                        key={entry.name}
                        href={`/study-abroad/${entry.slug}`}
                        data-country
                        data-status={entry.isPopular ? 'popular' : 'published'}
                      >
                        <FlagMark
                          name={entry.name}
                          iso2Code={entry.iso2Code}
                          bands={entry.bands}
                        />
                        <span className="cchip__name" title={entry.name}>
                          {entry.name}
                        </span>
                        <span className="dir__meta">Guide</span>
                        {countsLine(entry) ? (
                          <span className="h-card__m" data-testid="destination-counts">
                            {countsLine(entry)}
                          </span>
                        ) : null}
                      </Link>
                    ) : (
                      /* No guide yet, so nothing to navigate to. A link here
                         would be a link to nowhere. */
                      <span
                        className="dir__card dir__card--soon"
                        key={entry.name}
                        data-country
                        data-status="soon"
                      >
                        <FlagMark
                          name={entry.name}
                          iso2Code={entry.iso2Code}
                          bands={entry.bands}
                        />
                        <span className="cchip__name" title={entry.name}>
                          {entry.name}
                        </span>
                        <span className="dir__meta">Soon</span>
                      </span>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
