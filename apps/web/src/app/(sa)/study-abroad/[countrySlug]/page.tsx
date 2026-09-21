import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CostCalculator } from '@/components/study-abroad/CostCalculator';
import {
  CountryCost,
  CountryDocuments,
  CountryGuidance,
  CountryIntakes,
  CountryLanguage,
  CountryOtherDestinations,
  CountryOverview,
  CountryWhy,
  CountryWorkVisa,
} from '@/components/study-abroad/CountryGuideSections';
import {
  CountryConnect,
  CountryCourses,
  CountryNumbers,
  countryUniversities,
  hasCountryFigures,
  CountryScholarships,
  CountrySubjects,
  CountryTestimonials,
  CountryUniversities,
  type CountryCourseCard,
  type CountryScholarshipCard,
} from '@/components/study-abroad/CountryLinkSections';
import { FaqAccordion, StudyPaths } from '@/components/study-abroad/CountrySections';
import { EditorialSection, editorialRenders } from '@/components/study-abroad/EditorialSection';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { richTextToPlainText } from '@/components/phase1/RichText';
import { getCourses } from '@/lib/catalog';
import { phaseList } from '@/lib/phase1';
import { getDestinations, getStudyAbroadCountry, otherDestinations } from '@/lib/study-abroad';
import { siteOrigin } from '@/lib/site-origin';
import { jsonLdString } from '@/lib/json-ld';
import {
  alternatingBands,
  costBreakdown,
  countrySnapshot,
  intakeCards,
  languageRows,
  monthNames,
  sectionNumbers,
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
  const testimonials = page.testimonials ?? [];
  const snapshot = countrySnapshot(page);
  const paths = studyPathsFor(page);
  const calculator = country.configuration?.calculator ?? null;
  const currencySymbol = country.currency?.symbol ?? '';
  const others = directory ? otherDestinations(directory, country.slug) : [];
  const bands = directory?.available.find((entry) => entry.slug === country.slug)?.bands ?? null;
  const work = workSummary(profiles);
  const intakes = monthNames(country.configuration?.intakeMonths ?? []);

  /* The hero keeps its lead to a sentence or two, as the design does. A longer
     short description would push the calls to action below the fold, so it
     opens the overview instead and the hero uses the design's own line. */
  const shortText = country.shortDescription ? richTextToPlainText(country.shortDescription) : '';
  const heroSub =
    shortText && shortText.length <= 240
      ? shortText
      : 'Explore universities, costs, admission requirements, intakes, language requirements and career pathways — all in one place.';
  const overviewLead = shortText.length > 240 ? shortText : null;
  const editorial = sections.filter(editorialRenders);
  const language = profiles.language;
  const languageRenders = Boolean(
    language &&
      (languageRows(language).length ||
        language.generalNotes ||
        (language.languageWaiverAvailable && language.waiverNotes)),
  );
  const costRenders = Boolean(
    costBreakdown(profiles.cost).rows.length ||
      calculator ||
      profiles.cost?.tuitionNotes ||
      profiles.cost?.livingCostNotes,
  );

  /**
   * What renders, in the design's order, and what each section gets from its
   * place in that run.
   *
   * The guide alternates paper and white, and numbers its sections from 01.
   * Neither can be fixed section by section: the editorial run differs in
   * length per country and most sections stand down when the country has
   * nothing to put in them, so any fixed choice reads correctly on one country
   * and, on the next, puts two identical bands side by side or skips a number.
   *
   * So the page lists what will actually render, in order, and hands each one
   * its band and its number. The navy sections take no band -- they separate
   * whatever sits either side of them -- and the closing sections after the
   * questions take no number, as in the design.
   */
  const run = [
    country.configuration?.features?.length ? 'why' : null,
    country.overview || overviewLead ? 'overview' : null,
    paths.length ? 'study-paths' : null,
    countryUniversities(country).length ? 'universities' : null,
    country.subjects?.length ? 'subjects' : null,
    countryCourses.length ? 'courses' : null,
    country.documents?.length ? 'documents' : null,
    intakes.length || intakeCards(profiles.intakes).length ? 'intakes' : null,
    costRenders ? 'cost' : null,
    languageRenders ? 'language' : null,
    work.length ? 'work-visa' : null,
    hasCountryFigures(country, profiles) ? 'numbers' : null,
    ...editorial.map((section) => `editorial:${section.id}`),
    consultantCards.length ? 'guidance' : null,
    testimonials.length ? 'testimonials' : null,
    faqs.length ? 'faq' : null,
  ].filter((id): id is string => Boolean(id));
  const closing = [
    countryScholarships.length ? 'scholarship-funding' : null,
    others.length ? 'other-destinations' : null,
    'connect',
  ].filter((id): id is string => Boolean(id));

  const NAVY = new Set(['work-visa']);
  const band = alternatingBands([...run, ...closing].filter((id) => !NAVY.has(id)));
  const number = sectionNumbers(run);

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
                {country.iso2Code ? (
                  <>
                    <b>·</b>
                    {country.iso2Code}
                  </>
                ) : null}
              </p>
              {/* The design's display name. Decorative: the heading below
                  already says it, so it is not announced twice. */}
              <p
                className="hero__display"
                aria-hidden="true"
                style={{ '--namelen': country.name.length } as React.CSSProperties}
              >
                {country.name}
              </p>
              {bands ? (
                <div className="hero__bands" aria-hidden="true">
                  {bands.map((colour, index) => (
                    <span key={`${colour}-${index}`} style={{ background: colour }} />
                  ))}
                </div>
              ) : null}
              <h1 className="hero__h1">{country.pageHeading ?? `Study in ${country.name}`}</h1>
              <p className="hero__sub">{heroSub}</p>
              <p className="hero__promise">{country.tagline ?? 'Build your path with clarity.'}</p>

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

      <CountryWhy country={country} n={number('why')} alt={band('why')} />
      <CountryOverview
        country={country}
        lead={overviewLead}
        n={number('overview')}
        alt={band('overview')}
      />
      <StudyPaths
        paths={paths}
        countryName={country.name}
        fields={(country.subjects ?? []).slice(0, 6).map((subject) => subject.name)}
        n={number('study-paths')}
        alt={band('study-paths')}
      />

      {/* WHAT THIS DESTINATION HAS: universities, the fields they teach and the
          courses themselves. Each stands down when there is nothing published
          for this country rather than showing an empty shelf. */}
      <CountryUniversities country={country} n={number('universities')} alt={band('universities')} />
      <CountrySubjects country={country} n={number('subjects')} alt={band('subjects')} />
      <CountryCourses
        country={country}
        courses={countryCourses}
        n={number('courses')}
        alt={band('courses')}
      />

      <CountryDocuments country={country} n={number('documents')} alt={band('documents')} />
      <CountryIntakes
        country={country}
        profiles={profiles}
        n={number('intakes')}
        alt={band('intakes')}
      />
      <CountryCost
        country={country}
        profiles={profiles}
        calculator={
          calculator ? (
            <CostCalculator
              config={calculator}
              currencySymbol={currencySymbol}
              countryName={country.name}
              countrySlug={country.slug}
              disclaimer={profiles.cost?.disclaimer ?? null}
            />
          ) : null
        }
        n={number('cost')}
        alt={band('cost')}
      />
      <CountryLanguage
        country={country}
        profiles={profiles}
        n={number('language')}
        alt={band('language')}
      />
      <CountryWorkVisa country={country} profiles={profiles} work={work} n={number('work-visa')} />

      {/* BY THE NUMBERS — every figure already published for this country. */}
      <CountryNumbers country={country} profiles={profiles} n={number('numbers')} alt={band('numbers')} />

      {/* EDITORIAL SECTIONS — whatever an editor has published, in their order
          and in the shape each one declares. */}
      {editorial.map((section) => (
        <EditorialSection
          key={section.id}
          section={section}
          n={number(`editorial:${section.id}`)}
          alt={band(`editorial:${section.id}`)}
        />
      ))}

      <CountryGuidance cards={consultantCards} n={number('guidance')} alt={band('guidance')} />
      <CountryTestimonials
        country={country}
        testimonials={testimonials}
        n={number('testimonials')}
        alt={band('testimonials')}
      />
      <FaqAccordion
        faqs={faqs.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer }))}
        countryName={country.name}
        n={number('faq')}
        alt={band('faq')}
      />

      {/* FUNDING — after the questions, unnumbered, as in the design. */}
      <CountryScholarships
        country={country}
        scholarships={countryScholarships}
        alt={band('scholarship-funding')}
      />

      <PlanBand
        heading={`Ready to plan your move to ${country.name}?`}
        body="Tell us about your academic profile, goals and budget, and a counsellor will match it against live programmes."
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{ href: '/', label: 'Browse all destinations' }}
      />

      <CountryOtherDestinations
        country={country}
        others={others}
        alt={band('other-destinations')}
      />

      {/* EXPLORE NEXT */}
      <CountryConnect country={country} alt={band('connect')} />
    </>
  );
}
