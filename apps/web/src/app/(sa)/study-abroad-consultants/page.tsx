import type { Metadata } from 'next';
import Link from 'next/link';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { CountryConsultantIndex } from '@/components/study-abroad/CountryConsultantIndex';
import { CountryListSearch } from '@/components/study-abroad/CountryListSearch';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { ConnectBand, MatchBand } from '@/components/study-abroad/DiscoveryBands';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { SectionHead } from '@/components/study-abroad/SectionHead';
import {
  consultantListHref,
  consultantOptions,
  countryConsultantsHref,
  isNarrowedConsultantList,
  toConsultantRows,
} from '@/lib/country-consultant-list';
import { counsellingHref } from '@/lib/counselling-link';
import { formatNumber } from '@/lib/format';
import { getListingPageContent } from '@/lib/listing-page-content';
import { phaseListAll } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';
import { getDestinations } from '@/lib/study-abroad';

/**
 * The worldwide consultants directory, as the client's zip draws it: a
 * compact hero with the search, the directory with its filters, then who
 * needs a consultant, the services consultants list, consultants by
 * destination and by city, how to choose one, and the match band.
 *
 * The directory is the destination pages' own list, narrowed in the browser,
 * with a destination filter added for the worldwide view; every count on the
 * page is taken from the published consultants, so a section with nothing
 * behind it stands down. The zip's service descriptions are not repeated:
 * services here are what each consultant typed, so the list names them and
 * says how many consultants list each. The older page's answers stay.
 */
export const dynamic = 'force-dynamic';

const PATH = '/study-abroad-consultants';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'consultants-listing',
    'Study abroad consultants',
    'Explore currently published study abroad consultants, their locations and services.',
    PATH,
  );
  return {
    ...metadata,
    /* The helper writes the site's suffix; the route family's template would add it again. */
    title: { absolute: String(metadata.title) },
    ...(isNarrowedConsultantList(await searchParams) ? { robots: { index: false, follow: true } } : {}),
  };
}

const NEED_YES = [
  'You are applying to several universities or countries and want help keeping deadlines and documents in order',
  'You are unsure which courses fit your academic background and budget',
  'You want feedback on your statement of purpose before you submit',
  'You want someone local to explain an unfamiliar application or visa document list',
];
const NEED_NO = [
  'You are applying to one or two programmes with clear instructions on the university website',
  'You are comfortable reading official visa guidance and preparing documents yourself',
  'Your university offers its own admissions advice for international applicants',
];
const CHOOSE = [
  ['Check destination expertise', 'Ask how many students they have supported for this destination recently and at which level.'],
  ['Check university relationships', 'Ask which universities they represent or work with, and ask for evidence. A recommendation is not a partnership.'],
  ['Understand service fees', 'Ask for all fees in writing, including whether any university pays them a commission.'],
  ['Ask what is included', 'Confirm exactly which services are covered, from shortlisting to visa documents.'],
  ['Check credentials where they apply', 'Immigration advice is regulated in many countries. Check any claimed authorization on the official register.'],
  ['Avoid guarantees', 'No consultant can guarantee admission, a visa, a scholarship, a job or permanent residence. Treat guarantees as a warning sign.'],
  ['Review written agreements', 'Read the agreement before paying, including refund terms and what happens if an application is unsuccessful.'],
  ['Verify through official sources', 'Confirm requirements, deadlines and fees with the university and the official government website.'],
] as const;
const FAQS = [
  ['Does Universta charge consultants for placement here?', 'No. The directory lists published consultant records in the catalogue order; there is no paid placement and no ranking.'],
  ['What does the “verified” badge mean?', 'It means an administrator has verified the record against a source and dated that check. An unverified profile is still published, just not yet checked.'],
  ['Are consultants rated or reviewed?', 'Not on Universta. We do not collect ratings, so none are shown — a star rating here would be invented.'],
  ['How do I contact a consultant?', 'Open the profile. Whatever contact details the consultant published — email, phone, website — appear there.'],
] as const;

