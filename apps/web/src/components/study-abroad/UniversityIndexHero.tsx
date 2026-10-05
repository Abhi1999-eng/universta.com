import Link from 'next/link';
import { FlagMark } from './FlagMark';
import { UniversitySearch } from './UniversitySearch';
import { countryUniversitiesHref } from '@/lib/university-links';

export type DirectoryDestination = {
  slug: string;
  name: string;
  iso2Code: string | null;
  count: number;
};

/**
 * The directory's opening band: what this page is, a search that commits to
 * the URL, and the destinations that actually hold institutions.
 *
 * The approved build offers example searches from a list an editor keeps.
 * There is no such list here, so the row beneath the box is the destinations
 * the catalogue has, with their counts -- the same job, built from data
 * rather than from a copy deck nobody has written yet.
 *
 * Each destination opens that country's own university list, which is what
 * its count is a count of. It used to open the country guide, so the number
 * on the chip promised a list the click did not deliver.
 */
export function UniversityIndexHero({
  total,
  destinations,
}: {
  total: number;
  destinations: DirectoryDestination[];
}) {
  return (
    <section className="hero hero--compact">
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="crumbs__sep" aria-hidden="true">
            /
          </span>
          <span aria-current="page">Universities</span>
        </nav>

        <div className="hero__lead">
          <p className="hero__eyebrow">
            University discovery<b>·</b>
            {total} published
          </p>
          <h1 className="hero__h1">Find the universities worth applying to</h1>
          <p className="hero__sub">
            Every institution here is a published record in the Universta
            catalogue. There is no paid placement and no ranking of our own:
            narrow by destination and type, then open one to see the
            programmes it actually offers.
          </p>
        </div>

        <UniversitySearch
          placeholder="Search universities, cities or destinations"
          label="Search universities, cities or destinations"
        />

        {destinations.length ? (
          <div className="destrow">
            <span className="label">Destinations with institutions</span>
            <div className="destrow__items">
              {destinations.map((entry) => (
                <Link
                  className="destchip"
                  key={entry.slug}
                  href={countryUniversitiesHref(entry.slug)}
                >
                  <FlagMark iso2Code={entry.iso2Code} bands={null} />
                  <span>{entry.name}</span>
                  <em>{entry.count}</em>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
