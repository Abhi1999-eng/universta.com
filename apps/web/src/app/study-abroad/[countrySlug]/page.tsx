import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CostCalculator } from '@/components/study-abroad/CostCalculator';
import { FaqAccordion, StudyPaths } from '@/components/study-abroad/CountrySections';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { getDestinations, getStudyAbroadCountry, otherDestinations } from '@/lib/study-abroad';
import { siteOrigin } from '@/lib/site-origin';
import { jsonLdString } from '@/lib/json-ld';
import {
  countrySnapshot,
  monthNames,
  studyPathsFor,
  workSummary,
} from '@/lib/study-abroad-view';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ countrySlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { countrySlug } = await params;
  const page = await getStudyAbroadCountry(countrySlug);
  if (!page) return { title: 'Destination not found' };
  const { country, seo } = page;
  const title = seo?.seoTitle ?? `${country.pageHeading ?? `Study in ${country.name}`}`;
  const description =
    seo?.metaDescription ??
    (country.shortDescription ? richTextToPlainText(country.shortDescription).slice(0, 300) : '');
  return {
    title,
    description,
    /* The guide lives at /study-abroad/<slug>; the old /countries URL redirects
     * here, so this is the only address search engines are pointed at. */
    alternates: { canonical: `${siteOrigin}/study-abroad/${country.slug}` },
    openGraph: {
      title,
      description,
      url: `${siteOrigin}/study-abroad/${country.slug}`,
    },
  };
}

