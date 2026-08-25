import Link from 'next/link';
import { consultantContactActions } from '@/lib/consultant-contact';
import { formatDate } from '@/lib/format';
import { RichText } from '@/components/phase1/RichText';

/** The consultant profile.
 *
 * The client-approved template leads with a star rating, review count, success
 * rate, students placed, response time and a booking calendar, and closes with
 * testimonials and a comparison against other consultants. Universta records a
 * consultant's name, description, contact details, verification state,
 * destinations, services, languages and office locations -- so the page is
 * built from those, and the contact action stays with the consultant's own
 * published email or phone rather than routing the visitor into Universta
 * counselling.
 *
 * Composition note: services, destinations, languages and offices used to be
 * four full-width bands, each with an eyebrow and a 38px heading above a
 * single chip -- roughly 250px of page for one word. They are now blocks in
 * one content-sized grid, and the panel beside the identity carries contact
 * details a reader can act on instead of a table counting those same chips. */

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
  locations: Array<{
    name: string;
    slug: string;
    city: string | null;
    state?: string | null;
    country?: string | null;
    address: string | null;
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

function VerifiedMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 1.4 9.9 3l2.4-.3.6 2.4 2 1.4-1.1 2.2.4 2.4-2.4.6L10.2 14 8 12.9 5.8 14l-1.6-1.9-2.4-.6.4-2.4L1.1 6.9l2-1.4.6-2.4L6.1 3 8 1.4Z"
        fill="currentColor"
        opacity=".18"
      />
      <path
        d="m5.4 8.1 1.8 1.8 3.5-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

  const hasContact = Boolean(consultant.email || consultant.phone || consultant.websiteUrl);
  const hasProfile = Boolean(
    services.length || countries.length || languages.length || locations.length,
  );

  return (
    <div className="cref cref-dest cdetail">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="crumb-step">
            <Link href="/study-abroad-consultants">Study abroad consultants</Link>
          </span>
          <span className="crumb-step" aria-current="page">
            {consultant.name}
          </span>
        </nav>
      </div>

      <section className="wrap cdetail-hero">
        <div className="cdetail-intro">
          <div className="pd-identity">
            <span className="pd-avatar" aria-hidden="true">
              {initials(consultant.name)}
            </span>
            <div className="pd-title-row">
              <h1>{consultant.name}</h1>
              {consultant.verified ? (
                <span className="pd-badge is-verified">
                  <VerifiedMark />
                  Verified
                  {consultant.verifiedAt ? ` · ${formatDate(consultant.verifiedAt)}` : ''}
                </span>
              ) : (
                <span className="pd-badge">Not yet verified</span>
              )}
            </div>
          </div>

          {consultant.shortDescription ? (
            <p className="lede">{consultant.shortDescription}</p>
          ) : null}

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
        </div>

        <aside className="pd-panel cdetail-contact">
          <h2>Contact</h2>
          {hasContact ? (
            <>
              <p className="pd-panel-note">Published by the consultant on this record.</p>
              <dl className="pd-rows">
                {consultant.email ? (
                  <div className="pd-row">
                    <dt>Email</dt>
                    <dd>
                      <a href={`mailto:${consultant.email}`}>{consultant.email}</a>
                    </dd>
                  </div>
                ) : null}
                {consultant.phone ? (
                  <div className="pd-row">
                    <dt>Phone</dt>
                    <dd>
                      <a href={`tel:${consultant.phone.replace(/[^\d+]/g, '')}`}>
                        {consultant.phone}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {consultant.websiteUrl ? (
                  <div className="pd-row">
                    <dt>Website</dt>
                    <dd>
                      <a href={consultant.websiteUrl} target="_blank" rel="noreferrer noopener">
                        {consultant.websiteUrl.replace(/^https?:\/\//, '')}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </>
          ) : (
            <>
              <p className="pd-panel-note">This consultant has not published contact details.</p>
              <Link className="btn btn-primary btn-block" href="/counselling">
                Book free counselling
              </Link>
            </>
          )}
        </aside>
      </section>

      {/* ABOUT -- only when the consultant published prose of their own. */}
      {consultant.description ? (
        <section className="sec sec-alt cdetail-sec" id="about">
          <div className="wrap narrow">
            <div className="pd-section-head">
              <span className="pd-eyebrow">About</span>
              <h2>About {consultant.name}</h2>
            </div>
            <RichText className="prose" value={consultant.description} />
          </div>
        </section>
      ) : null}

      {/* PROFILE -- one section for every published attribute. Each block is
        * sized by its own content, so a consultant with one service and one
        * destination gets two compact cards rather than two page bands. */}
      {hasProfile ? (
        <section className="sec cdetail-sec" id="profile">
          <div className="wrap">
            <div className="pd-section-head">
              <span className="pd-eyebrow">Profile</span>
              <h2>What this consultant covers</h2>
              <p>Every entry below is a published field on this record.</p>
            </div>
            <div className="pd-grid pd-grid-split">
              {services.length || countries.length || languages.length ? (
              <div className="pd-block">
                <h3>Coverage</h3>
                <dl className="pd-deflist">
                  {services.length ? (
                    <div className="pd-defrow" id="services">
                      <dt>Services</dt>
                      <dd>
                        <ul className="pd-chips">
                          {services.map((service) => (
                            <li key={service}>
                              <span className="pd-chip">{service}</span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ) : null}

                  {countries.length ? (
                    <div className="pd-defrow" id="destinations">
                      <dt>Destinations</dt>
                      <dd>
                        <ul className="pd-chips">
                          {countries.map((country) => (
                            <li key={country.slug}>
                              <Link className="pd-chip" href={`/countries/${country.slug}`}>
                                <span className="pd-cc" aria-hidden="true">
                                  {initials(country.name)}
                                </span>
                                {country.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ) : null}

                  {languages.length ? (
                    <div className="pd-defrow" id="languages">
                      <dt>Languages</dt>
                      <dd>
                        <ul className="pd-chips">
                          {languages.map((language) => (
                            <li key={language}>
                              <span className="pd-chip">{language}</span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              ) : null}

              {locations.length ? (
                <div className="pd-block cdetail-offices" id="offices">
                  <h3>{locations.length === 1 ? 'Office' : 'Offices'}</h3>
                  <ul className="pd-list">
                    {locations.map((location) => (
                      <li key={location.slug}>
                        <strong>{location.name}</strong>
                        <span>
                          {[location.city, location.state, location.country]
                            .filter(Boolean)
                            .join(', ') || 'Location published without a city'}
                        </span>
                        {location.address ? <span>{location.address}</span> : null}
                        <Link
                          className="pd-more"
                          href={`/study-abroad-consultants/locations/${location.slug}`}
                        >
                          Other consultants here &rarr;
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {consultant.sourceReference ? (
              <p className="disclaimer cdetail-source">
                Published from{' '}
                <a
                  href={consultant.sourceReference}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ color: 'var(--blue)' }}
                >
                  this consultant&rsquo;s own listing
                </a>
                {consultant.verifiedAt ? `, verified ${formatDate(consultant.verifiedAt)}` : ''}.
                Universta does not endorse consultants and collects no ratings.
              </p>
            ) : null}
          </div>
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
