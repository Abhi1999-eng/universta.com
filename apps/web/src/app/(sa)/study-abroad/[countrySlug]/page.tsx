import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CostCalculator } from '@/components/study-abroad/CostCalculator';
import {
  CountryConnect,
  CountryCourses,
  CountryNumbers,
  CountryScholarships,
  CountrySubjects,
  CountryUniversities,
  type CountryCourseCard,
  type CountryScholarshipCard,
} from '@/components/study-abroad/CountryLinkSections';
import { FaqAccordion, StudyPaths } from '@/components/study-abroad/CountrySections';
import { EditorialSection } from '@/components/study-abroad/EditorialSection';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import { getCourses } from '@/lib/catalog';
import { phaseList } from '@/lib/phase1';
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
  /* The catalogue slices -- courses and scholarships for this destination --
     are read alongside the guide rather than after it, and a failure in either
     leaves its section out rather than taking the guide down with it. */
  const [page, directory, courseList, scholarshipList] = await Promise.all([
    getStudyAbroadCountry(countrySlug),
    getDestinations().catch(() => null),
    getCourses({ country: countrySlug, limit: '6' }).catch(() => null),
    phaseList<CountryScholarshipCard>('scholarships', {
      country: countrySlug,
      limit: '6',
    }).catch(() => null),
  ]);
  if (!page) notFound();

  const countryCourses = (courseList?.data ?? []) as CountryCourseCard[];
  const countryScholarships = scholarshipList?.data ?? [];

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
    /* Two items, matching the crumbs on the page: the destination listing is
       the homepage now, so a third "Study Abroad" item would name `/` twice. */
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteOrigin}/` },
      {
        '@type': 'ListItem',
        position: 2,
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
          {/* Two crumbs, not three: the destination listing that used to sit
              between home and a country guide is the homepage now, so a
              "Study Abroad" crumb would point at the same page as "Home". */}
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
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
            <h2 className="sec-title">Why study in {country.name}</h2>
            <div className="rulegrid rulegrid--3">
              {country.configuration.features.map((feature, index) => (
                <div className="rulegrid__item" key={feature.code}>
                  <span className="rulegrid__n" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="rulegrid__t">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* OVERVIEW */}
      {country.overview ? (
        <section className="sec sec--white" id="overview">
          <div className="wrap wrap--narrow">
            <p className="eyebrow">Overview</p>
            <h2 className="sec-title">About studying in {country.name}</h2>
            <div className="prose">
              <RichText value={country.overview} />
            </div>
          </div>
        </section>
      ) : null}

      <StudyPaths paths={paths} countryName={country.name} />

      {/* WHAT THIS DESTINATION HAS: universities, the fields they teach and the
          courses themselves. Each stands down when there is nothing published
          for this country rather than showing an empty shelf. */}
      <CountryUniversities country={country} />
      <CountrySubjects country={country} />
      <CountryCourses country={country} courses={countryCourses} />

      {/* DOCUMENTS */}
      {country.documents?.length ? (
        <section className="sec sec--white" id="documents">
          <div className="wrap">
            <p className="eyebrow">Admissions</p>
            <h2 className="sec-title">Documents you will need</h2>
            <div className="docs">
              {country.documents.map((document, index) => (
                <article className="doc" key={document.id}>
                  <span className="doc__box" aria-hidden="true" />
                  <span className="doc__n">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="doc__name">
                      {document.name}
                      <span className={`doc__badge badge${document.isRequired ? ' badge--req' : ''}`}>
                        {document.isRequired ? 'Required' : 'Optional'}
                      </span>
                    </h3>
                    {document.details ? (
                      <div className="doc__desc">
                        <RichText value={document.details} />
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* INTAKES */}
      {intakes.length ? (
        <section className="sec sec--paper" id="intakes">
          <div className="wrap">
            <p className="eyebrow">Timing</p>
            <h2 className="sec-title">Intakes in {country.name}</h2>
            <p className="sec-lead">
              {intakes.length} {intakes.length === 1 ? 'intake' : 'intakes'} a year. Applications
              open well ahead of the month teaching begins.
            </p>
            <div className="timeline">
              <div className="timeline__scroll">
                <div className="timeline__months">
                  {monthNames([1,2,3,4,5,6,7,8,9,10,11,12]).map((month) => {
                    const open = intakes.includes(month);
                    return (
                      <div className={`tm${open ? ' tm--on' : ''}`} key={month}>
                        <span className="tm__m">{month.slice(0, 3)}</span>
                        <span className="tm__bar" aria-hidden="true" />
                        <span className="sr-only">
                          {month}: {open ? 'intake available' : 'no intake'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* COST */}
      {profiles.cost || calculator ? (
        <section className="sec sec--white" id="cost">
          <div className="wrap">
            <p className="eyebrow">Money</p>
            <h2 className="sec-title">What it costs</h2>
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
            <h2 className="sec-title">Language requirements</h2>
            <div className="tracks">
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
                  <div className="track" key={name}>
                    <span className="track__n">{name}</span>
                    <span className="track__d">
                      {score ?? String(requirement).toLowerCase()}
                    </span>
                  </div>
                ))}
            </div>
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
            <h2 className="sec-title">After you arrive, and after you graduate</h2>
            <div className="journey">
              {work.map((item, index) => (
                <article className="jstep" key={item.title}>
                  <span className="jstep__dot" aria-hidden="true" />
                  <span className="jstep__n">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="jstep__t">{item.title}</h3>
                  {item.value ? <p className="jstep__m">{item.value}</p> : null}
                  {item.body ? (
                    <div className="jstep__b">
                      <RichText value={item.body} />
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* BY THE NUMBERS — every figure already published for this country. */}
      <CountryNumbers country={country} profiles={profiles} />

      {/* EDITORIAL SECTIONS — whatever an editor has published, in their order
          and in the shape each one declares. */}
      {sections.map((section, index) => (
        <EditorialSection key={section.id} section={section} alt={index % 2 === 1} />
      ))}

      {/* FUNDING */}
      <CountryScholarships country={country} scholarships={countryScholarships} />

      {/* GUIDANCE */}
      {consultantCards.length ? (
        <section className="sec sec--paper" id="guidance">
          <div className="wrap">
            <p className="eyebrow">Guidance</p>
            <h2 className="sec-title">Talk it through</h2>
            <div className="routes">
              {consultantCards.map((card, index) => (
                <article className="route" key={card.id}>
                  <span className="route__n">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="route__l">{card.title}</h3>
                  {card.shortDescription ? (
                    <p className="route__d">{card.shortDescription}</p>
                  ) : null}
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
        secondary={{ href: '/', label: 'Browse all destinations' }}
      />

      {/* EXPLORE NEXT */}
      <CountryConnect country={country} />

      {/* OTHER DESTINATIONS */}
      {others.length ? (
        <section className="sec sec--white sec--tight" id="other-destinations">
          <div className="wrap">
            <p className="eyebrow">Compare</p>
            <h2 className="sec-title">Other destinations</h2>
            <div className="switcher">
              {others.map((entry) => (
                <Link
                  className="switcher__item"
                  key={entry.name}
                  href={`/study-abroad/${entry.slug}`}
                >
                  <FlagMark name={entry.name} iso2Code={entry.iso2Code} bands={entry.bands} />
                  <span className="cchip__name">{entry.name}</span>
                  <span className="switcher__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
