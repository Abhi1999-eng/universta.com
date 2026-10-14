import Link from 'next/link';
import { RichText } from '@/components/phase1/RichText';
import { consultantContactActions } from '@/lib/consultant-contact';
import { formatDate } from '@/lib/format';
import { jsonLdString } from '@/lib/json-ld';
import { breadcrumbJsonLd, type Crumb } from '@/lib/university-json-ld';
import { ConnectBand, MatchBand } from './DiscoveryBands';
import { Crumbs } from './Crumbs';
import { SectionHead } from './SectionHead';

/**
 * A consultant's profile, as the client's zip draws it: the compact hero
 * with the destinations and offices it lists and the published contact
 * card beside it, then about, services, offices, verification and the
 * match band. The zip's reviews, success rates and booking calendar are
 * not here: Universta records none of them. Every line is the consultant's
 * own record, and the page says plainly what has not been verified.
 */
export type ConsultantGuideProps = {
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
  /** The destinations with a guide of their own, by slug. */
  guides: ReadonlySet<string>;
};

export function ConsultantGuide({ consultant, countries, services, languages, locations, guides }: ConsultantGuideProps) {
  const self = `/study-abroad-consultants/${consultant.slug}`;
  const trail: Crumb[] = [
    { label: 'Home', href: '/' },
    { label: 'Consultants', href: '/study-abroad-consultants' },
    { label: consultant.name },
  ];
  /* The helper returns a primary "Contact Consultant" action plus per-channel
     ones, so an email-only consultant yields two buttons pointing at the same
     mailto. Dedupe by destination and keep the primary label. */
  const actions = consultantContactActions({ email: consultant.email, phone: consultant.phone }).filter(
    (action, index, list) => list.findIndex((other) => other.href === action.href) === index,
  );
  const hasContact = Boolean(consultant.email || consultant.phone || consultant.websiteUrl);
  /* A location is often named for its city, so the city is said once. */
  const once = (parts: Array<string | null | undefined>) =>
    parts.filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
  const where = (location: ConsultantGuideProps['locations'][number]) =>
    once([location.city, location.state, location.country].filter((part) => part !== location.name)).join(', ');
  const destinationHref = (slug: string) =>
    guides.has(slug) ? `/study-abroad/${slug}/consultants` : `/study-abroad-consultants?country=${slug}#consultants`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(trail, self)) }} />

      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={trail} />
          <div className="coursehero__grid">
            <div>
              <div className="instcard__badges" style={{ marginBottom: 14 }}>
                {consultant.verified ? (
                  <span className="badge badge--ok">
                    Verified{consultant.verifiedAt ? ` ${formatDate(consultant.verifiedAt)}` : ''}
                  </span>
                ) : (
                  <span className="badge badge--neutral">Not yet verified</span>
                )}
                <span className="badge badge--neutral">Independent consultant</span>
              </div>
              <h1 className="hero__h1">{consultant.name}</h1>
              {consultant.shortDescription ? <p className="hero__sub">{consultant.shortDescription}</p> : null}
              {countries.length ? (
                <div className="consulthero__row">
                  <span className="label">Study destinations</span>
                  <div className="destbadges destbadges--lg">
                    {countries.map((country) => (
                      <Link className="destbadge" href={destinationHref(country.slug)} key={country.slug}>
                        {country.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              {locations.length ? (
                <div className="consulthero__row">
                  <span className="label">{locations.length === 1 ? 'Office' : 'Offices'}</span>
                  <p className="instcard__loc">
                    {locations.map((location) => once([location.name, location.city]).join(' · ')).join(', ')}
                  </p>
                </div>
              ) : null}
              <div className="btn-row" style={{ marginTop: 22 }}>
                {actions.map((action) => (
                  <a className={`btn btn--lg${action.primary ? '' : ' btn--ghost'}`} href={action.href} key={action.href}>
                    {action.label}
                    {action.primary ? (
                      <>
                        {' '}
                        <span className="btn__arrow" aria-hidden="true">
                          &rarr;
                        </span>
                      </>
                    ) : null}
                  </a>
                ))}
                {consultant.websiteUrl ? (
                  <a className="btn btn--lg btn--ghost" href={consultant.websiteUrl} rel="nofollow noopener" target="_blank">
                    Visit website{' '}
                    <span className="btn__arrow" aria-hidden="true">
                      &#8599;
                    </span>
                  </a>
                ) : null}
                <Link
                  className={`btn btn--lg${actions.length ? ' btn--ghost' : ''}`}
                  href={`/counselling?source=general&from=${encodeURIComponent(self)}`}
                >
                  Book free counselling
                </Link>
              </div>
            </div>

            <aside className="contactcard" aria-label="Contact">
              <span className="label">Contact</span>
              {hasContact ? (
                <>
                  <p className="contactcard__note">Published by the consultant on this record.</p>
                  <dl className="contactcard__rows">
                    {consultant.email ? (
                      <div className="contactcard__row">
                        <dt className="label">Email</dt>
                        <dd>
                          <a href={`mailto:${consultant.email}`}>{consultant.email}</a>
                        </dd>
                      </div>
                    ) : null}
                    {consultant.phone ? (
                      <div className="contactcard__row">
                        <dt className="label">Phone</dt>
                        <dd>
                          <a href={`tel:${consultant.phone.replace(/[^\d+]/g, '')}`}>{consultant.phone}</a>
                        </dd>
                      </div>
                    ) : null}
                    {consultant.websiteUrl ? (
                      <div className="contactcard__row">
                        <dt className="label">Website</dt>
                        <dd>
                          <a href={consultant.websiteUrl} rel="nofollow noopener" target="_blank">
                            {consultant.websiteUrl.replace(/^https?:\/\//, '')}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </>
              ) : (
                <>
                  <p className="contactcard__note">This consultant has not published contact details.</p>
                  <Link className="btn btn--block" href={`/counselling?source=general&from=${encodeURIComponent(self)}`}>
                    Book free counselling
                  </Link>
                </>
              )}
              <p className="contactcard__note">
                Universta does not endorse consultants and collects no ratings. Consultant services are provided by
                independent third parties.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="sec sec--white" id="about">
        <div className="wrap">
          <SectionHead
            eyebrow="About"
            title={`About ${consultant.name}`}
            lead={consultant.description ? null : (consultant.shortDescription ?? 'The consultant has published no description on this record.')}
          />
          {consultant.description ? <RichText value={consultant.description} className="h-prose" /> : null}
          {countries.length || languages.length ? (
            <div className="admgrid" style={{ marginTop: consultant.description ? 28 : 0 }}>
              {countries.length ? (
                <div className="admgrid__col">
                  <p className="path__h">Destinations</p>
                  <ul className="linklist">
                    {countries.map((country) => (
                      <li key={country.slug}>
                        <Link href={guides.has(country.slug) ? `/study-abroad/${country.slug}` : destinationHref(country.slug)}>
                          Study in {country.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {languages.length ? (
                <div className="admgrid__col">
                  <p className="path__h">Languages</p>
                  <div className="tagrow">
                    {languages.map((language) => (
                      <span className="tag" key={language}>
                        {language}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="sec sec--paper" id="services">
        <div className="wrap">
          <SectionHead
            eyebrow="Services"
            title="Services this consultant lists"
            lead="Only the services on this consultant's own profile. A listed service describes what they offer, not an outcome."
          />
          {services.length ? (
            <ul className="svclist">
              {services.map((service) => (
                <li className="svclist__item" key={service}>
                  <b>{service}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="emptyline">This consultant has not listed any services on its record.</p>
          )}
        </div>
      </section>

      <section className="sec sec--white" id="offices">
        <div className="wrap">
          <SectionHead
            eyebrow="Offices"
            title="Office locations"
            lead="Each office as the consultant published it, with the other consultants Universta lists there."
          />
          {locations.length ? (
            <div className="officegrid">
              {locations.map((location) => (
                <article className="officegrid__item" key={location.slug}>
                  {location.country ? <span className="label">{location.country}</span> : null}
                  <b>{location.name}</b>
                  {where(location) ? <span>{where(location)}</span> : null}
                  {location.address ? <span>{location.address}</span> : null}
                  <Link className="linkcta" href={`/study-abroad-consultants/locations/${location.slug}`}>
                    Other consultants here <span aria-hidden="true">&rarr;</span>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="emptyline">No office location is published on this record.</p>
          )}
        </div>
      </section>

      <section className="sec sec--paper" id="verification">
        <div className="wrap">
          <SectionHead
            eyebrow="Trust"
            title="Verification"
            lead={
              consultant.verified
                ? 'An administrator has checked this record against its source and dated the check.'
                : 'Listed, but not yet checked by Universta. Treat the details as the consultant published them.'
            }
          />
          <div className="unisnap unisnap--fit">
            <div className="unisnap__cell">
              <span className="label">Status</span>
              <b>{consultant.verified ? 'Verified' : 'Not yet verified'}</b>
            </div>
            <div className="unisnap__cell">
              <span className="label">Last verified</span>
              <b>{consultant.verifiedAt ? formatDate(consultant.verifiedAt) : 'Not verified'}</b>
            </div>
            <div className="unisnap__cell">
              <span className="label">Source</span>
              <b>
                {consultant.sourceReference ? (
                  <a href={consultant.sourceReference} rel="nofollow noopener" target="_blank">
                    The consultant&rsquo;s own listing &#8599;
                  </a>
                ) : (
                  'Not recorded'
                )}
              </b>
            </div>
          </div>
          <aside className="trustbox" aria-label="How Universta works with consultants" style={{ marginTop: 24 }}>
            <p className="path__h">How Universta works with consultants</p>
            <ul className="ticklist ticklist--sm">
              <li>Universta is a discovery and guidance platform. Consultant services are provided by independent third-party consultants.</li>
              <li>Consultant information is verified where possible, and each listing shows what has and has not been checked.</li>
              <li>No consultant can guarantee admission, a visa, a scholarship or a job. Treat any guarantee as a warning sign.</li>
            </ul>
          </aside>
        </div>
      </section>

      <MatchBand
        eyebrow={{ n: 'Next step', label: 'Guidance' }}
        heading="Want a second opinion first?"
        lead="Book a free Universta counselling session to sanity-check your shortlist before you engage a consultant."
        href="/study-abroad-consultants"
        talkHref={`/counselling?source=general&from=${encodeURIComponent(self)}`}
        assessment={{
          label: 'Find My Consultant Options',
          intent: 'consultants-index',
          note: 'Share your details with Universta to receive relevant consultant options and guidance. Universta handles your request first and never sells your details.',
        }}
      />

      <ConnectBand
        actions={[
          { href: '/study-abroad-consultants', label: 'Browse consultants' },
          { href: `/compare/consultants?items=${encodeURIComponent(consultant.slug)}`, label: 'Compare', ghost: true },
          ...countries.slice(0, 2).map((country) => ({
            href: guides.has(country.slug) ? `/study-abroad/${country.slug}` : destinationHref(country.slug),
            label: `Study in ${country.name}`,
            ghost: true,
          })),
          { href: '/scholarships', label: 'Find scholarships', ghost: true },
        ]}
      />
    </>
  );
}
