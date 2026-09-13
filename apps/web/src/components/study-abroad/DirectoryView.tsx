'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { DestinationDirectory, Destination } from '@/lib/study-abroad';
import { FlagMark } from './FlagMark';

/**
 * The destination directory: search, region and guide filters, grouped by
 * region.
 *
 * Filtering is local because the whole list is already on the page -- it is 206
 * names, not a catalogue query, and a round trip per keystroke would be slower
 * and worse offline. The counts always describe the filtered set, so the group
 * headings and the total agree with what is on screen.
 */

type StatusFilter = 'all' | 'published' | 'popular';

export function DirectoryView({ directory }: { directory: DestinationDirectory }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

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
      return true;
    });
  }, [everything, query, region, status]);

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

  return (
    <section className="sec sec--white" id="directory">
      <div className="wrap">
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
                        <span className="cchip__name">{entry.name}</span>
                        <span className="dir__meta">Guide</span>
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
                        <span className="cchip__name">{entry.name}</span>
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
