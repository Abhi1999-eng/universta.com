import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CostCalculator } from '@/components/study-abroad/CostCalculator';
import { RecordVisit } from '@/components/study-abroad/ContinueJourney';
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
  countryCourses,
  CountryNumbers,
  countryUniversities,
  hasCountryFigures,
  CountryScholarships,
  CountrySubjects,
  CountryTestimonials,
  CountryUniversities,
  type CountryCourseCard,
} from '@/components/study-abroad/CountryLinkSections';
import { FaqAccordion, StudyPaths } from '@/components/study-abroad/CountrySections';
import { CountryConsultants } from '@/components/study-abroad/CountryConsultants';
import { EditorialSection, editorialRenders } from '@/components/study-abroad/EditorialSection';
import { FlagMark } from '@/components/study-abroad/FlagMark';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { CountrySectionJumps, CountryTabs } from '@/components/study-abroad/CountryTabs';
import { loadCountryTabs, tabCounts } from '@/lib/country-tabs';
import { richTextToPlainText } from '@/components/phase1/RichText';
import { getCourseFilterOptions, getCourses, getSubjects } from '@/lib/catalog';
import { inCountry } from '@/lib/country-article';
import { countryConsultantsHref } from '@/lib/country-consultant-list';
import { universityHref } from '@/lib/university-links';
import { phaseList } from '@/lib/phase1';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { toScholarshipCards } from '@/lib/scholarship-card';
import { getDestinations, getStudyAbroadCountry, otherDestinations } from '@/lib/study-abroad';
import { siteOrigin } from '@/lib/site-origin';
import { jsonLdString } from '@/lib/json-ld';
import {
  alternatingBands,
  costRenders,
  countrySnapshot,
  intakeCards,
  languageRenders,
  monthNames,
  sectionNumbers,
  studyPathsFor,
  workSummary,
} from '@/lib/study-abroad-view';
import { cityKey, toUniversityListRow } from '@/lib/university-list';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ countrySlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { countrySlug } = await params;
  const page = await getStudyAbroadCountry(countrySlug);
  if (!page) return { title: 'Destination not found' };
  const { country, seo } = page;
  const title =
    seo?.seoTitle ??
    `${country.pageHeading ?? `Study in ${inCountry(country.name, country.iso2Code)}`}`;
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
  const [
    page,
    directory,
    courseList,
    courseFilters,
    scholarshipList,
    universityList,
    catalogue,
  ] = await Promise.all([
    getStudyAbroadCountry(countrySlug),
    getDestinations().catch(() => null),
    /* Enough to file them under their subjects: the section groups the
       destination's courses by subject, and a first page of twenty-four
       could be one subject's alone. An editor's curated courses lead
       within their subject, so they have to be in hand too. */
    getCourses({ country: countrySlug, limit: '100' }).catch(() => null),
    /* The catalogue's own count per subject here, for each group's head --
       the size of the slice read above is not the subject's size. Its
       failure costs the counts and nothing else. */
    getCourseFilterOptions({ country: countrySlug }).catch(() => null),
    phaseList<AnyRecord>('scholarships', {
      country: countrySlug,
      limit: '6',
    }).catch(() => null),
    /* The destination's own universities, so the band below does not
       depend on a curated list nobody has filled -- nor on `derived`
       arriving at all, which under load it sometimes does not. */
    phaseList<AnyRecord>('universities', {
      country: countrySlug,
      limit: '6',
    }).catch(() => null),
    /* For one number per subject card: how many specializations it holds.
       The same read the subjects page makes, so the guide and that page
       cannot state different counts for the same subject. Its failure
       costs the counts and nothing else. */
    getSubjects({ limit: '100' })
      .then((result) => result.data)
      .catch(() => []),
  ]);
  if (!page) notFound();
  const specializationCounts = Object.fromEntries(
    catalogue.map((row) => [row.slug, row.publishedSubSubjectCount]),
  );

  const publishedCourses = (courseList?.data ?? []) as CountryCourseCard[];
  const countryScholarships = toScholarshipCards(scholarshipList?.data);
  /* The list page's own row: the card there and the card here are the same
     component, and handed only a name and a type this one could say
     neither where the university is nor what it teaches. */
  const countryUniversityCards = (universityList?.data ?? []).map(
    toUniversityListRow,
  );

  const { country, profiles, sections, faqs, consultantCards } = page;
  /* "the United Kingdom", "Germany": every sentence on the page that names
     the destination reads it this way. */
  const where = inCountry(country.name, country.iso2Code);
  const subjectCounts = new Map(
    (courseFilters?.subjects ?? []).map((subject) => [subject.value, subject.count]),
  );
  const listedCourses = Number(
    (courseList?.meta as { total?: unknown } | null | undefined)?.total,
  );
  const courseTotal =
    Number.isFinite(listedCourses) && listedCourses > 0 ? listedCourses : null;
  const tabs = await loadCountryTabs(
    country.slug,
    (country.subjects ?? []).length,
  );
  /* Whether the fields page has anything, asked of the strip rather than of
     the destination's own links -- those can be empty while the page shows
     the catalogue's thirty, which is how this button came to offer study
     paths instead on every destination that had no links yet. */
  const hasSubjectsPage = tabs.some((tab) => tab.key === 'subjects');
  const counts = tabCounts(tabs);
  const testimonials = page.testimonials ?? [];
  const snapshot = countrySnapshot(page);
  const paths = studyPathsFor(page);
  const calculator = country.configuration?.calculator ?? null;
  const currencySymbol = country.currency?.symbol ?? '';
  const others = directory ? otherDestinations(directory, country.slug) : [];
  const listing = directory?.available.find((entry) => entry.slug === country.slug) ?? null;
  const bands = listing?.bands ?? null;
  /* The hero's rule is wide enough to show a flag's own proportions, so it
     does: Denmark is three quarters red with a white cross, and three equal
     stripes of red, white and red is Austria. */
  const flag = listing?.flag ?? null;
  const work = workSummary(profiles);
  const intakes = monthNames(country.configuration?.intakeMonths ?? []);
  /* The courses section follows the editor's curation, not the catalogue's
     own order, so what an Admin marked popular for this destination leads. */
  const courses = countryCourses(country, publishedCourses);

  /* The hero keeps its lead to a sentence or two, as the design does. A longer
     short description would push the calls to action below the fold, so it
     opens the overview instead and the hero goes without. */
  const shortText = country.shortDescription ? richTextToPlainText(country.shortDescription) : '';
  /* The country's own sentence or none. A stock line stood in here whenever
     the field was blank or too long for the hero -- "Explore universities,
     costs, admission requirements..." -- and so a country nobody had written
     a word about opened on a paragraph about itself. */
  const heroSub = shortText && shortText.length <= 240 ? shortText : null;
  const overviewLead = shortText.length > 240 ? shortText : null;
  const editorial = sections.filter(editorialRenders);
  /* Asked through the same two functions the pages below this one use to
     decide whether to link into these sections, so a link is never offered
     into a section this page then leaves out. */
  const languageShown = languageRenders(page);
  const costShown = costRenders(page);

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
    countryUniversities(country, countryUniversityCards).length
      ? 'universities'
      : null,
    country.subjects?.length ? 'subjects' : null,
    courses.length ? 'courses' : null,
    country.documents?.length ? 'documents' : null,
    intakes.length || intakeCards(profiles.intakes).length ? 'intakes' : null,
    costShown ? 'cost' : null,
    languageShown ? 'language' : null,
    work.length ? 'work-visa' : null,
    hasCountryFigures(country, profiles) ? 'numbers' : null,
    /* The band states the figures; this opens them. It has nothing to say
       without them, so it stands or falls with the band above it. */
    ...editorial.map((section) => `editorial:${section.id}`),
    consultantCards.length ? 'guidance' : null,
    testimonials.length ? 'testimonials' : null,
    faqs.length ? 'faq' : null,
  ].filter((id): id is string => Boolean(id));
  const closing = [
    countryScholarships.length ? 'scholarship-funding' : null,
    page.consultants?.total ? 'consultants' : null,
    others.length ? 'other-destinations' : null,
    'connect',
  ].filter((id): id is string => Boolean(id));

  const NAVY = new Set(['work-visa']);
  /* The hero is on paper, so it takes the first slot: counted from the first
     section, "why" was paper too and merged into the hero above it. */
  const band = alternatingBands(['hero', ...run, ...closing].filter((id) => !NAVY.has(id)));
  const number = sectionNumbers(run);

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    /* Three items, matching the crumbs on the page: the destination
       directory has its own page again, between home and the guide. */
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteOrigin}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Study abroad',
        item: `${siteOrigin}/study-abroad`,
      },
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
      {/* Remembered in this browser only, so the directory's "Continue your
          journey" can offer the destinations a reader was comparing. */}
      <RecordVisit kind="country" href={`/study-abroad/${country.slug}`} title={country.name} />

      {/* HERO */}
      <section className="hero">
        <div className="wrap">
          {/* Home / Study abroad / the destination, as the design and the
              reference both have it, and as the guide's own tab pages do:
              the directory is a page of its own, and the crumb is the way
              back to it from inside the guide. */}
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href="/study-abroad">Study abroad</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{country.name}</span>
          </nav>

          <div className="hero__grid">
            <div className="hero__main">
              <h1 className="hero__h1">{country.pageHeading ?? `Study in ${where}`}</h1>
              {flag?.length ? (
                <div className="hero__bands" aria-hidden="true">
                  {flag.map((band, index) => (
                    <span
                      key={`${band.colour}-${index}`}
                      style={{
                        background: band.colour,
                        // Fractional grow factors summing below one leave a gap.
                        flexGrow: band.share * 100,
                      }}
                    />
                  ))}
                </div>
              ) : null}
              {heroSub ? <p className="hero__sub">{heroSub}</p> : null}
              {country.tagline ? (
                <p className="hero__promise">{country.tagline}</p>
              ) : null}

              <div className="btn-row hero__actions">
                <button className="btn btn--lg" type="button" data-open-assessment>
                  Check My Eligibility{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </button>
                {/* The fields taught here, which is the first thing a
                    student narrows by and had no entry point from the hero. */}
                {hasSubjectsPage ? (
                  <Link
                    className="btn btn--lg btn--ghost"
                    href={`/study-abroad/${country.slug}/subjects`}
                  >
                    Explore subjects{' '}
                    <span className="btn__arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </Link>
                ) : paths.length ? (
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
                    <FlagMark iso2Code={country.iso2Code ?? null} bands={bands} />
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

      {/* The four ways into this destination. Until this strip existed the
          guide linked down into its own sections and nowhere across, so the
          fields taught here and the institutions teaching them were pages a
          reader had to already know the URL of. */}
      <CountryTabs tabs={tabs} current="overview" />
      <CountrySectionJumps rendered={[...run, ...closing]} />

      <CountryWhy country={country} n={number('why')} alt={band('why')} />
      <CountryOverview
        country={country}
        lead={overviewLead}
        n={number('overview')}
        alt={band('overview')}
      />
      <StudyPaths
        paths={paths}
        countryName={where}
        fields={(country.subjects ?? []).slice(0, 6).map((subject) => ({
          name: subject.name,
          href: `/study-abroad/${country.slug}/${subject.slug}`,
        }))}
        n={number('study-paths')}
        alt={band('study-paths')}
      />

      {/* WHAT THIS DESTINATION HAS: universities, the fields they teach and the
          courses themselves. Each stands down when there is nothing published
          for this country rather than showing an empty shelf. */}
      <CountryUniversities
        country={country}
        fallback={countryUniversityCards}
        n={number('universities')}
        alt={band('universities')}
      />
      <CountrySubjects
        country={country}
        specializations={specializationCounts}
        n={number('subjects')}
        alt={band('subjects')}
      />
      <CountryCourses
        country={country}
        courses={courses}
        total={courseTotal}
        subjectCounts={subjectCounts}
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
        countryName={where}
        n={number('faq')}
        alt={band('faq')}
      />

      {/* FUNDING — after the questions, unnumbered, as in the design. */}
      <CountryScholarships
        country={country}
        scholarships={countryScholarships}
        alt={band('scholarship-funding')}
      />

      {/* Everything above is Universta answering; this is where to ask a
          person, with the destination already carried into the filter. */}
      <CountryConsultants
        countryName={country.name}
        countrySlug={country.slug}
        iso2Code={country.iso2Code ?? null}
        presence={page.consultants}
        alt={band('consultants')}
      />

      <PlanBand
        heading={`Ready to plan your move to ${where}?`}
        body="Tell us about your academic profile, goals and budget, and a counsellor will match it against live programmes."
        countrySlug={country.slug}
        countryName={country.name}
        /* The directory, not the homepage: every destination is a page of
           its own, and this button used to land a reader on `/`. */
        secondary={{ href: '/study-abroad', label: 'Explore all countries' }}
      />

      <CountryOtherDestinations
        country={country}
        others={others}
        total={directory?.counts.total ?? null}
        alt={band('other-destinations')}
      />

      {/* EXPLORE NEXT */}
      <CountryConnect
        country={country}
        alt={band('connect')}
        scholarships={counts.scholarships > 0}
        consultants={Boolean(page.consultants?.total)}
        groups={[
          {
            title: `Courses in ${where}`,
            total: courseTotal ?? undefined,
            items: courses.slice(0, 6).map((course) => ({
              id: course.id,
              name: course.name,
              href: `/courses/${course.slug}`,
              note: course.courseLevel?.name ?? null,
            })),
          },
          {
            title: `Universities in ${where}`,
            total: counts.universities || undefined,
            items: countryUniversities(country, countryUniversityCards)
              .slice(0, 6)
              .map((university) => ({
                id: university.id,
                name: university.name,
                href: universityHref(university.slug),
                note: 'city' in university ? (university.city ?? null) : null,
              })),
          },
          {
            title: 'Scholarships',
            total: counts.scholarships || undefined,
            items: countryScholarships.slice(0, 6).map((scholarship) => ({
              id: scholarship.id,
              name: scholarship.title,
              href: `/scholarships/${scholarship.slug}`,
              note: scholarship.provider,
            })),
          },
          {
            title: `Subjects in ${where}`,
            total: (country.subjects ?? []).length,
            items: (country.subjects ?? []).slice(0, 6).map((subject) => ({
              id: subject.id,
              name: subject.name,
              href: `/study-abroad/${country.slug}/${subject.slug}`,
            })),
          },
          {
            title: 'Consultants',
            total: page.consultants?.total || undefined,
            items: (page.consultants?.cities ?? []).slice(0, 6).map((entry) => ({
              id: entry.city,
              name: `In ${entry.city}`,
              href: `${countryConsultantsHref(country.slug)}?city=${encodeURIComponent(cityKey(entry.city))}#consultants`,
              note: `${entry.count} ${entry.count === 1 ? 'consultant' : 'consultants'}`,
            })),
          },
        ]}
      />
    </>
  );
}
