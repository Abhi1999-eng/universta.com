import Link from 'next/link';
import { getAllCities } from '@/lib/locations';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return staticPageMetadata(
    'cities-listing',
    'Cities',
    'Browse published study cities across every published destination country.',
    '/cities',
  );
}

/** Global city index. City detail pages previously required opening a country
 * first, so this is the page the header's Study Destinations > Cities entry
 * points at. Grouped by country so the country context stays visible. */
export default async function CitiesPage() {
  let cities: Awaited<ReturnType<typeof getAllCities>>['data'] = [];
  let total = 0;
  try {
    const result = await getAllCities({ limit: '100' });
    cities = result.data;
    total = result.meta.total;
  } catch {
    cities = [];
  }

  const byCountry = new Map<string, { name: string; slug: string; cities: typeof cities }>();
  for (const city of cities) {
    const entry = byCountry.get(city.country.slug) ?? {
      name: city.country.name,
      slug: city.country.slug,
      cities: [],
    };
    entry.cities.push(city);
    byCountry.set(city.country.slug, entry);
  }
  const groups = [...byCountry.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="visual-subjects-page">
      <div className="wrap crumbs">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><Link href="/">Home</Link></li>
            <li className="sep">/</li>
            <li aria-current="page">Cities</li>
          </ol>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap hero-inner">
          <span className="hero-pill">
            <b>{total}</b> published {total === 1 ? 'city' : 'cities'}
          </span>
          <h1>Explore study <span>cities</span></h1>
          <p className="lede">
            Browse the cities currently published across every destination
            country, then open a city for its published detail page.
          </p>
        </div>
      </section>

      <div className="wrap">
        {groups.length ? (
          groups.map((group) => (
            <section className="section" key={group.slug} style={{ paddingTop: 0 }}>
              <div className="section-head row-between">
                <div>
                  <span className="eyebrow">Destination</span>
                  <h2>{group.name}</h2>
                </div>
                <Link className="link-more" href={`/study-in-${group.slug}/cities`}>
                  All {group.name} cities →
                </Link>
              </div>
              <div className="grid g3">
                {group.cities.map((city) => (
                  <Link
                    key={city.id}
                    className="card subj-card"
                    href={`/study-in-${group.slug}/${city.slug}`}
                  >
                    <div className="subj-body">
                      <h3>{city.name}</h3>
                      <p>
                        {city.shortDescription ??
                          `Published city profile in ${group.name}.`}
                      </p>
                      <div className="subj-foot">
                        <span>{city.state?.name ?? group.name}</span>
                        <span className="go">View city →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="section">
            <div className="section-head">
              <span className="eyebrow">Cities</span>
              <h2>No cities are published yet</h2>
              <p className="sub">
                Published city profiles will appear here. In the meantime you
                can browse destinations by country.
              </p>
            </div>
            <Link className="btn btn-primary" href="/countries">
              Explore countries
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
