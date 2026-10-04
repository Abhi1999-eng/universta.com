import Link from 'next/link';

/**
 * The strip under a destination's hero: the four ways into it.
 *
 * A destination is not one page. It is the guide, the fields taught there,
 * the institutions teaching them and the money on offer -- and until this
 * strip existed each of those lived at a URL a reader had to already know
 * about. The guide linked down into its own sections and nowhere across.
 *
 * A tab with nothing behind it is left out rather than shown at zero. The
 * count is the point of the tab: "Universities 100" is an invitation, and
 * "Universities 0" is a dead end dressed as one. Overview always stays,
 * because the guide is what the destination is.
 */

export type CountryTabKey =
  | 'overview'
  | 'subjects'
  | 'universities'
  | 'scholarships';

export type CountryTab = {
  key: CountryTabKey;
  href: string;
  label: string;
  /** Null on Overview, which is a page rather than a collection. */
  count: number | null;
};

export type CountryTabCounts = {
  subjects: number;
  universities: number;
  scholarships: number;
};

export function countryTabs(
  countrySlug: string,
  counts: CountryTabCounts,
): CountryTab[] {
  const base = `/study-abroad/${countrySlug}`;
  return [
    { key: 'overview', href: base, label: 'Overview', count: null },
    {
      key: 'subjects',
      href: `${base}/subjects`,
      label: 'Subjects',
      count: counts.subjects,
    },
    {
      key: 'universities',
      href: `${base}/universities`,
      label: 'Universities',
      count: counts.universities,
    },
    {
      /* The only one that leaves the destination's own path. Funding is
         listed once, for every destination, and a second copy of that
         listing filtered to one country would be the same records under a
         different URL. */
      key: 'scholarships',
      href: `/scholarships?country=${countrySlug}`,
      label: 'Scholarships',
      count: counts.scholarships,
    },
  ].filter((tab) => tab.count === null || tab.count > 0) as CountryTab[];
}

export function CountryTabs({
  tabs,
  current,
  below = false,
}: {
  tabs: CountryTab[];
  /** The tab the reader is on, or none when a page sits below one of them. */
  current?: CountryTabKey;
  /**
   * The page being read sits under `current` rather than being it: a
   * subject's page under Subjects. The tab is still the one to mark, but it
   * is a link to somewhere else, and "current page" on a link that leaves
   * the page is a thing a screen reader would say and be wrong.
   */
  below?: boolean;
}) {
  /* One tab is the Overview on its own, which is not a choice. */
  if (tabs.length < 2) return null;
  return (
    <nav className="unitabs" aria-label="Destination sections">
      <div className="wrap unitabs__inner">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={
              tab.key === current ? (below ? 'true' : 'page') : undefined
            }
          >
            {tab.label}
            {/* A real space: the gap was a margin, so a screen reader and a
                search engine both read "Subjects30". */}
            {tab.count === null ? null : (
              <>
                {' '}
                <em>{tab.count.toLocaleString('en-GB')}</em>
              </>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
