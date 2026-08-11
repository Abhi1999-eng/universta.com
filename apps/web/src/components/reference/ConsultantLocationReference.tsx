import Link from 'next/link';
import { formatNumber } from '@/lib/format';

/** The client-approved destination-specific consultants page.
 *
 * The template pitches a city page with review scores, success rates,
 * placement counts and a "top rated in this city" leaderboard. A consultant
 * location record holds its name, city, country and the consultants attached
 * to it, so the page lists those with their real destinations and services and
 * omits the scoring blocks. */

export type ConsultantLocationProps = {
  location: {
    name: string;
    slug: string;
    city: string | null;
    state: string | null;
    overview: string | null;
    country: { name: string; slug: string } | null;
  };
  consultants: Array<{
    name: string;
    slug: string;
    shortDescription: string | null;
    verified: boolean;
    countries: string[];
    services: string[];
  }>;
};

const SKIP_WORDS = new Set(['of', 'in', 'and', 'the', 'for', 'a', 'an', '&']);

function initials(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word && !SKIP_WORDS.has(word.toLowerCase()));
  if (words.length === 0) return value.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export function ConsultantLocationReference(props: ConsultantLocationProps) {
  const { location, consultants } = props;
  const place = [location.city, location.state, location.country?.name].filter(Boolean).join(', ');

  return (
    <div className="cref cref-dest">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/study-abroad-consultants">Study abroad consultants</Link> ›{' '}
          <span aria-current="page">{location.name}</span>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap hero-in">
          <h1>
            Study abroad consultants in <span className="b">{location.name}</span>
          </h1>
          <p className="lead">
            {location.overview ??
              `Published consultants with an office in ${location.name}${place && place !== location.name ? `, ${place}` : ''}.`}
          </p>
          <div className="hstats">
            <div className="hstat">
              <b>{consultants.length ? formatNumber(consultants.length) : '—'}</b>
              <span>Consultants here</span>
            </div>
            {location.country ? (
              <div className="hstat">
                <b>{location.country.name}</b>
                <span>Country</span>
              </div>
            ) : null}
            {location.city ? (
              <div className="hstat">
                <b>{location.city}</b>
                <span>City</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="sec sec-alt" id="results">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">Directory</span>
            <h2>Consultants with an office in {location.name}</h2>
          </div>

          {consultants.length === 0 ? (
            <div className="cref-empty" data-testid="location-empty">
              <h3>No consultants published here yet</h3>
              <p>Browse the full directory, or book free Universta counselling.</p>
              <Link className="btn btn-primary" href="/study-abroad-consultants">
                Browse consultants
              </Link>
            </div>
          ) : (
            <div className="clist">
              {consultants.map((consultant) => (
                <article className="ccard" key={consultant.slug}>
                  <div className="cc-cover" />
                  <div className="cc-in">
                    <span className="cc-logo" aria-hidden="true">
                      {initials(consultant.name)}
                    </span>
                    <div className="cc-main">
                      <div className="cc-name">
                        <h3>
                          <Link href={`/study-abroad-consultants/${consultant.slug}`}>
                            {consultant.name}
                          </Link>
                        </h3>
                      </div>
                      {consultant.shortDescription ? (
                        <p className="cc-desc">{consultant.shortDescription}</p>
                      ) : null}
                      {consultant.countries.length || consultant.services.length ? (
                        <div className="cc-tags">
                          {consultant.countries.slice(0, 3).map((country) => (
                            <span className="pill-mini" key={country}>
                              {country}
                            </span>
                          ))}
                          {consultant.services.slice(0, 3).map((service) => (
                            <span className="pill-mini" key={service}>
                              {service}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="cc-side">
                      {consultant.verified ? (
                        <div className="cc-verified">
                          <span>Record</span>
                          <b>Verified</b>
                        </div>
                      ) : null}
                      <Link
                        className="btn btn-primary btn-sm"
                        href={`/study-abroad-consultants/${consultant.slug}`}
                      >
                        View profile
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {location.country ? (
        <section className="sec">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Keep exploring</span>
              <h2>Planning a move to {location.country.name}?</h2>
            </div>
            <div className="dest-flags">
              <Link className="dest-flag" href={`/countries/${location.country.slug}`}>
                Study in {location.country.name}
              </Link>
              <Link className="dest-flag" href={`/courses?country=${location.country.slug}#discovery`}>
                Courses in {location.country.name}
              </Link>
              <Link
                className="dest-flag"
                href={`/study-abroad-consultants?country=${location.country.slug}#results`}
              >
                All {location.country.name} consultants
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="final">
        <div className="wrap">
          <span className="eyebrow">Next step</span>
          <h2>Want help before you choose?</h2>
          <p>Book a free Universta counselling session and we will help you narrow the list.</p>
          <div className="final-btns">
            <Link href="/counselling" className="btn btn-w btn-lg">
              Book free counselling
            </Link>
            <Link href="/study-abroad-consultants" className="btn btn-o btn-lg">
              Browse all consultants
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
