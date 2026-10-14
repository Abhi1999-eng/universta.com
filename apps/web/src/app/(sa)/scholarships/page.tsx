import type { Metadata } from 'next';
import Link from 'next/link';
import { CountryListSearch } from '@/components/study-abroad/CountryListSearch';
import { CountryScholarshipIndex } from '@/components/study-abroad/CountryScholarshipIndex';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { ConnectBand, MatchBand } from '@/components/study-abroad/DiscoveryBands';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { ScholarshipSupport } from '@/components/study-abroad/ScholarshipSupport';
import { SectionHead } from '@/components/study-abroad/SectionHead';
import { getSubjects } from '@/lib/catalog';
import {
  countryScholarshipsHref,
  isNarrowedScholarshipList,
  scholarshipListHref,
  scholarshipOptions,
} from '@/lib/country-scholarship-list';
import { formatNumber } from '@/lib/format';
import { getListingPageContent } from '@/lib/listing-page-content';
import { loadScholarshipRows } from '@/lib/scholarship-list-server';
import { staticPageMetadata } from '@/lib/static-page-seo';
import { getDestinations } from '@/lib/study-abroad';

/**
 * The worldwide scholarship finder, as the client's zip draws it: a hero
 * with the catalogue at a glance, the finder with its filters, then the
 * awards by what they fund, by destination and by university, why the
 * finder, the answers, the support band and the match band.
 *
 * It narrows in the browser over every published award, as a destination's
 * own funding page does, so each count on the page is true; the destination
 * and university filters are the worldwide view's own, under the names the
 * older finder's links already carry (`?country=`, `?university=`,
 * `?degreeLevel=`, `?type=`). A subject is still asked of the API, as it
 * was, since the list's rows do not name their subjects.
 */
export const dynamic = 'force-dynamic';

const PATH = '/scholarships';

/** How many destinations the "by country" grid shows: the ones with the
 * most awards. The finder's own filter offers every one. */
const DESTINATIONS_SHOWN = 18;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** What each stored funding type means, in the zip's words where it has
 * them; a type it does not know is described by its own label alone. */
const FUNDING_MEANS: Record<string, string> = {
  FULL_FUNDING: 'Tuition, living and other eligible expenses',
  FULL_TUITION: 'All tuition fees',
  PARTIAL_FUNDING: 'Part of tuition or living costs',
  PARTIAL_TUITION: 'Some of the tuition fee',
  TUITION_REDUCTION: 'A reduction on the tuition fee',
  LIVING_ALLOWANCE: 'A contribution to living costs',
  FIXED_GRANT: 'A one-off sum',
  RESEARCH_FUNDING: 'Research grants, studentships and fellowships',
};

const WHY = [
  ['Published directory', 'Funding opportunities from universities, governments and organisations, kept in one place.'],
  ['Search and filters', 'Narrow results by destination, university, study level and funding type.'],
  ['Traceable to the provider', 'Scholarship details are recorded against the provider that publishes them.'],
  ['Shortlist as you go', 'Open any award to see eligibility, amount and deadline in full before you apply.'],
  ['Application guidance', 'Talk to a counsellor about eligibility, documents and submission.'],
  ['Destination context', 'See the destination and university each award belongs to before applying.'],
] as const;

