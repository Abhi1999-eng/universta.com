import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { richTextToPlainText } from '@/components/phase1/RichText';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { ConnectBand } from '@/components/study-abroad/DiscoveryBands';
import { formatNumber } from '@/lib/format';
import { getCountryCities, getCountryStates } from '@/lib/locations';
import { labelFromSlug } from '@/lib/slug-label';
import { countryUniversitiesHref } from '@/lib/university-links';

/**
 * A destination's cities, in the approved design: the compact hero that
 * names the destination, the published states as chips to narrow by, the
 * cities as the design's cards, and the destination's pages to read next.
 * The address stays `/study-in-<country>/cities`, as the city index links
 * it, and `?state=` still narrows the list.
 */
export const dynamic = 'force-dynamic';

/** Every city of a destination at once: no destination has more. */
const CITIES_SHOWN = 100;

type Props = {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<{ state?: string }>;
};

const plain = (value: string | null) => (value ? richTextToPlainText(value).replace(/\s+/g, ' ').trim() : '');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countrySlug } = await params;
  let name = labelFromSlug(countrySlug);
  try {
    const { meta } = await getCountryCities(countrySlug, { limit: '1' });
    if (meta.country?.name) name = meta.country.name;
  } catch {
    // Keep the slug-derived fallback; a title is not worth failing the page.
  }
  return {
    title: { absolute: `Cities in ${name} | Universta` },
    alternates: { canonical: `/study-in-${countrySlug}/cities` },
  };
}

export default async function CityListingPage({ params, searchParams }: Props) {
  const { countrySlug } = await params;
  const { state } = await searchParams;
  const [result, states] = await Promise.all([
    getCountryCities(countrySlug, { limit: String(CITIES_SHOWN), ...(state ? { state } : {}) }).catch(() => null),
    getCountryStates(countrySlug).catch(() => []),
  ]);
  if (!result) notFound();
  const country = { name: result.meta.country?.name ?? labelFromSlug(countrySlug), slug: countrySlug };
  const cities = result.data;
  const total = result.meta.total;
  const base = `/study-in-${countrySlug}`;
  const current = states.find((entry) => entry.slug === state) ?? null;
  const guide = `/study-abroad/${countrySlug}`;

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Study abroad', href: '/study-abroad' },
              { label: country.name, href: guide },
              { label: 'Cities' },
            ]}
          />
          <div className="hero__lead">
            <p className="hero__eyebrow">
              {current ? current.name : country.name}
              {total ? (
                <>
                  <b>·</b>
                  {formatNumber(total)} {total === 1 ? 'city' : 'cities'}
                </>
              ) : null}
            </p>
            <h1 className="hero__h1">Cities in {country.name}</h1>
            <p className="hero__sub">
              {total
                ? `Every city profile Universta has published for ${country.name}. Open one for what the city is like to study in; the destination guide covers costs, visas and intakes.`
                : `No city profile for ${country.name} is published yet. The destination guide covers the country as a whole in the meantime.`}
            </p>
          </div>
          {states.length > 1 ? (
            <div className="citychips" style={{ marginTop: 22 }}>
              <span className="label">Narrow by state</span>
              <Link className={`specchip${current ? '' : ' specchip--live'}`} href={`${base}/cities`} aria-current={current ? undefined : 'true'}>
                All
              </Link>
              {states.map((entry) => (
                <Link
                  className={`specchip${entry.slug === state ? ' specchip--live' : ''}`}
                  href={`?state=${encodeURIComponent(entry.slug)}`}
                  aria-current={entry.slug === state ? 'true' : undefined}
                  key={entry.slug}
                >
                  {entry.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="sec sec--white sec--tight h-sec" id="cities">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">Published</p>
            <h2 className="sec-title">
              {cities.length ? `${formatNumber(cities.length)} ${cities.length === 1 ? 'city' : 'cities'}${current ? ` in ${current.name}` : ''}` : 'Nothing published here yet'}
            </h2>
          </div>
          {cities.length ? (
            <div className="h-grid">
              {cities.map((city) => (
                <Link className="h-card" href={`${base}/${city.slug}`} key={city.id}>
                  <strong className="h-card__t">{city.name}</strong>
                  <span className="h-card__d">{plain(city.shortDescription) || `Published city profile in ${country.name}.`}</span>
                  <span className="h-card__m">{city.state?.name ?? country.name}</span>
                  <span className="linkcta">
                    View city <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="h-empty h-empty--box">
              <h3>{current ? `No city in ${current.name} is published yet` : 'No city is published here yet'}</h3>
              <p>City profiles appear here as they are published. The destination guide covers the country as a whole.</p>
              <div className="btn-row">
                {current ? (
                  <Link className="btn" href={`${base}/cities`}>
                    All cities in {country.name}
                  </Link>
                ) : null}
                <Link className={current ? 'btn btn--ghost' : 'btn'} href={guide}>
                  Study in {country.name}
                </Link>
              </div>
            </div>
          )}
          {total > cities.length ? (
            <p className="h-card__m" style={{ marginTop: 16 }}>
              Showing {cities.length} of {formatNumber(total)}.
            </p>
          ) : null}
        </div>
      </section>

      <ConnectBand
        actions={[
          { href: guide, label: `Study in ${country.name}` },
          { href: countryUniversitiesHref(countrySlug), label: `Universities in ${country.name}`, ghost: true },
          { href: `/courses?country=${countrySlug}`, label: `Courses in ${country.name}`, ghost: true },
          { href: '/cities', label: 'Every city', ghost: true },
        ]}
      />
    </>
  );
}
