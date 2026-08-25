import Link from 'next/link';
import { consultantContactActions } from '@/lib/consultant-contact';
import { formatDate } from '@/lib/format';
import { RichText } from '@/components/phase1/RichText';

/** The client-approved consultant profile.
 *
 * The template leads with a star rating, review count, success rate, students
 * placed, response time and a booking calendar, and closes with testimonials
 * and a comparison against other consultants. Universta records a consultant's
 * name, description, contact details, verification state, destinations,
 * services, languages and office locations — so the page is built from those,
 * and the contact action stays with the consultant's own published email or
 * phone rather than routing the visitor into Universta counselling. */

export type ConsultantDetailProps = {
  consultant: {
    name: string;
    slug: string;
    shortDescription: string | null;
    description: string | null;
    email: string | null;
    phone: string | null;
    websiteUrl: string | null;
    verified: boolean;
    verifiedAt: string | null;
    sourceReference: string | null;
  };
  countries: Array<{ name: string; slug: string }>;
  services: string[];
  languages: string[];
  locations: Array<{ name: string; slug: string; city: string | null; address: string | null }>;
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

export function ConsultantDetailReference(props: ConsultantDetailProps) {
  const { consultant, countries, services, languages, locations } = props;
  /** The helper returns a primary "Contact Consultant" action plus per-channel
   * ones, so an email-only consultant yields two buttons pointing at the same
   * mailto. Dedupe by destination and keep the primary label. */
  const actions = consultantContactActions({
    email: consultant.email,
    phone: consultant.phone,
  }).filter(
    (action, index, list) => list.findIndex((other) => other.href === action.href) === index,
  );

  const facts = [
    countries.length && ['Destinations covered', String(countries.length)],
    services.length && ['Services', String(services.length)],
    languages.length && ['Languages', String(languages.length)],
    locations.length && ['Offices', String(locations.length)],
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <div className="cref cref-dest">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/study-abroad-consultants">Study abroad consultants</Link> ›{' '}
          <span aria-current="page">{consultant.name}</span>
        </nav>
      </div>

      <section className="wrap hero-grid">
        <div>
          <span className="h-flag" aria-hidden="true">
            {initials(consultant.name)}
          </span>
          <h1>{consultant.name}</h1>
          {consultant.shortDescription ? (
            <p className="lede">{consultant.shortDescription}</p>
          ) : null}
          {consultant.verified ? (
            <div className="updated">
              Verified record
              {consultant.verifiedAt ? ` · checked ${formatDate(consultant.verifiedAt)}` : ''}
            </div>
          ) : (
            <div className="updated">Published record — not yet verified</div>
          )}
          <div className="hero-btns">
            {actions.map((action) => (
              <a
                key={action.href}
                className={`btn btn-lg ${action.primary ? 'btn-primary' : 'btn-ghost'}`}
                href={action.href}
              >
                {action.label}
              </a>
            ))}
            {consultant.websiteUrl ? (
              <a
                className="btn btn-ghost btn-lg"
                href={consultant.websiteUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Visit website
              </a>
            ) : null}
          </div>
          {actions.length === 0 && !consultant.websiteUrl ? (
            <p className="disclaimer">
              This consultant has not published contact details. You can{' '}
              <Link href="/counselling" style={{ color: 'var(--blue)' }}>
                book free Universta counselling
              </Link>{' '}
              instead.
            </p>
          ) : null}
        </div>

        <aside className="quickfacts">
          <h2>Profile at a glance</h2>
          <p className="qf-note">Every figure below is a published field on this record.</p>
          {facts.map(([label, value]) => (
            <div className="qf-row" key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
          {consultant.email ? (
            <div className="qf-row">
              <span>Email</span>
              <b style={{ wordBreak: 'break-all' }}>{consultant.email}</b>
            </div>
          ) : null}
          {consultant.phone ? (
            <div className="qf-row">
              <span>Phone</span>
              <b>{consultant.phone}</b>
            </div>
          ) : null}
        </aside>
      </section>

      {/* ABOUT */}
      {consultant.description ? (
        <section className="sec sec-alt" id="about">
          <div className="wrap narrow">
            <div className="head">
              <span className="eyebrow">About</span>
              <h2>About {consultant.name}</h2>
            </div>
            <RichText className="prose" value={consultant.description} />
          </div>
        </section>
      ) : null}

      {/* SERVICES */}
      {services.length ? (
        <section className="sec" id="services">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">What they do</span>
              <h2>Services</h2>
            </div>
            <div className="dest-flags">
              {services.map((service) => (
                <span className="dest-flag" key={service}>
                  {service}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* DESTINATIONS */}
      {countries.length ? (
        <section className="sec sec-alt" id="destinations">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Where they help</span>
              <h2>Destinations covered</h2>
            </div>
            <div className="dest-flags">
              {countries.map((country) => (
                <Link key={country.slug} className="dest-flag" href={`/countries/${country.slug}`}>
                  <span className="cc">{initials(country.name)}</span>
                  {country.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* OFFICES */}
      {locations.length ? (
        <section className="sec" id="offices">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Where to find them</span>
              <h2>Offices</h2>
            </div>
            <div className="grid g3">
              {locations.map((location) => (
                <article className="card" key={location.slug}>
                  <h3 style={{ fontSize: 17 }}>{location.name}</h3>
                  {location.city ? (
                    <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>
                      {location.city}
                    </p>
                  ) : null}
                  {location.address ? (
                    <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 10 }}>
                      {location.address}
                    </p>
                  ) : null}
                  <p style={{ marginTop: 12 }}>
                    <Link
                      className="link-more"
                      href={`/study-abroad-consultants/locations/${location.slug}`}
                    >
                      Consultants in {location.name} →
                    </Link>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* LANGUAGES */}
      {languages.length ? (
        <section className="sec sec-alt" id="languages">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Communication</span>
              <h2>Languages</h2>
            </div>
            <div className="dest-flags">
              {languages.map((language) => (
                <span className="dest-flag" key={language}>
                  {language}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {consultant.sourceReference ? (
        <section className="wrap" style={{ paddingBottom: 24 }}>
          <p className="disclaimer">
            Published from{' '}
            <a
              href={consultant.sourceReference}
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: 'var(--blue)' }}
            >
              this consultant’s own listing
            </a>
            {consultant.verifiedAt ? `, verified ${formatDate(consultant.verifiedAt)}` : ''}.
            Universta does not endorse consultants and collects no ratings.
          </p>
        </section>
      ) : null}

      <section className="final">
        <div className="wrap">
          <span className="eyebrow">Next step</span>
          <h2>Want a second opinion first?</h2>
          <p>
            Book a free Universta counselling session to sanity-check your shortlist before you
            engage a consultant.
          </p>
          <div className="final-btns">
            <Link href="/counselling" className="btn btn-w btn-lg">
              Book free counselling
            </Link>
            <Link href="/study-abroad-consultants" className="btn btn-o btn-lg">
              Browse consultants
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
