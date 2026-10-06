'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Course, CourseFilterOptions, Subject } from '@/lib/catalog';
import {
  guideListSearch,
  guidesAsProgrammes,
  NO_GUIDE_FILTERS,
  type CoursesView,
  type GuideFilters,
  type GuideUnknown,
} from '@/lib/courses-params';
import { formatNumber } from '@/lib/format';
import { intakeRange } from '@/lib/intake-range';
import {
  courseListSearch,
  readCourseFilters,
  type CourseFilters,
  type FacetOption,
  type ProgrammeList,
} from '@/lib/university-courses';
import { COMPARE_LIMIT, CompareTray } from '@/components/study-abroad/CourseCompare';
import { ConnectBand, MatchBand } from '@/components/study-abroad/DiscoveryBands';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { ProgrammeResults } from '@/components/study-abroad/ProgrammeResults';
import { countLabel, initials, RowCard } from '@/components/study-abroad/RowCard';
import { SectionHead } from '@/components/study-abroad/SectionHead';
import { byValue, CourseGuidesResults } from './CourseGuidesResults';

/** The client-approved Courses page, as the reference's "Find a Course".
 *
 * The approved build is the hero, then the search and the results right
 * under it, then the navy matching band, then the closing plan band. This
 * page had put eleven blocks of browsing and marketing between the hero and
 * the results, in class names its stylesheet never defined, so a reader
 * looking for a course scrolled past two screens of unstyled text to reach
 * it. The results now follow the hero; every one of those blocks is kept,
 * drawn in the design's own parts, after the matching band.
 *
 * What the results list is the reference's: programmes -- a course as one
 * university teaches it -- each card naming the university and its city and
 * leading to that programme's page and its eligibility section. The generic
 * course search this page used to be stays beside them as "Course guides",
 * with a switcher between the two. A catalogue with no programme at all --
 * the live site's, while its import sheets create none -- opens on the
 * course guides and offers no programmes, so it shows what it always did.
 *
 * Every figure is the catalogue's own count. The template's "300,000+
 * programs", QS ranks, STEM badges and graduate salaries are prototype copy
 * with nothing behind them here, so they are left out rather than faked;
 * and a browse block counts what its own link opens -- programmes on the
 * programmes view, course guides on the guides view. */

export type CoursesReferenceProps = {
  view: CoursesView;
  /** The programmes the address asks for, with the filters they were read
   *  with; null when the catalogue lists none. */
  programmes: (ProgrammeList & { filters: CourseFilters }) | null;
  /** The course guides the address asks for, on the guides view. */
  guides: {
    courses: Course[];
    meta: { page: number; limit: number; total: number; totalPages: number };
    filterOptions: CourseFilterOptions;
    /** True when the reader asked for a page or a page size themselves. */
    paged: boolean;
  } | null;
  /** The guides' filters as checked against the catalogue, which the
   *  switcher's link to the guides carries on either view. */
  guideFilters: GuideFilters;
  guideUnknown: GuideUnknown;
  /** How many course guides the same choice matches; null if not known. */
  guideTotal: number | null;
  /** The course guides across the whole catalogue: what the guides' browse
   *  blocks count, and the hero's figures when there are no programmes. */
  guideCatalogue: { options: CourseFilterOptions; total: number } | null;
  subjects: Subject[];
  /** Real link clusters; each is empty when the catalogue has no records. */
  universities: Array<{ name: string; slug: string }>;
  consultants: Array<{ name: string; slug: string }>;
  events: Array<{
    name: string;
    slug: string;
    mode: string | null;
    startAt: string | null;
  }>;
  heading: string;
  lede: string;
  ctaHeading: string;
  ctaBody: string;
};

/* How many the shortlist holds, in words, for the copy that promises it. */
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const UP_TO = NUMBER_WORDS[COMPARE_LIMIT] ?? String(COMPARE_LIMIT);

/* The assessment's own small print, said where it is offered. */
const ASSESSMENT_NOTE =
  'The assessment compares what you tell us with what universities publish for each programme. It is not a ranking and does not guarantee admission: admission decisions are made by universities alone.';

const TAKEAWAYS = [
  `Compare up to ${UP_TO} programmes side by side across tuition, duration, intakes and study modes.`,
  'Every filter in the rail is backed by real catalogue data — nothing is decorative.',
  'Intake windows come from each destination’s own published calendar.',
];