const FAQS = [
  ['What is a fully funded scholarship?', 'A fully funded scholarship covers all major study costs — usually tuition, living expenses, travel and sometimes health insurance — so you can study abroad with little to no personal financial burden.'],
  ['Who can apply for international scholarships?', 'Eligibility varies by award. Most are open to students who hold or plan to apply for a place at an eligible institution and who meet the academic, language, nationality and field-of-study conditions set by the funder.'],
  ['How do I find scholarships for my course?', 'Use the filters on this page to narrow scholarships by destination, university, study level and funding type — or browse by what they fund and by country below.'],
  ['Can I apply for multiple scholarships?', 'Yes. You can apply to as many scholarships as you are eligible for. Build a shortlist and keep track of every deadline.'],
  ['Do scholarships cover living expenses?', 'Some do. Fully funded awards usually include a living stipend, while partial or tuition-waiver scholarships may not. Every scholarship page says what the record states the funding covers.'],
  ['When should I apply?', 'Most deadlines fall several months before the intake, often alongside or before your university application. Apply as early as you can.'],
  ['How can Universta help with scholarship applications?', 'Universta gives you a published scholarship directory, filters to narrow it down, and access to counsellors who can guide you through eligibility, documents and submission.'],
] as const;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'scholarships-listing',
    'Scholarships',
    'Explore currently published scholarships and their eligibility details.',
    PATH,
  );
  return {
    ...metadata,
    /* The helper writes the site's suffix; the route family's template would add it again. */
    title: { absolute: String(metadata.title) },
    ...(isNarrowedScholarshipList(await searchParams) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ScholarshipsPage({ searchParams }: Props) {
  const raw = await searchParams;
  const subjectSlug = typeof raw.subject === 'string' ? raw.subject.trim().slice(0, 100) : '';
  const [loaded, directory, managed, subjects] = await Promise.all([
    loadScholarshipRows(subjectSlug ? { subject: subjectSlug } : {}),
    getDestinations().catch(() => null),
    getListingPageContent('scholarships-listing'),
    subjectSlug
      ? getSubjects({ limit: '100' })
          .then((result) => result.data)
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  const { rows, levels, failed } = loaded;
  const subject = subjectSlug
    ? (subjects.find((entry) => entry.slug === subjectSlug)?.name ?? subjectSlug)
    : null;
  const options = scholarshipOptions(rows, levels);
  const guides = new Set((directory?.available ?? []).flatMap((entry) => (entry.slug ? [entry.slug] : [])));
  const iso2 = new Map(
    rows.flatMap((row) => row.countries.flatMap((place) => (place.slug && place.iso2 ? [[place.slug, place.iso2] as const] : []))),
  );
  const providers = new Set(rows.map((row) => row.provider).filter(Boolean)).size;
  const fullyFunded = rows.filter((row) => row.type === 'FULL_FUNDING').length;
  const untyped = rows.length - rows.filter((row) => row.type).length;
  const bars = options.types.slice(0, 8);
  const n = (count: number, one: string, many: string) => `${formatNumber(count)} ${count === 1 ? one : many}`;

  return (
    <>
      <section className="hero hero--compact schhero">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'Scholarships' }]} />
          <div className="schhero__grid">
            <div>
              <p className="hero__eyebrow">
                {subject ? `Scholarships for ${subject}` : 'Fund your study abroad journey'}
                {rows.length ? (
                  <>
                    <b>·</b>
                    {n(rows.length, 'scholarship', 'scholarships')}
                  </>
                ) : null}
              </p>
              <h1 className="hero__h1">
                {managed.heading ?? 'Find scholarships that can help fund your education abroad.'}
              </h1>
              <p className="hero__sub">
                {failed
                  ? 'The scholarships could not be loaded just now. Please try again shortly.'
                  : (managed.lede ??
                    'Explore scholarships, grants, fellowships and funding opportunities by destination, university, study level and funding type.')}
              </p>
              {rows.length ? (
                <div className="bigsearch__wrap" style={{ marginTop: 22 }}>
                  <CountryListSearch placeholder="Search scholarships, providers or funding" label="Search scholarships" />
                </div>
              ) : null}
              <div className="btn-row" style={{ marginTop: 18 }}>
                <button className="btn btn--lg" type="button" data-open-assessment data-intent="scholarships">
                  Find Scholarships for Me{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </button>
                {rows.length ? (
                  <a className="btn btn--lg btn--ghost" href="#scholarships">
                    Browse scholarships
                  </a>
                ) : null}
                {subject ? (
                  <Link className="linkcta" href={PATH}>
                    All scholarships <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
                  </Link>
                ) : null}
              </div>
            </div>

            {rows.length ? (
              <figure className="ledger" aria-label="Scholarship catalogue at a glance">
                <div className="ledger__nums">
                  <div>
                    <b className="datum">{formatNumber(rows.length)}</b>
                    <span>{rows.length === 1 ? 'scholarship' : 'scholarships'}</span>
                  </div>
                  {fullyFunded ? (
                    <div>
                      <b className="datum">{formatNumber(fullyFunded)}</b>
                      <span>described as fully funded</span>
                    </div>
                  ) : null}
                  {options.destinations.length ? (
                    <div>
                      <b className="datum">{formatNumber(options.destinations.length)}</b>
                      <span>{options.destinations.length === 1 ? 'destination' : 'destinations'}</span>
                    </div>
                  ) : null}
                  {providers ? (
                    <div>
                      <b className="datum">{formatNumber(providers)}</b>
                      <span>{providers === 1 ? 'provider' : 'providers'}</span>
                    </div>
                  ) : null}
                </div>
                {bars.length ? (
                  <>
                    <figcaption className="label">What the funding covers</figcaption>
                    <ul className="ledger__bars">
                      {bars.map((type) => (
                        <li key={type.value}>
                          <span className="ledger__name">{type.label}</span>
                          <span className="ledger__track">
                            <i style={{ width: `${Math.max(2, Math.round((type.count / rows.length) * 100))}%` }} />
                          </span>
                          <b className="datum">{formatNumber(type.count)}</b>
                        </li>
                      ))}
                    </ul>
                    <p className="ledger__note">
                      As each record states it.
                      {untyped ? ` ${n(untyped, 'award states', 'awards state')} no funding type.` : ''}
                    </p>
                  </>
                ) : null}
              </figure>
            ) : null}
          </div>
        </div>
      </section>

      {failed ? (
        <section className="sec sec--white sec--tight" id="scholarships">
          <div className="wrap">
            <div className="h-empty h-empty--box" role="alert">
              <h3>Scholarships could not be loaded</h3>
              <p>The finder did not respond just now. This is a problem on our side, not a sign that no scholarship is published.</p>
              <Link className="btn" href={PATH}>
                Try again
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <CountryScholarshipIndex
          rows={rows}
          levels={levels}
          where="any destination"
          heading={subject ? `Scholarships for ${subject}` : 'Published scholarships'}
          none={subject ? `No scholarship for ${subject} is published yet.` : 'No scholarship is published yet.'}
          byDestination
          byUniversity
        />
      )}

      {options.types.length ? (
        <section className="sec sec--paper" id="funding">
          <div className="wrap">
            <SectionHead
              eyebrow="Explore by funding"
              title="What do you need funded?"
              lead="Each path opens the matching scholarships. Coverage is what each scholarship's own record states."
            />
            <div className="fundgrid">
              {options.types.map((type) => (
                <Link
                  className="fundcard"
                  href={`${scholarshipListHref(PATH, { types: [type.value] })}#scholarships`}
                  key={type.value}
                >
                  <span className="fundcard__n datum">{formatNumber(type.count)}</span>
                  <b className="fundcard__t">{type.label}</b>
                  <span className="fundcard__d">{FUNDING_MEANS[type.value] ?? `Awards described as ${type.label.toLowerCase()}`}</span>
                  <span className="fundcard__cta">
                    Explore <span aria-hidden="true">&rarr;</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {options.destinations.length ? (
        <section className="sec sec--white" id="destinations">
          <div className="wrap">
            <SectionHead
              eyebrow="By destination"
              title="Scholarships by country"
              lead="Each destination's own funding page lists the awards for it, beside its universities and subjects."
            />
            <div className="destgrid">
              {options.destinations.slice(0, DESTINATIONS_SHOWN).map((entry) => (
                <Link
                  className="destgrid__item"
                  href={
                    guides.has(entry.value)
                      ? countryScholarshipsHref(entry.value)
                      : `${scholarshipListHref(PATH, { destinations: [entry.value] })}#scholarships`
                  }
                  key={entry.value}
                >
                  <FlagMark iso2Code={iso2.get(entry.value) ?? null} bands={null} />
                  <span className="destgrid__name">Scholarships in {entry.label}</span>
                  <span className="destgrid__n">{formatNumber(entry.count)} listed</span>
                </Link>
              ))}
            </div>
            {options.destinations.length > DESTINATIONS_SHOWN ? (
              <p className="h-more">
                <a className="linkcta" href="#scholarships">
                  Every destination is in the finder&rsquo;s filters{' '}
                  <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
                </a>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {options.universities.length ? (
        <section className="sec sec--paper sec--tight" id="universities">
          <div className="wrap">
            <div className="h-head">
              <p className="eyebrow eyebrow--plain">By university</p>
              <h2 className="sec-title">Scholarships linked to a university</h2>
            </div>
            <div className="citychips">
              {options.universities.map((entry) => (
                <Link
                  className="specchip specchip--live"
                  href={`${scholarshipListHref(PATH, { universities: [entry.value] })}#scholarships`}
                  key={entry.value}
                >
                  {entry.label}
                  <em>{formatNumber(entry.count)}</em>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="sec sec--white" id="why">
        <div className="wrap">
          <SectionHead
            eyebrow="Why Universta"
            title="Why use the Universta scholarship finder?"
            lead="Everything you need to find and shortlist funding for your studies abroad."
          />
          <div className="h-grid h-grid--3">
            {WHY.map(([title, body]) => (
              <div className="h-card" key={title}>
                <strong className="h-card__t">{title}</strong>
                <span className="h-card__d">{body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec sec--paper sec--tight" id="faq">
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
        eyebrow={{ n: 'Profile match', label: 'Scholarship matching' }}
        heading="What funding could be relevant to you?"
        lead="Tell us your destination, level, subject and background. We look at each award's published eligibility and explain what we find."
        href="/counselling?source=scholarships"
        talkHref="/counselling?source=scholarships"
        assessment={{
          label: 'Find Scholarships for Me',
          intent: 'scholarships',
          note: "Final eligibility depends on the scholarship provider's official requirements.",
        }}
      />

      <ScholarshipSupport />

      <ConnectBand
        actions={[
          { href: '/study-abroad', label: 'Compare destinations' },
          { href: '/universities', label: 'Browse universities', ghost: true },
          { href: '/courses', label: 'Explore courses', ghost: true },
          { href: '/study-abroad-consultants', label: 'Find a consultant', ghost: true },
        ]}
      />
    </>
  );
}
