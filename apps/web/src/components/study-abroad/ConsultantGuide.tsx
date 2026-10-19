import Link from 'next/link';
import { CounsellingForm } from '@/components/counselling/CounsellingForm';
import { RichText } from '@/components/phase1/RichText';
import type { CounsellingOptions } from '@/lib/counselling';
import { consultantContactActions } from '@/lib/consultant-contact';
import { displayUrl, externalHttpUrl } from '@/lib/consultant-profile';
import { formatDate } from '@/lib/format';
import { jsonLdString } from '@/lib/json-ld';
import { breadcrumbJsonLd, type Crumb } from '@/lib/university-json-ld';
import { ConsultantCompareButton, ConsultantCompareTray } from './ConsultantCompare';
import { ConsultantTrust } from './ConsultantTrust';
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
  /** The counselling form's countries, levels and intakes, read on the
   *  server; without them the form loads its own. */
  counselling?: CounsellingOptions | null;
};

export function ConsultantGuide({
  consultant,
  countries,
  services,
  languages,
  locations,
  guides,
  counselling = null,
}: ConsultantGuideProps) {
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
  /* Linked only when it is an absolute web address: a bare "www.…" typed
     into the admin became a link to a page of our own that does not exist.
     Anything else is shown as the text it is. */
  const website = externalHttpUrl(consultant.websiteUrl);
  const source = externalHttpUrl(consultant.sourceReference);
  /* A date is printed only beside VERIFIED: a pending record can still
     carry the date of a check that no longer stands. */
  const verifiedOn = consultant.verified && consultant.verifiedAt ? formatDate(consultant.verifiedAt) || null : null;
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
                    Verified{verifiedOn ? ` ${verifiedOn}` : ''}
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
                {website ? (
                  <a className="btn btn--lg btn--ghost" href={website} rel="nofollow noopener" target="_blank">
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
                <ConsultantCompareButton item={{ slug: consultant.slug, name: consultant.name }} />
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
                          {website ? (
                            <a href={website} rel="nofollow noopener" target="_blank">
                              {displayUrl(website)}
                            </a>
                          ) : (
                            displayUrl(consultant.websiteUrl)
                          )}
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
          {/* The description beside the heading, as the design sets it,
              rather than under it with the right half of the page empty.
              It is rich text, so it goes in the head's own column, not in
              the one-paragraph lead. */}
          <SectionHead
            eyebrow="About"
            title={`About ${consultant.name}`}
            lead={consultant.description ? null : (consultant.shortDescription ?? 'The consultant has published no description on this record.')}
          >
            {consultant.description ? (
              <RichText value={consultant.description} className="h-prose" />
            ) : null}
          </SectionHead>
          {countries.length || languages.length ? (
            <div className="admgrid">
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
          {/* Two columns, as the directory sets the same list: one column
              across the whole page left each name a long way from the
              rule under it. Services have no categories here, so there
              are no group headings. */}
          {services.length ? (
            <ul className="svclist svcgroups">
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
                ? verifiedOn
                  ? 'An administrator has checked this record against its source and dated the check.'
                  : 'An administrator has checked this record against its source. The date of that check was not recorded.'
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
              <b>{consultant.verified ? (verifiedOn ?? 'Verified (date not recorded)') : 'Not verified'}</b>
            </div>
            <div className="unisnap__cell">
              <span className="label">Source</span>
              <b>
                {source ? (
                  <a href={source} rel="nofollow noopener" target="_blank">
                    The consultant&rsquo;s own listing &#8599;
                  </a>
                ) : consultant.sourceReference?.trim() ? (
                  consultant.sourceReference.trim()
                ) : (
                  'Not recorded'
                )}
              </b>
            </div>
          </div>
        </div>
      </section>

      {/* The design's "Get guidance": the request on the profile itself, so
          a reader need not leave the consultant to ask about them. It goes
          to Universta with this page as where it started; the contact card
          above stays as it is, with nothing held back until it is sent. */}
      <section className="sec sec--white" id="contact">
        <div className="wrap">
          <div className="leadinline">
            <div className="leadinline__copy">
              <p className="eyebrow">Get guidance</p>
              <h2 className="sec-title">Want help deciding on a consultant?</h2>
              <p className="sec-lead">
                Tell Universta what you plan to study and a counsellor will help you weigh up {consultant.name}{' '}
                alongside the other options open to you. Your request comes to the Universta team; it is not
                passed on to the consultant.
              </p>
            </div>
            <div className="leadinline__form">
              <CounsellingForm initialOptions={counselling} context={{ sourceType: 'general', sourcePagePath: self }} />
            </div>
          </div>
          <ConsultantTrust className="trustbox--below" />
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

      <ConsultantCompareTray />
    </>
  );
}