const FAQS = [
  {
    q: 'How do I choose the right course to study abroad?',
    a: 'Balance four things: academic fit, affordability, admission chances and career outcomes. Start with your degree level and destination, narrow by tuition and scholarship availability, then shortlist three to five programmes and compare them side by side.',
  },
  {
    q: 'What is the difference between a course and a course offering?',
    a: 'A course is the programme itself — its subject, level and duration. An offering is that course as taught by a specific university in a specific country, with its own tuition, intakes and entry requirements. The Programmes list shows offerings; Course guides shows the courses themselves.',
  },
  {
    q: 'Can I filter courses by intake?',
    a: 'Yes. Each published offering records the intake window it belongs to, so the intake filter narrows results to programmes actually accepting students for that period.',
  },
  {
    q: 'Which English tests are accepted?',
    a: 'That is set per destination and per offering. The English test filter lists only the tests the published catalogue actually records, so a test you can filter by is a test something accepts.',
  },
];

const WHY = [
  {
    h: 'Published records only',
    p: 'Every programme on this page comes from a published catalogue record. Nothing is placeholder content.',
  },
  {
    h: 'Side-by-side comparison',
    p: `Shortlist up to ${UP_TO} programmes and compare tuition, duration, intakes and study modes in one view.`,
  },
  {
    h: 'Filters that actually filter',
    p: 'Every facet in the rail is backed by real data, so a result count of zero means zero matching programmes.',
  },
  {
    h: 'Destination context',
    p: 'Each destination page carries the country’s own intake calendar, requirements and cost guidance.',
  },
  {
    h: 'Talk to a counsellor',
    p: 'Book a free session when you want a second opinion on a shortlist before you apply.',
  },
  {
    h: 'Kept current',
    p: 'Programme details, intakes and deadlines are maintained in one place and update across the site together.',
  },
];

const TOOLS = [
  {
    h: 'Compare courses',
    p: `Line up to ${UP_TO} programmes side by side.`,
    href: '/compare/courses',
  },
  { h: 'Compare universities', p: 'Weigh institutions against each other.', href: '/compare/universities' },
  { h: 'Scholarship finder', p: 'Filter published funding by destination and level.', href: '/scholarships' },
  { h: 'Free counselling', p: 'Book a session with an advisor.', href: '/counselling' },
];

/** One way into the list from the blocks below it: what it is called, how
 *  many it opens, and the list it opens. */
type BrowseItem = { key: string; title: string; meta: string | null; href: string };

const byCount = (options: FacetOption[]) =>
  [...options].sort((left, right) => right.count - left.count);