export default async function ConsultantsPage() {
  const [list, directory, managed] = await Promise.all([
    phaseListAll<AnyRecord>('consultants').catch(() => null),
    getDestinations().catch(() => null),
    getListingPageContent('consultants-listing'),
  ]);
  const rows = toConsultantRows(list?.data ?? []);
  const options = consultantOptions(rows);
  const destinations = [...(directory?.available ?? []), ...(directory?.comingSoon ?? [])];
  const guideOf = new Map(destinations.flatMap((entry) => (entry.slug ? [[entry.slug, entry] as const] : [])));
  const guides = (directory?.available ?? []).flatMap((entry) => (entry.slug ? [entry.slug] : []));
  const n = (count: number, one: string, many: string) => `${formatNumber(count)} ${count === 1 ? one : many}`;

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'Consultants' }]} />
          <p className="hero__eyebrow">
            Study abroad consultants
            {rows.length ? (
              <>
                <b>·</b>
                {n(rows.length, 'listed', 'listed')}
                {options.destinations.length ? (
                  <>
                    <b>·</b>
                    {n(options.destinations.length, 'destination', 'destinations')}
                  </>
                ) : null}
              </>
            ) : null}
          </p>
          <h1 className="hero__h1">
            {managed.heading ?? 'Find study-abroad consultants you can research with confidence.'}
          </h1>
          <p className="hero__sub">
            {managed.lede ?? 'Explore consultants by destination, city and services — then connect through Universta.'}
          </p>
          <div className="bigsearch__wrap" style={{ marginTop: 22 }}>
            <CountryListSearch placeholder="Consultant, city or service" label="Search consultants" />
          </div>
          <div className="btn-row" style={{ marginTop: 18 }}>
            <button className="btn btn--accent" type="button" data-open-assessment data-intent="consultants-index">
              Help Me Find the Right Consultant{' '}
              <span className="btn__arrow" aria-hidden="true">
                &rarr;
              </span>
            </button>
            <a className="linkcta" href="#need">
              Do I need a consultant? <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </section>

      {list === null ? (
        <section className="sec sec--white sec--tight" id="consultants">
          <div className="wrap">
            <div className="h-empty h-empty--box" role="alert">
              <h3>Consultants could not be loaded</h3>
              <p>The directory did not respond just now. This is a problem on our side, not a sign that no consultants are published.</p>
              <Link className="btn" href={PATH}>
                Try again
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <CountryConsultantIndex rows={rows} countrySlug="" where="any destination" guides={guides} byDestination />
      )}

      <section className="sec sec--paper" id="need">
        <div className="wrap">
          <SectionHead
            eyebrow="Before you start"
            title="Do you need a study-abroad consultant?"
            lead="Many students apply without a consultant. Universities and official government websites publish everything an application needs, free of charge."
          />
          <div className="needgrid">
            <div className="needgrid__col">
              <p className="path__h">A consultant may help if</p>
              <ul className="ticklist">
                {NEED_YES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="needgrid__col">
              <p className="path__h">You may not need one if</p>
              <ul className="ticklist ticklist--muted">
                {NEED_NO.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {options.services.length ? (
        <section className="sec sec--white" id="services">
          <div className="wrap">
            <SectionHead
              eyebrow="Services"
              title="What consultants can help with"
              lead="Consultants list only the services they provide, so not every consultant offers every service."
            />
            <ul className="svclist svcgroups">
              {options.services.map((service) => (
                <li key={service.value}>
                  <Link className="svclist__item" href={`${consultantListHref(PATH, { services: [service.value] })}#consultants`}>
                    <b>{service.label}</b>
                    <em className="svclist__n">Listed by {formatNumber(service.count)}</em>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {options.destinations.length ? (
        <section className="sec sec--paper" id="destinations">
          <div className="wrap">
            <SectionHead
              eyebrow="By destination"
              title="Consultants by study destination"
              lead="Each destination page lists the consultants who support it, where they are and what they help with."
            />
            <div className="destgrid">
              {options.destinations.map((entry) => {
                const guide = guideOf.get(entry.value);
                const href = guide?.isAvailable
                  ? countryConsultantsHref(entry.value)
                  : `${consultantListHref(PATH, { destinations: [entry.value] })}#consultants`;
                return (
                  <Link className="destgrid__item" href={href} key={entry.value}>
                    <FlagMark iso2Code={guide?.iso2Code ?? null} bands={guide?.bands ?? null} />
                    <span className="destgrid__name">Study in {entry.label}</span>
                    <span className="destgrid__n">{formatNumber(entry.count)} listed</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {options.cities.length ? (
        <section className="sec sec--white sec--tight" id="cities">
          <div className="wrap">
            <div className="h-head">
              <p className="eyebrow eyebrow--plain">By city</p>
              <h2 className="sec-title">Study abroad consultants near you</h2>
            </div>
            <div className="citychips">
              {options.cities.map((city) => (
                <Link
                  className="specchip specchip--live"
                  href={`${consultantListHref(PATH, { cities: [city.value] })}#consultants`}
                  key={city.value}
                >
                  {city.label}
                  <em>{formatNumber(city.count)}</em>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="sec sec--paper" id="choose">
        <div className="wrap">
          <SectionHead
            eyebrow="Due diligence"
            title="How to choose a consultant"
            lead="Official guidance in several destinations warns students about unreliable agents and guarantees. These checks apply wherever you plan to study."
          />
          <ol className="choosegrid">
            {CHOOSE.map(([title, body], index) => (
              <li className="choosegrid__item" key={title}>
                <span className="choosegrid__n">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="choosegrid__t">{title}</h3>
                <p className="choosegrid__d">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec sec--white sec--tight" id="faq">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">Answers</p>
            <h2 className="sec-title">Frequently asked questions</h2>
          </div>
          <div className="faq">
            {FAQS.map(([q, a], index) => (
              <details className="faq__item" key={q} open={index === 0}>
                <summary className="faq__q">
                  <span>{q}</span>
                  <span className="faq__plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="faq__a" data-open="true">
                  <p>{a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <MatchBand
        eyebrow={{ n: 'Universta', label: 'Guidance' }}
        heading="Not sure which consultant is right for you?"
        lead="Tell Universta what you're planning to study and we'll help you explore relevant options."
        href="/counselling"
        talkHref={counsellingHref({ source: 'general', from: PATH })}
        assessment={{
          label: 'Find My Consultant Options',
          intent: 'consultants-index',
          note: 'Share your details with Universta to receive relevant consultant options and guidance. Consultants are independent service providers; Universta handles your request first and never sells your details.',
        }}
      />

      <ConnectBand
        actions={[
          { href: '/study-abroad', label: 'Compare destinations' },
          { href: '/universities', label: 'Browse universities', ghost: true },
          { href: '/scholarships', label: 'Find scholarships', ghost: true },
        ]}
      />
    </>
  );
}
