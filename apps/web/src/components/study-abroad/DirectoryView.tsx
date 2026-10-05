'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DestinationDirectory, Destination } from '@/lib/study-abroad';
import { destinationCounts as countsLine } from '@/lib/study-abroad-view';
import {
  destinationToOpen,
  matchesDestination,
  popularDestinations,
  regionKey,
} from '@/lib/destination-search';
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
 *
 * It opens, as the behaviour reference's does, on the popular destinations
 * rather than on Albania and Andorra: most readers came for one of a dozen
 * countries, and the alphabetical run by region is where the rest are.
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

function DestinationCard({ entry }: { entry: Destination }) {
  return entry.slug ? (
    <Link
      className="dir__card"
      href={`/study-abroad/${entry.slug}`}
      data-country
      data-status={entry.isPopular ? 'popular' : 'published'}
    >
      <FlagMark iso2Code={entry.iso2Code} bands={entry.bands} />
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
    /* No guide yet, so nothing to navigate to. A link here would be a link
       to nowhere. */
    <span className="dir__card dir__card--soon" data-country data-status="soon">
      <FlagMark iso2Code={entry.iso2Code} bands={entry.bands} />
      <span className="cchip__name" title={entry.name}>
        {entry.name}
      </span>
      <span className="dir__meta">Soon</span>
    </span>
  );
}

export function DirectoryView({
  directory,
  alt = true,
  asPage = false,
  initialQuery = '',
  initialRegion = 'all',
}: {
  directory: DestinationDirectory;
  alt?: boolean;
  /** On the destinations page itself, whose hero already carries the
   *  breadcrumb and the heading, so the listing opens straight on its search. */
  asPage?: boolean;
  /** A search carried in the address, as `/study-abroad?q=Canada`. */
  initialQuery?: string;
  /** A region carried in the address, as `/study-abroad?region=asia`,
   *  already resolved to the name the directory uses. */
  initialRegion?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [region, setRegion] = useState<string>(initialRegion);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [has, setHas] = useState<HasFilter>('any');

  const everything = useMemo<Destination[]>(
    () => [...directory.available, ...directory.comingSoon],
    [directory],
  );
  const popular = useMemo(() => popularDestinations(everything), [everything]);
  /* The row holds a dozen; the Popular chip lists every one marked. */
  const popularTotal = useMemo(
    () => everything.filter((entry) => entry.isPopular && entry.slug).length,
    [everything],
  );

  const matches = useMemo(() => {
    return everything.filter((entry) => {
      if (!matchesDestination(entry, query)) return false;
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

  /* The popular row is a way in, not a result: it stands down the moment
     the reader narrows the list, as the reference's does while a search is
     typed, so it never sits above a region it has nothing to do with. */
  const narrowed =
    query.trim() !== '' || region !== 'all' || status !== 'all' || has !== 'any';

  /** The region chip, written into the address so a shared link or a
   *  refresh comes back to the same region. Replaced, not pushed: a chip is
   *  a view of this page, not a page of its own. */
  const chooseRegion = (value: string) => {
    setRegion(value);
    try {
      const params = new URLSearchParams(window.location.search);
      /* The search as it stands, not as the page opened with it: a cleared
         box kept `?q=france` beside the new region, and the reload opened
         on no countries at all. */
      const typed = query.trim();
      if (typed) params.set('q', typed);
      else params.delete('q');
      if (value === 'all') params.delete('region');
      else params.set('region', regionKey(value));
      const search = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${search ? `?${search}` : ''}`,
      );
    } catch {
      /* The filter still works without the address. */
    }
  };

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
          /* The heading is the hero's; the listing still needs one in the
             outline between the page's h1 and the region names. */
          <h2 className="sr-only">Every study destination</h2>
        ) : (
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">
              Destinations<b>·</b>
              {directory.counts.total} countries
            </p>
            <h2 className="sec-title">Where do you want to study?</h2>
            <p className="sec-lead">
              Browse every destination we cover. Published guides carry full costs, intakes,
              entry requirements and visa pathways.
            </p>
          </div>
        )}

        {/* A form, so Enter does what it does in the reference's box: open
            the destination the search has narrowed to. With several left it
            stays put rather than guessing. */}
        <form
          className="dir__search"
          role="search"
          action="/study-abroad"
          onSubmit={(event) => {
            event.preventDefault();
            const target = destinationToOpen(matches, query);
            if (target?.slug) router.push(`/study-abroad/${target.slug}`);
          }}
        >
          <input
            className="dir__input"
            type="search"
            name="q"
            placeholder="Search a country or code, e.g. UK"
            aria-label="Search countries"
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="directory-search"
          />
          <span className="dir__count" data-testid="directory-count" aria-live="polite">
            {matches.length} {matches.length === 1 ? 'country' : 'countries'}
          </span>
        </form>

        <div className="filters">
          <div className="filters__group" data-filter-group="region">
            <span className="filters__label">Region</span>
            {regionFilters.map((value) => (
              <button
                className="chipbtn"
                type="button"
                key={value}
                aria-pressed={region === value}
                onClick={() => chooseRegion(value)}
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

        {!narrowed && popular.length ? (
          <div className="dir__group dir__group--popular" data-group="popular" data-testid="directory-popular">
            <div className="dir__grouphead">
              <h2 className="dir__groupname">Popular destinations</h2>
              <span className="dir__groupn">
                {popularTotal > popular.length
                  ? `${popular.length} of ${popularTotal} countries`
                  : `${popular.length} ${popular.length === 1 ? 'country' : 'countries'}`}
              </span>
            </div>
            <div className="dir__grid">
              {popular.map((entry) => (
                <DestinationCard entry={entry} key={entry.name} />
              ))}
            </div>
          </div>
        ) : null}

        {groups.length === 0 ? (
          <p className="dir__empty" data-testid="directory-empty">
            No country matched. Try a shorter word, or explore by region.
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
                  {group.entries.map((entry) => (
                    <DestinationCard entry={entry} key={entry.name} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