export function CoursesReference(props: CoursesReferenceProps) {
  const { view, programmes, guides, guideFilters, guideCatalogue } = props;
  const router = useRouter();
  const hasProgrammes = programmes !== null;
  /* The guides' own address names their view only where the programmes are
     the page's default. */
  const viewParam = hasProgrammes;
  const bare = readCourseFilters({});

  /** The programmes list, opened at one choice. */
  const programmesHref = (change: Partial<CourseFilters>) =>
    `/courses${courseListSearch(bare, change)}#discovery`;
  /** The course guides, opened at one choice. */
  const guidesHref = (change: Partial<GuideFilters>) =>
    `/courses${guideListSearch(NO_GUIDE_FILTERS, change, { view: viewParam })}#discovery`;

  /* -------------------------------------------------------------- hero */

  const summary = programmes?.summary;
  const guideOptions = guideCatalogue?.options;
  const genericSpecialisations = guideOptions ? byValue(guideOptions.subSubjects) : [];

  /* Four facts, inline, as the approved hero has them -- and only the ones
     this catalogue can actually count. A figure with nothing behind it is
     left out rather than printed as a dash. They count the whole catalogue,
     filtered or not, as the reference's hero does. */
  const stats = (
    summary
      ? [
          { value: summary.programmes, label: 'Programmes' },
          { value: summary.universities, label: 'Universities' },
          { value: summary.cities, label: 'Cities' },
          { value: summary.intakeMonths, label: 'Intake months' },
        ]
      : [
          { value: guideCatalogue?.total ?? 0, label: 'Courses' },
          { value: guideOptions?.countries.length ?? 0, label: 'Destinations' },
          { value: guideOptions?.subjects.length ?? 0, label: 'Subjects' },
          { value: genericSpecialisations.length, label: 'Specialisations' },
        ]
  ).filter((stat) => stat.value > 0);

  const eyebrow = (
    summary && programmes
      ? [
          countLabel(summary.countries, 'destination'),
          countLabel(programmes.facets.subject.length, 'subject'),
          countLabel(programmes.facets.specialization.length, 'specialisation'),
        ]
      : [
          countLabel(guideCatalogue?.total, 'course'),
          countLabel(guideOptions?.countries.length, 'destination'),
        ]
  ).filter((part): part is string => Boolean(part));

  /* The template's "Try" row is five hand-written example searches. These are
     the catalogue's own busiest specialisations, so a chip never offers a term
     the search cannot answer. */
  const tryChips: BrowseItem[] = programmes
    ? byCount(programmes.facets.specialization)
        .slice(0, 5)
        .map((option) => ({
          key: option.value,
          title: option.label,
          meta: null,
          href: programmesHref({ specialization: [option.value] }),
        }))
    : genericSpecialisations.slice(0, 5).map((option) => ({
        key: option.value,
        title: option.label,
        meta: null,
        href: guidesHref({ subSubject: [option.value] }),
      }));

  /* Quick filters toggle one filter of the list on show straight away, so
     their pressed state is the address rather than page-local memory. */
  const quick = (
    which: 'scholarship' | 'postStudyWork',
  ): { on: boolean; href: string } => {
    if (view === 'programmes' && programmes) {
      const on = programmes.filters[which];
      return {
        on,
        href: `/courses${courseListSearch(programmes.filters, { [which]: !on })}#discovery`,
      };
    }
    const key = which === 'scholarship' ? 'scholarshipAvailable' : 'postStudyWorkAvailable';
    const on = guideFilters[key];
    return {
      on,
      href: `/courses${guideListSearch(guideFilters, { [key]: !on }, { view: viewParam })}#discovery`,
    };
  };
  const quickFilters = [
    { label: 'Scholarships', ...quick('scholarship') },
    { label: 'Post-study work', ...quick('postStudyWork') },
  ];

  /* ------------------------------------------------------------ browse */

  /* The blocks below the list are the page's other way in -- a reader who
     does not know what to filter by starts from a level or a destination.
     Each counts what its link opens: on the programmes view the
     programmes' own counts, which are taken over the whole catalogue, and
     on the guides view the guides'. */
  const onProgrammes = view === 'programmes' && programmes !== null;
  const noun = onProgrammes ? 'programme' : 'course';
  const browse = onProgrammes
    ? {
        levels: programmes.facets.level.map((option) => ({
          key: option.value,
          title: option.label,
          meta: countLabel(option.count, noun),
          href: programmesHref({ level: [option.value] }),
        })),
        countries: byCount(programmes.facets.country)
          .slice(0, 6)
          .map((option) => ({
            key: option.value,
            title: option.label,
            meta: countLabel(option.count, noun),
            href: programmesHref({ country: [option.value] }),
          })),
        specialisations: byCount(programmes.facets.specialization)
          .slice(0, 8)
          .map((option) => ({
            key: option.value,
            title: option.label,
            meta: countLabel(option.count, noun),
            href: programmesHref({ specialization: [option.value] }),
          })),
        studyModes: programmes.facets.studyMode.map((option) => ({
          key: option.value,
          title: option.label,
          meta: countLabel(option.count, noun),
          href: programmesHref({ studyMode: [option.value] }),
        })),
        intakes: programmes.facets.intake.slice(0, 6).map((option) => ({
          key: option.value,
          title: option.label,
          meta: countLabel(option.count, noun),
          href: programmesHref({ intake: [option.value] }),
        })),
      }
    : {
        levels: (guideOptions?.levels ?? []).map((option) => ({
          key: option.value,
          title: option.label,
          meta: countLabel(option.count, noun),
          href: guidesHref({ level: [option.value] }),
        })),
        countries: (guideOptions?.countries ?? []).slice(0, 6).map((option) => ({
          key: option.value,
          title: option.label,
          meta: [
            countLabel(option.count, noun),
            option.currencyCode ? `tuition in ${option.currencyCode}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          href: guidesHref({ country: [option.value] }),
        })),
        specialisations: genericSpecialisations.slice(0, 8).map((option) => ({
          key: option.value,
          title: option.label,
          meta: option.subject.name,
          href: guidesHref({ subject: [option.subject.slug], subSubject: [option.value] }),
        })),
        studyModes: (guideOptions?.studyModes ?? []).map((option) => ({
          key: option.value,
          title: option.label,
          meta: countLabel(option.count, noun),
          href: guidesHref({ studyMode: [option.value] }),
        })),
        intakes: (guideOptions?.intakes ?? []).slice(0, 6).map((option) => ({
          key: option.value,
          title: intakeRange({
            startMonth: option.startMonth,
            endMonth: option.endMonth,
            shortLabel: option.label,
          }),
          meta: countLabel(option.count, noun),
          href: guidesHref({ intake: [option.value] }),
        })),
      };

  const topSubjects = props.subjects.slice(0, 8);
  /* Destinations for the prose and the link clusters: the ones the list
     itself counts. */
  const topCountries = browse.countries.slice(0, 6);

  /* ---------------------------------------------------------- switcher */

  const programmeTotal = programmes?.meta.total ?? 0;
  const switchToProgrammes =
    view === 'programmes' && programmes
      ? `/courses${courseListSearch(programmes.filters)}#discovery`
      : `/courses${courseListSearch(bare, guidesAsProgrammes(guideFilters))}#discovery`;
  const switchToGuides = `/courses${guideListSearch(
    guideFilters,
    { page: 1, pageSize: null },
    { view: true },
  )}#discovery`;

  /* Said under the empty programmes list: where else the reader might look.
     The course guides with the same choice, when some match it, and the
     assessment, which matches a profile rather than a search. */
  const programmesEmpty = (
    <>
      <p>
        Or{' '}
        <button
          className="linkbtn"
          type="button"
          data-open-assessment
          data-intent="courses-empty"
        >
          run the assessment
        </button>{' '}
        and we will match you against programmes directly.
      </p>
      <p>
        <Link className="linkcta" href={props.guideTotal ? switchToGuides : guidesHref({})}>
          {props.guideTotal
            ? `${formatNumber(props.guideTotal)} course ${props.guideTotal === 1 ? 'guide matches' : 'guides match'} these filters`
            : 'Browse the course guides'}{' '}
          <span className="linkcta__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
      </p>
    </>
  );

  return (
    <>
      {/* ------------------------------------------------------------ HERO */}
      <section className="hero hero--compact">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Courses</span>
          </nav>

          <div className="hero__lead">
            {eyebrow.length ? (
              <p className="hero__eyebrow">
                Course discovery
                {/* Fragments, so the dot and the figure are the eyebrow's
                    own flex items and keep its gap between them. */}
                {eyebrow.map((part) => (
                  <Fragment key={part}>
                    <b>·</b>
                    {part}
                  </Fragment>
                ))}
              </p>
            ) : null}
            <h1 className="hero__h1">{props.heading}</h1>
            <p className="hero__sub">{props.lede}</p>
          </div>

          {stats.length ? (
            <div className="statstrip">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <b className="datum">{formatNumber(stat.value)}</b>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="bigsearch__ex" style={{ marginTop: 22 }}>
            <span className="label">Try</span>
            {tryChips.map((chip) => (
              <Link key={chip.key} className="chipbtn chipbtn--sm" href={chip.href}>
                {chip.title}
              </Link>
            ))}
            {quickFilters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                className={`chipbtn chipbtn--sm${filter.on ? ' on' : ''}`}
                aria-pressed={filter.on}
                onClick={() => router.push(filter.href)}
              >
                {filter.label}
              </button>
            ))}
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- RESULTS */}
      <section className="sec sec--white sec--tight coursefinder" id="discovery">
        <div className="wrap">
          {/* The approved band carries no visible title -- the hero has just
              said what this is. An outline still needs the level, or a screen
              reader walking the page drops from the h1 to a card's h3 with
              nothing in between. */}
          <h2 className="sr-only">{onProgrammes ? 'All programmes' : 'All courses'}</h2>

          {hasProgrammes ? (
            <nav className="switcher switcher--few cf-switch" aria-label="What to list">
              <Link
                className="switcher__item"
                href={switchToProgrammes}
                aria-current={view === 'programmes' ? 'page' : undefined}
                data-testid="switch-programmes"
              >
                <span className="cf-switch__name">Programmes</span>
                <em className="cf-switch__n">({formatNumber(programmeTotal)})</em>
              </Link>
              <Link
                className="switcher__item"
                href={switchToGuides}
                aria-current={view === 'guides' ? 'page' : undefined}
                data-testid="switch-guides"
              >
                <span className="cf-switch__name">Course guides</span>
                {props.guideTotal !== null ? (
                  <em className="cf-switch__n">({formatNumber(props.guideTotal)})</em>
                ) : null}
              </Link>
            </nav>
          ) : null}

          {/* The no-script "Show more" link of the programmes list lands
              here, as the reference's does on #courses. */}
          <div id="courses" className="cf-results">
            {onProgrammes ? (
              <ProgrammeResults
                base="/courses"
                filters={programmes.filters}
                facets={programmes.facets}
                cards={programmes.cards}
                meta={programmes.meta}
                catalogueTotal={programmes.summary.programmes}
                empty={programmesEmpty}
              />
            ) : guides ? (
              <CourseGuidesResults
                courses={guides.courses}
                meta={guides.meta}
                filterOptions={guides.filterOptions}
                filters={guideFilters}
                unknown={props.guideUnknown}
                paged={guides.paged}
                viewParam={viewParam}
                programmes={hasProgrammes}
              />
            ) : null}
          </div>

          <p className="trust__note" style={{ paddingTop: 20 }}>
            Courses come from universities published in this catalogue. Every course page shows
            when its data was last updated and whether it has been verified.
          </p>
        </div>
      </section>

      <MatchBand
        eyebrow={{ n: 'Personalised', label: 'Course matching' }}
        heading="Not sure what to search for?"
        lead="Answer a few questions about your background, budget and goals, and we will narrow the catalogue to the courses that fit."
        href="/courses#discovery"
        assessment={{
          label: 'Find courses for my profile',
          intent: 'courses-index',
          note: ASSESSMENT_NOTE,
        }}
      />

      {/* KEY TAKEAWAYS -- the page's introduction, after the search it
          introduces rather than in front of it. */}
      <section className="sec sec--tight" id="about">
        <div className="wrap">
          <SectionHead
            eyebrow="About this search"
            title="Key takeaways"
            lead="Universta brings every published programme into one place so you can compare study abroad courses on the things that decide an application: qualification level, destination, tuition, study mode, intake window and English requirements. Filter down to the programmes you are actually eligible for, shortlist them, then compare them side by side before you apply."
          />
          <div className="rulegrid rulegrid--3">
            {TAKEAWAYS.map((item, index) => (
              <div className="rulegrid__item" key={item}>
                <span className="rulegrid__n">{String(index + 1).padStart(2, '0')}</span>
                <p className="rulegrid__b">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BROWSE BY SUBJECT */}
      {topSubjects.length ? (
        <section className="sec sec--white" id="subjects">
          <div className="wrap">
            <SectionHead
              eyebrow="Explore"
              title="Browse courses by subject"
              lead="Every subject area currently published in the catalogue."
            >
              <p className="h-more">
                <Link className="linkcta" href="/subjects">
                  All subjects{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              </p>
            </SectionHead>
            <div className="subjindex cf-subjects">
              {topSubjects.map((subject) => (
                <article className="subjcard" key={subject.id}>
                  <div className="subjcard__head">
                    <span className="subjcard__icon cf-subjects__mark" aria-hidden="true">
                      {initials(subject.name)}
                    </span>
                    <div>
                      <h3 className="subjcard__name">
                        <Link href={`/subjects/${subject.slug}`}>{subject.name}</Link>
                      </h3>
                      {subject.publishedSubSubjectCount || subject.availableCountryCount ? (
                        <p className="subjcard__meta">
                          {[
                            countLabel(subject.publishedSubSubjectCount, 'specialisation'),
                            countLabel(subject.availableCountryCount, 'destination'),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="subjcard__foot">
                    <Link className="linkcta" href={`/subjects/${subject.slug}`}>
                      View subject{' '}
                      <span className="linkcta__arrow" aria-hidden="true">
                        &rarr;
                      </span>
                    </Link>
                    {subject.publishedCourseCount ? (
                      <span className="subjcard__count datum">
                        {countLabel(subject.publishedCourseCount, 'course')}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* BROWSE BY DEGREE LEVEL */}
      {browse.levels.length ? (
        <section className="sec" id="levels">
          <div className="wrap">
            <SectionHead
              eyebrow="By qualification"
              title="Browse courses by degree level"
              lead={`Each opens the ${noun} list above at that level.`}
            />
            <div className="h-grid h-grid--4">
              {browse.levels.map((item) => (
                <RowCard key={item.key} href={item.href} title={item.title} meta={item.meta} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* BROWSE BY DESTINATION */}
      {browse.countries.length ? (
        <section className="sec sec--white" id="destinations">
          <div className="wrap">
            <SectionHead
              eyebrow="By destination"
              title="Browse courses by study destination"
              lead={
                onProgrammes
                  ? 'The destinations with the most programmes in the catalogue.'
                  : 'Every destination with published course offerings.'
              }
            >
              <p className="h-more">
                <Link className="linkcta" href="/">
                  All destinations{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              </p>
            </SectionHead>
            <div className="h-grid">
              {browse.countries.map((item) => (
                <RowCard
                  key={item.key}
                  href={item.href}
                  title={item.title}
                  meta={item.meta || null}
                  mark
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* SPECIALISATIONS */}
      {browse.specialisations.length ? (
        <section className="sec" id="specialisations">
          <div className="wrap">
            <SectionHead eyebrow="Fields of study" title="Explore by specialisation" />
            <div className="h-grid h-grid--4">
              {browse.specialisations.map((item) => (
                <RowCard
                  key={item.key}
                  href={item.href}
                  title={item.title}
                  meta={item.meta}
                  mark
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* STUDY MODE + INTAKE */}
      {browse.studyModes.length || browse.intakes.length ? (
        <section className="sec sec--white" id="format">
          <div className="wrap cf-pair">
            {browse.studyModes.length ? (
              <div>
                <div className="sec-head">
                  <p className="eyebrow">Format</p>
                  <h2 className="sec-title cf-pair__t">Courses by study mode</h2>
                </div>
                <div className="h-grid cf-pair__grid">
                  {browse.studyModes.map((item) => (
                    <RowCard key={item.key} href={item.href} title={item.title} meta={item.meta} />
                  ))}
                </div>
              </div>
            ) : null}
            {browse.intakes.length ? (
              <div>
                <div className="sec-head">
                  <p className="eyebrow">Timing</p>
                  <h2 className="sec-title cf-pair__t">Courses by intake</h2>
                </div>
                <div className="h-grid cf-pair__grid">
                  {browse.intakes.map((item) => (
                    <RowCard key={item.key} href={item.href} title={item.title} meta={item.meta} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* WHY UNIVERSTA */}
      <section className="sec" id="why">
        <div className="wrap">
          <SectionHead eyebrow="Why Universta" title="Everything you need to choose with confidence" />
          <div className="rulegrid rulegrid--3">
            {WHY.map((item, index) => (
              <div className="rulegrid__item" key={item.h}>
                <span className="rulegrid__n">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="rulegrid__t">{item.h}</h3>
                <p className="rulegrid__b">{item.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOOLS */}
      <section className="sec sec--white" id="tools">
        <div className="wrap">
          <SectionHead
            eyebrow="Free tools"
            title="Study abroad tools"
            lead="Plan every step — from shortlisting to comparing to talking it through."
          />
          <div className="h-grid h-grid--4">
            {TOOLS.map((tool) => (
              <Link key={tool.href} href={tool.href} className="h-card">
                <span className="h-card__t">{tool.h}</span>
                <span className="h-card__d">{tool.p}</span>
                <span className="h-card__m" aria-hidden="true">
                  Open &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* EVENTS */}
      {props.events.length ? (
        <section className="sec" id="events">
          <div className="wrap">
            <SectionHead eyebrow="Live & virtual" title="Upcoming events">
              <p className="h-more">
                <Link className="linkcta" href="/events">
                  All events{' '}
                  <span className="linkcta__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              </p>
            </SectionHead>
            <div className="h-grid h-grid--4">
              {props.events.map((event) => (
                <Link key={event.slug} href={`/events/${event.slug}`} className="h-card">
                  {event.mode ? <span className="badge">{event.mode}</span> : null}
                  <span className="h-card__t">{event.name}</span>
                  {event.startAt ? (
                    <span className="h-card__m">
                      {new Intl.DateTimeFormat('en-GB', {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      }).format(new Date(event.startAt))}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* HOW TO CHOOSE */}
      <section className="sec sec--white" id="how-to-choose">
        <div className="wrap">
          <SectionHead eyebrow="Guidance" title="How to choose the right study abroad course" />
          <div className="prose">
            <p>
              The best programme balances academic fit, affordability, admission chances and career
              outcomes. Start by filtering on your target degree level and destination, then narrow by
              study mode and scholarship availability. Shortlist three courses and use the compare tray
              to weigh tuition, duration and intakes against each other.
            </p>
            <details className="readmore cf-readmore">
              <summary>Read more about course selection</summary>
              <div>
                <h3>Popular course and destination combinations</h3>
                <p>
                  {topSubjects.slice(0, 4).map((subject, index) => (
                    <span key={subject.id}>
                      {index > 0 ? ', ' : ''}
                      <Link href={`/subjects/${subject.slug}`}>{subject.name}</Link>
                    </span>
                  ))}
                  {topSubjects.length && topCountries.length ? ' and destinations such as ' : null}
                  {topCountries.slice(0, 4).map((country, index) => (
                    <span key={country.key}>
                      {index > 0 ? ', ' : ''}
                      <Link href={`/study-abroad/${country.key}`}>{country.title}</Link>
                    </span>
                  ))}
                  {topSubjects.length || topCountries.length
                    ? ' each open their own filterable listing.'
                    : 'Browse the filters above to open a filterable listing.'}
                </p>
                <h3>English language requirements</h3>
                <p>
                  Requirements are recorded per programme. Filter by the test you have taken to see
                  only the courses that publish an accepted score for it.
                </p>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec" id="faq">
        <div className="wrap">
          <SectionHead eyebrow="Answers" title="Frequently asked questions" />
          <div className="faq">
            {FAQS.map((item, index) => (
              <details className="faq__item" key={item.q} open={index === 0}>
                <summary className="faq__q">
                  {item.q}
                  <span className="faq__plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="faq__a prose">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* INTERNAL LINK CLUSTERS */}
      {props.universities.length || topCountries.length || props.consultants.length ? (
        <section className="sec sec--white sec--tight" id="explore">
          <div className="wrap h-related">
            <h2 className="sec-title h-related__t">Explore further</h2>
            <div className="h-related__grid cf-links">
              {props.universities.length ? (
                <div className="h-relgroup">
                  <h3 className="h-relgroup__t">Explore universities</h3>
                  <ul className="h-list">
                    {props.universities.slice(0, 8).map((item) => (
                      <li key={item.slug}>
                        <Link href={`/universities/${item.slug}`}>{item.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {topCountries.length ? (
                <div className="h-relgroup">
                  <h3 className="h-relgroup__t">Explore destinations</h3>
                  <ul className="h-list">
                    {topCountries.map((item) => (
                      <li key={item.key}>
                        <Link href={`/study-abroad/${item.key}`}>Study in {item.title}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {props.consultants.length ? (
                <div className="h-relgroup">
                  <h3 className="h-relgroup__t">Find a consultant</h3>
                  <ul className="h-list">
                    {props.consultants.slice(0, 8).map((item) => (
                      <li key={item.slug}>
                        <Link href={`/study-abroad-consultants/${item.slug}`}>{item.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* FINAL CTA */}
      <section className="sec sec--tight" id="next">
        <div className="wrap">
          <div className="magnet cf-final">
            <div>
              <h2 className="magnet__t">{props.ctaHeading}</h2>
              <p className="magnet__b">{props.ctaBody}</p>
            </div>
            <div className="btn-row">
              <a href="#discovery" className="btn btn--onnavy">
                Browse courses
              </a>
              <Link href="/compare/courses" className="btn btn--onnavy-ghost">
                Compare courses
              </Link>
              <Link href="/counselling" className="btn btn--onnavy-ghost">
                Book free counselling
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ConnectBand
        actions={[
          { href: '/subjects', label: 'Browse subjects' },
          { href: '/specializations', label: 'All specializations', ghost: true },
          { href: '/study-abroad', label: 'Compare destinations', ghost: true },
        ]}
        groups={[
          {
            title: 'Subjects',
            items: props.subjects.slice(0, 6).map((row) => ({
              id: String(row.id),
              name: String(row.name),
              href: `/subjects/${String(row.slug)}`,
            })),
          },
        ]}
      />

      <PlanBand
        secondary={{ href: '#discovery', label: onProgrammes ? 'Browse programmes' : 'Browse courses' }}
      />

      <CompareTray />
    </>
  );
}