export default async function StudyAbroadCountryPage({ params }: Params) {
  const { countrySlug } = await params;
  const [page, directory] = await Promise.all([
    getStudyAbroadCountry(countrySlug),
    getDestinations().catch(() => null),
  ]);
  if (!page) notFound();

  const { country, profiles, sections, faqs, consultantCards } = page;
  const snapshot = countrySnapshot(page);
  const paths = studyPathsFor(page);
  const calculator = country.configuration?.calculator ?? null;
  const currencySymbol = country.currency?.symbol ?? '';
  const others = directory ? otherDestinations(directory, country.slug) : [];
  const bands = directory?.available.find((entry) => entry.slug === country.slug)?.bands ?? null;
  const work = workSummary(profiles);
  const intakes = monthNames(country.configuration?.intakeMonths ?? []);

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteOrigin}/` },
      { '@type': 'ListItem', position: 2, name: 'Study Abroad', item: `${siteOrigin}/study-abroad` },
      {
        '@type': 'ListItem',
        position: 3,
        name: country.name,
        item: `${siteOrigin}/study-abroad/${country.slug}`,
      },
    ],
  };
  const faqJsonLd = faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.slice(0, 10).map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: richTextToPlainText(faq.answer) },
        })),
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbs) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
        />
      ) : null}

      {/* HERO */}
      <section className="hero">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href="/study-abroad">Study Abroad</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{country.name}</span>
          </nav>

          <div className="hero__grid">
            <div className="hero__main">
              <p className="hero__eyebrow">
                Study abroad
                {country.continent ? <> · {country.continent.name}</> : null}
                {country.flag?.emoji ? <b>·</b> : null}
                {country.flag?.emoji ?? ''}
              </p>
              {bands ? (
                <div className="hero__bands" aria-hidden="true">
                  {bands.map((colour, index) => (
                    <span key={`${colour}-${index}`} style={{ background: colour }} />
                  ))}
                </div>
              ) : null}
              <h1 className="hero__h1">{country.pageHeading ?? `Study in ${country.name}`}</h1>
              {country.tagline ? <p className="hero__promise">{country.tagline}</p> : null}
              {country.shortDescription ? (
                <div className="hero__sub">
                  <RichText value={country.shortDescription} />
                </div>
              ) : null}

              <div className="btn-row hero__actions">
                <button className="btn btn--lg" type="button" data-open-assessment>
                  Check My Eligibility{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </button>
                {paths.length ? (
                  <a className="btn btn--lg btn--ghost" href="#study-paths">
                    Explore study paths
                  </a>
                ) : null}
              </div>

              <p className="hero__micro">
                <span>
                  <i aria-hidden="true" />
                  5-minute assessment
                </span>
                <span>
                  <i aria-hidden="true" />
                  Free, no obligation
                </span>
                <span>
                  <i aria-hidden="true" />
                  No sign-up to start
                </span>
              </p>
            </div>

            {/* Every row is a published figure. A row with nothing behind it is
                left out rather than shown empty, which is why this panel is
                never half blank. */}
            {snapshot.length ? (
              <aside className="snap" aria-label={`${country.name} country snapshot`}>
                <div className="snap__head">
                  <span className="snap__title">Country snapshot</span>
                  <span className="cchip" aria-hidden="true">
                    <FlagMark name={country.name} iso2Code={country.iso2Code ?? null} bands={bands} />
                  </span>
                </div>
                {snapshot.map((row) => (
                  <div className="snap__row" key={row.label}>
                    <span className="snap__k">{row.label}</span>
                    <span className="snap__v">{row.value}</span>
                    {row.note ? <span className="snap__n">{row.note}</span> : null}
                  </div>
                ))}
                <div className="snap__foot">
                  <button className="btn btn--block" type="button" data-open-assessment>
                    Build My Study Plan{' '}
                    <span className="btn__arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </button>
                  <p className="snap__disclaimer">
                    Indicative ranges for international students. Confirm current figures with
                    the university and the relevant official authority.
                  </p>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </section>

      {/* WHY — the features an editor ticked for this country */}
      {country.configuration?.features?.length ? (
        <section className="sec sec--paper" id="why">
          <div className="wrap">
            <p className="eyebrow">The case for {country.name}</p>
            <h2 className="sec__h">Why study in {country.name}</h2>
            <ul className="feat">
              {country.configuration.features.map((feature) => (
                <li className="feat__i" key={feature.code}>
                  <span className="feat__d" aria-hidden="true" />
                  {feature.label}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* OVERVIEW */}
      {country.overview ? (
        <section className="sec sec--white" id="overview">
          <div className="wrap wrap--narrow">
            <p className="eyebrow">Overview</p>
            <h2 className="sec__h">About studying in {country.name}</h2>
            <div className="prose">
              <RichText value={country.overview} />
            </div>
          </div>
        </section>
      ) : null}

      <StudyPaths paths={paths} countryName={country.name} />

      {/* DOCUMENTS */}
      {country.documents?.length ? (
        <section className="sec sec--white" id="documents">
          <div className="wrap">
            <p className="eyebrow">Admissions</p>
            <h2 className="sec__h">Documents you will need</h2>
            <ul className="docs">
              {country.documents.map((document) => (
                <li className="docs__i" key={document.id}>
                  <div className="docs__h">
                    <span className="docs__n">{document.name}</span>
                    <span className={`docs__t${document.isRequired ? ' is-req' : ''}`}>
                      {document.isRequired ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  {document.details ? (
                    <div className="docs__d">
                      <RichText value={document.details} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* INTAKES */}
      {intakes.length ? (
        <section className="sec sec--paper" id="intakes">
          <div className="wrap">
            <p className="eyebrow">Timing</p>
            <h2 className="sec__h">Intakes in {country.name}</h2>
            <p className="sec__s">
              {intakes.length} {intakes.length === 1 ? 'intake' : 'intakes'} a year. Applications
              open well ahead of the month teaching begins.
            </p>
            <ul className="chips">
              {intakes.map((month) => (
                <li key={month}>{month}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* COST */}
      {profiles.cost || calculator ? (
        <section className="sec sec--white" id="cost">
          <div className="wrap">
            <p className="eyebrow">Money</p>
            <h2 className="sec__h">What it costs</h2>
            {profiles.cost?.tuitionNotes ? (
              <div className="prose">
                <RichText value={profiles.cost.tuitionNotes} />
              </div>
            ) : null}
            {calculator ? (
              <CostCalculator
                config={calculator}
                currencySymbol={currencySymbol}
                countryName={country.name}
                countrySlug={country.slug}
                disclaimer={profiles.cost?.disclaimer ?? null}
              />
            ) : null}
            {profiles.cost?.livingCostNotes ? (
              <div className="prose">
                <RichText value={profiles.cost.livingCostNotes} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* LANGUAGE */}
      {profiles.language ? (
        <section className="sec sec--paper" id="language">
          <div className="wrap">
            <p className="eyebrow">English</p>
            <h2 className="sec__h">Language requirements</h2>
            <ul className="tests">
              {(
                [
                  ['IELTS', profiles.language.ieltsRequirement, profiles.language.ieltsMinScore],
                  ['TOEFL', profiles.language.toeflRequirement, profiles.language.toeflMinScore],
                  ['PTE', profiles.language.pteRequirement, profiles.language.pteMinScore],
                  [
                    'Duolingo',
                    profiles.language.duolingoRequirement,
                    profiles.language.duolingoMinScore,
                  ],
                ] as const
              )
                .filter(([, requirement]) => requirement && requirement !== 'NOT_REQUIRED')
                .map(([name, requirement, score]) => (
                  <li className="tests__i" key={name}>
                    <span className="tests__n">{name}</span>
                    <span className="tests__v">{score ?? String(requirement).toLowerCase()}</span>
                  </li>
                ))}
            </ul>
            {profiles.language.generalNotes ? (
              <div className="prose">
                <RichText value={profiles.language.generalNotes} />
              </div>
            ) : null}
            {profiles.language.languageWaiverAvailable && profiles.language.waiverNotes ? (
              <div className="prose">
                <RichText value={profiles.language.waiverNotes} />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* WORK AND VISA */}
      {work.length ? (
        <section className="sec sec--navy" id="work-visa">
          <div className="wrap">
            <p className="eyebrow eyebrow--plain">Work and visa</p>
            <h2 className="sec__h">After you arrive, and after you graduate</h2>
            <div className="wv">
              {work.map((item) => (
                <article className="wv__c" key={item.title}>
                  <h3>{item.title}</h3>
                  {item.value ? <p className="wv__v">{item.value}</p> : null}
                  {item.body ? (
                    <div className="wv__b">
                      <RichText value={item.body} />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* EDITORIAL SECTIONS — whatever an editor has published, in their order */}
      {sections.map((section) => (
        <section className="sec sec--white" id={`country-${section.sectionKey}`} key={section.id}>
          <div className="wrap wrap--narrow">
            {section.eyebrow ? <p className="eyebrow">{section.eyebrow}</p> : null}
            {section.heading ? <h2 className="sec__h">{section.heading}</h2> : null}
            {section.subheading ? <p className="sec__s">{section.subheading}</p> : null}
          </div>
        </section>
      ))}

      {/* GUIDANCE */}
      {consultantCards.length ? (
        <section className="sec sec--paper" id="guidance">
          <div className="wrap">
            <p className="eyebrow">Guidance</p>
            <h2 className="sec__h">Talk it through</h2>
            <div className="guide">
              {consultantCards.map((card) => (
                <article className="guide__c" key={card.id}>
                  <h3>{card.title}</h3>
                  {card.shortDescription ? <p>{card.shortDescription}</p> : null}
                  {card.ctaUrl ? (
                    <a className="linkcta" href={card.ctaUrl}>
                      {card.ctaLabel ?? 'Find out more'}{' '}
                      <span className="linkcta__arrow" aria-hidden="true">
                        &rarr;
                      </span>
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <FaqAccordion
        faqs={faqs.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer }))}
        countryName={country.name}
      />

      <PlanBand
        heading={`Ready to plan your move to ${country.name}?`}
        body="Tell us about your academic profile, goals and budget, and a counsellor will match it against live programmes."
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{ href: '/study-abroad', label: 'Browse all destinations' }}
      />

      {/* OTHER DESTINATIONS */}
      {others.length ? (
        <section className="sec sec--white sec--tight" id="other-destinations">
          <div className="wrap">
            <p className="eyebrow">Compare</p>
            <h2 className="sec__h">Other destinations</h2>
            <div className="dir__grid">
              {others.map((entry) => (
                <Link
                  className="dir__card"
                  key={entry.name}
                  href={`/study-abroad/${entry.slug}`}
                >
                  <FlagMark name={entry.name} iso2Code={entry.iso2Code} bands={entry.bands} />
                  <span className="cchip__name">{entry.name}</span>
                  <span className="dir__meta">Guide</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
