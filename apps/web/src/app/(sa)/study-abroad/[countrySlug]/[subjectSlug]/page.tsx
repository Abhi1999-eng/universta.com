import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { CountryGuideLinks } from '@/components/study-abroad/CountryGuideLinks';
import { CountryConsultants } from '@/components/study-abroad/CountryConsultants';
import {
  CountryFieldHero,
  FiguresStrip,
  NothingListedHere,
  SpecializationChips,
} from '@/components/study-abroad/CountryFieldHero';
import { RowCard, countLabel } from '@/components/study-abroad/RowCard';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { ConnectBand, MatchBand } from '@/components/study-abroad/DiscoveryBands';
import { Longform } from '@/components/study-abroad/Longform';
import { RichText } from '@/components/phase1/RichText';
import { loadCountryTabs, tabCounts } from '@/lib/country-tabs';
import { guideLinks } from '@/lib/study-abroad-view';
import {
  getCourseFilterOptions,
  getCourseLevels,
  getCourses,
  getCoursesByLevel,
  getSubject,
} from '@/lib/catalog';
import {
  everyLevel,
  LEVEL_ROWS_FETCHED,
  levelCoursesHref,
  levelTotal,
  programmesHref,
} from '@/lib/course-levels';
import { CourseLevels } from '@/components/study-abroad/CourseLevels';
import { DestinationProgrammes } from '@/components/study-abroad/DestinationProgrammes';
import { programmeList } from '@/lib/programme-sample';
import {
  isNarrowedCourseList,
  readCourseFilters,
} from '@/lib/university-courses';
import { getStudyAbroadCountry } from '@/lib/study-abroad';
import { formatNumber } from '@/lib/format';
import { inCountry } from '@/lib/country-article';
import { subjectIconPath } from '@/lib/subject-icon';
import { counsellingHref } from '@/lib/counselling-link';
import {
  countrySubjectPage,
  figuresHere,
  intakeFigure,
  listedIntakes,
  overviewParts,
  programmeCountsHere,
  programmesHere,
  specializationCountsHere,
} from '@/lib/country-subject';
import { PROGRAMME_MAX_PAGES } from '@/lib/courses-params';
import {
  subjectUniversitiesGroup,
  subjectUniversitiesHref,
} from '@/lib/university-related';

/**
 * One field, in one destination.
 *
 * The catalogue could already say "Agriculture is taught in the United
 * Kingdom" and "here is Agriculture everywhere", but it had nowhere to put
 * the sentence a student actually asks: what does studying Agriculture in
 * the UK involve. The subject page is the field across every destination;
 * the destination guide is every field in one country. This is the cell
 * where they meet, and the only page that can carry both names in its
 * title and both links in its header.
 *
 * Every count on it is this destination's own. The subject's record counts
 * its specializations across the whole catalogue, and the page used to
 * print those beside its own course total, so the two contradicted each
 * other and a destination teaching nothing looked as full as one teaching
 * all of it.
 */
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ countrySlug: string; subjectSlug: string }>;
  /** The programme list's search, filters, sort and how far it is loaded. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load(countrySlug: string, subjectSlug: string) {
  const [page, subject] = await Promise.all([
    getStudyAbroadCountry(countrySlug),
    getSubject(subjectSlug).catch(() => null),
  ]);
  if (!page?.country || !subject) return null;
  return { page, country: page.country, subject };
}

export async function generateMetadata({
  params,
  searchParams,
}: Params): Promise<Metadata> {
  const { countrySlug, subjectSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug);
  if (!loaded)
    return {
      title: { absolute: 'Not found | Universta' },
      robots: { index: false },
    };
  const { country, subject } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  const heroWhere = country.iso2Code?.toUpperCase() === 'GB' ? 'the UK' : where;
  return {
    title: { absolute: `${subject.name} courses in ${heroWhere} | Universta` },
    description:
      subject.shortDescription ??
      `The specializations, universities and programmes available in ${subject.name} for students going to ${where}.`,
    /* A searched, filtered, sorted or further-loaded programme list is a
       slice of the page, which is indexed whole: left out of the index,
       its links still followed, and naming no canonical, as the university
       lists do it. */
    ...(isNarrowedCourseList(await searchParams)
      ? { robots: { index: false, follow: true } }
      : {
          alternates: {
            canonical: `/study-abroad/${country.slug}/${subject.slug}`,
          },
        }),
  };
}

export default async function Page({ params, searchParams }: Params) {
  const { countrySlug, subjectSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug);
  if (!loaded) notFound();
  const { page, country, subject } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  const heroWhere = country.iso2Code?.toUpperCase() === 'GB' ? 'the UK' : where;
  const base = `/study-abroad/${country.slug}/${subject.slug}`;
  const read = readCourseFilters(await searchParams);
  /* No further than the finder loads. Past it the run asks for more rows
     than the API serves in one answer, which then sends the first page
     alone and leaves no way on to the rest. */
  const asked = { ...read, page: Math.min(read.page, PROGRAMME_MAX_PAGES) };
  /* What the programme list is fixed to: this country, this field. */
  const scope = { country: [country.slug], subject: [subject.slug] };

  /* Courses under their levels, and only what this destination teaches;
     the course filters for the same pair, which count this destination's
     courses per specialization and name its intakes; the tab strip; the
     universities that teach the field here; and their programmes here, as
     the address filters them. Read together, and each failure costs only
     what it feeds. */
  const [levels, filters, tabs, universities, allLevels, programmes] = await Promise.all([
    getCoursesByLevel({
      subject: subject.slug,
      country: country.slug,
      perLevel: LEVEL_ROWS_FETCHED,
    }).catch(() => null),
    getCourseFilterOptions({
      subject: subject.slug,
      country: country.slug,
    }).catch(() => null),
    loadCountryTabs(country.slug, (country.subjects ?? []).length),
    /* By name, rather than only a link to the country's whole list. Read
       once, for the figures, the closing band's group and its link to the
       rest of them. */
    subjectUniversitiesGroup(country.slug, subject, where),
    /* Every study level, so the six the page always shows are there even
       where nothing is listed at them here yet. */
    getCourseLevels().catch(() => null),
    programmeList(asked, scope),
  ]);
  /* Drawn only where something is listed here; an empty catalogue leaves
     the page as it was. */
  const listed = programmes && programmes.summary.programmes > 0 ? programmes : null;
  /* When the grouped read fails the page falls back to the six mixed
     courses it always showed, rather than to no courses. */
  const courses = levels
    ? null
    : await getCourses({
        country: country.slug,
        subject: subject.slug,
        limit: '6',
      }).catch(() => null);
  const shown = programmesHere(levels, courses);
  /* What the level block draws: the levels with courses here, and the
     always-shown ones that have none. `levels` stays what is listed. */
  const levelBlock = everyLevel(
    /* A failed grouped read whose fallback list came back empty also knows
       nothing is listed, and still shows the levels. */
    levels ?? (shown === 'none' ? [] : null),
    allLevels,
  );
  const filed =
    shown === 'levels'
      ? levelTotal(levels ?? [])
      : shown === 'list'
        ? (courses?.meta.total ?? 0)
        : 0;

  /* The destination does not have to claim the field. It used to: a page
     rendered only where the country listed the subject or published a
     course in it, which meant a destination with no courses yet 404d on
     every one of the thirty fields the catalogue knows. The taxonomy is
     not per-country -- what varies is which fields have programmes behind
     them here, and this page says that plainly where there are none. The
     subject itself still has to exist, which `load` has already settled. */

  const view = countrySubjectPage({
    specializations: subject.subSubjects,
    others: country.subjects ?? [],
    subjectSlug: subject.slug,
    countsHere: specializationCountsHere(filters, subject.slug),
  });
  /* The hero sits over the programme list where there is one, so its
     specializations are counted from that list too: which of this
     subject's are taught here, and how many programmes each. The course
     guides' counts stay with the specialization cards below, which say
     they count courses. */
  const hero = listed
    ? countrySubjectPage({
        specializations: subject.subSubjects,
        others: [],
        subjectSlug: subject.slug,
        countsHere: programmeCountsHere(listed.facets.specialization),
      })
    : view;

  /* The design's strip counts programmes, universities, cities and
     intakes. Where the universities' programmes are listed here every
     figure is theirs, counted together so they describe the same list;
     where none are, the strip says what it always said. */
  const figures = figuresHere({
    programmes: listed ? listed.summary.programmes : filed,
    universities: listed ? listed.summary.universities : (universities.total ?? null),
    cities: listed?.summary.cities ?? null,
    // The ZIP strip has four measures; the taught count stays with its chips.
    specializations: null,
    intakes: intakeFigure(
      listed ? listedIntakes(listed.facets.intake) : (filters?.intakes ?? []),
    ),
  });

  /* Retain the subject overview after the finder. Its first paragraph
     often repeats the hero description, so do not print it twice. */
  const why = overviewParts(subject.overview, subject.shortDescription);
  const counselling = counsellingHref({
    source: 'subject',
    subject: subject.slug,
    country: country.slug,
    from: base,
  });
  /* The finder, narrowed to the same pair, landing on its results. */
  const searchHere = programmesHref(
    { country: country.slug, subject: subject.slug },
    '#discovery',
  );
  /* Nothing listed here at all: no course, and no university's programme. */
  const none = shown === 'none' && !listed;
  /* A course opened from here stays in this destination: the course page
     narrows to one country when it is told which. */
  const courseHref = (slug: string) => `/courses/${slug}?country=${country.slug}`;

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href="/study-abroad">Study abroad</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href={`/study-abroad/${country.slug}`}>{country.name}</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <Link href={`/study-abroad/${country.slug}/subjects`}>Subjects</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{subject.name}</span>
          </nav>

          <CountryFieldHero
            country={country}
            icon={subject.iconMedia}
            kind="Subject"
            fallbackIconPath={subjectIconPath(subject.slug)}
            detail={
              view.specializations.length
                ? `${view.specializations.length} ${view.specializations.length === 1 ? 'specialization' : 'specializations'}`
                : null
            }
          >
            <h1 className="hero__h1">
              {subject.name} courses in {heroWhere}
            </h1>
            <p className="hero__sub">
              {subject.shortDescription?.trim() ||
                'Explore universities, programmes, tuition fees, intakes and eligibility requirements.'}
            </p>
          </CountryFieldHero>

          <FiguresStrip figures={figures} />

          <SpecializationChips
            label={hero.taughtHere ? `Specializations · ${hero.taughtHere} taught here` : 'Specializations'}
            chips={hero.specializations.slice(0, 6).map((entry) => ({
              id: entry.id,
              name: entry.name,
              href: `${base}/${entry.slug}`,
              count: entry.here ? entry.here : undefined,
            }))}
          />
        </div>
      </section>

      {listed ? (
        <DestinationProgrammes
          compact
          base={base}
          scope={scope}
          filters={asked}
          list={listed}
          title={`${subject.name} programmes in ${where}`}
          where={`in ${where}`}
          searchHref={searchHere}
          empty={
            <p>
              Or see{' '}
              <Link className="textlink" href={`/subjects/${subject.slug}#destinations`}>
                {subject.name} in other destinations
              </Link>
              .
            </p>
          }
        />
      ) : null}

      {/* The catalogue's courses, each a guide to what the universities'
          programmes above are instances of. Their counts are of courses,
          so their links open the finder's course guides, which list that
          many. */}
      {shown === 'levels' && levels ? (
        <section className="sec sec--tight wrap" id="programs">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">{listed ? 'Courses by level' : 'Programmes'}</span>
              <h2 className="sec-title">
                {subject.name} courses in {where}, by level
              </h2>
              <p className="sec-lead">
                {formatNumber(filed)} {filed === 1 ? 'course' : 'courses'} a
                student going to {where} can apply to, each under the level it
                is taught at.
              </p>
            </div>
            <Link
              className="linkcta"
              href={levelCoursesHref({
                subject: subject.slug,
                country: country.slug,
              })}
            >
              All {formatNumber(filed)}{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <CourseLevels
            groups={levelBlock ?? levels}
            allHref={(level) =>
              levelCoursesHref({
                subject: subject.slug,
                country: country.slug,
                level,
              })
            }
            courseHref={(course) => courseHref(course.slug)}
          />
        </section>
      ) : null}

      {shown === 'list' && courses ? (
        <section className="sec sec--tight wrap" id="programs">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Programmes</span>
              <h2 className="sec-title">
                {subject.name} courses in {where}
              </h2>
            </div>
            <Link
              className="linkcta"
              href={levelCoursesHref({
                subject: subject.slug,
                country: country.slug,
              })}
            >
              All {formatNumber(courses.meta.total)}{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <div className="h-grid">
            {courses.data.map((course) => (
              <RowCard
                key={course.id}
                href={courseHref(course.slug)}
                title={course.name}
                meta={course.courseLevel.name}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Nothing taught here, said as such. The courses band used to vanish
          and the page went from the specializations straight to other
          subjects, so a reader could not tell "none listed" from "not
          loaded". Only when both reads answered: a page that could not
          reach the catalogue does not know there are none. */}
      {shown === 'none' ? (
        <section className="sec sec--tight wrap" id="programs">
          <div className="sec-head left">
            <div>
              <span className="eyebrow">Programmes</span>
              <h2 className="sec-title">
                {subject.name} courses in {where}
              </h2>
            </div>
          </div>
          {/* Not said over programmes listed above it. */}
          {none ? (
            <NothingListedHere
              field={subject.name}
              where={where}
              teaching={
                universities.total
                  ? { total: universities.total, items: universities.items }
                  : undefined
              }
              links={[
                ...(universities.total
                  ? [
                      {
                        href: subjectUniversitiesHref(country.slug, subject.slug),
                        label: `Universities teaching ${subject.name} in ${where}`,
                      },
                    ]
                  : []),
                {
                  href: `/subjects/${subject.slug}#destinations`,
                  label: `${subject.name} in other destinations`,
                },
                {
                  href: `/study-abroad/${country.slug}/subjects`,
                  label: `Other subjects in ${where}`,
                },
              ]}
            />
          ) : null}
          {/* The levels still show, each saying it has nothing here yet,
              so the page reads the same shape whatever is listed. */}
          {levelBlock?.length ? (
            <div className={none ? 'fieldnone__levels' : undefined}>
              <CourseLevels
                groups={levelBlock}
                allHref={(level) =>
                  levelCoursesHref({
                    subject: subject.slug,
                    country: country.slug,
                    level,
                  })
                }
                courseHref={(course) => courseHref(course.slug)}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* The design hands the reader on to a search already narrowed to
          what they are reading about, straight after the courses. Where
          nothing is listed here the search opens on the field everywhere,
          rather than on an empty result. */}
      <MatchBand
        heading={`Find ${subject.name} courses for your profile`}
        lead={
          none
            ? `The course search has no ${subject.name} course in ${where} yet, so it opens on ${subject.name} in every destination. Narrow it by level, budget and intake.`
            : `Now find the ${subject.name} programmes in ${where} that match your academic profile, budget and intake.`
        }
        href={none ? `/courses?subject=${subject.slug}` : searchHere}
        talkHref={counselling}
      />

      <CountryTabs tabs={tabs} current="subjects" below />

      {why.lead || why.rest ? (
        <section className="sec sec--tight wrap" id="why">
          <div className="sec-head left">
            <div>
              <span className="eyebrow">Why study it</span>
              <h2 className="sec-title">
                Why study {subject.name} in {where}?
              </h2>
            </div>
          </div>
          {why.lead ? (
            <div className="prose fieldwhy__lead">
              <RichText value={why.lead} />
            </div>
          ) : null}
          {why.rest ? (
            <Longform label={`More about ${subject.name}`}>
              <div className="prose">
                <RichText value={why.rest} />
              </div>
            </Longform>
          ) : null}
        </section>
      ) : null}

      {view.specializations.length ? (
        <section className="sec sec--tight wrap" id="specializations">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Fields of study</span>
              <h2 className="sec-title">
                Specializations in {where}
              </h2>
              <p className="sec-lead">
                {view.specializations.length} inside {subject.name}.{' '}
                {view.taughtHere === null
                  ? `Each one opens on what it means for a student going to ${where}.`
                  : view.taughtHere
                    ? `${view.taughtHere === view.specializations.length ? 'All of them have' : `${view.taughtHere} of them ${view.taughtHere === 1 ? 'has' : 'have'}`} courses listed in ${where}${view.taughtHere < view.specializations.length ? ', and those come first' : ''}. Each one opens on what it means for a student going there.`
                    : `None has a course listed in ${where} yet; each one still opens on what it means for a student going there.`}
              </p>
            </div>
            <div className="field-directory__links">
              <a className="linkcta" href="#specialization-list">
                Explore specializations <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
              </a>
              <Link className="linkcta" href={`/subjects/${subject.slug}`}>
                {subject.name} everywhere{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
              </Link>
            </div>
          </div>
          <div className="h-grid" id="specialization-list">
            {view.specializations.map((entry) => (
              <RowCard
                key={entry.id}
                href={`${base}/${entry.slug}`}
                title={entry.name}
                meta={countLabel(entry.here, 'course')}
              />
            ))}
          </div>
        </section>
      ) : null}

      {view.others.length ? (
        <section className="sec sec--tight wrap">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Explore next</span>
              <h2 className="sec-title">More subjects in {where}</h2>
            </div>
            <Link
              className="linkcta"
              href={`/study-abroad/${country.slug}/subjects`}
            >
              All subjects{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <div className="h-grid">
            {view.others.map((entry) => (
              <RowCard
                key={entry.id}
                href={`/study-abroad/${country.slug}/${entry.slug}`}
                title={entry.name}
                mark
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* The people who could help, as the reference offers them here.
          Consultants carry no subject, so these are the destination's,
          and the band says which field the reader came about. */}
      <CountryConsultants
        countryName={country.name}
        countrySlug={country.slug}
        presence={page.consultants}
        alt={false}
        heading={`Need help applying for ${subject.name} in ${where}?`}
      />

      {/* Out of the subject and into the country it is studied in. */}
      <CountryGuideLinks
        countrySlug={country.slug}
        where={where}
        links={guideLinks(page, tabCounts(tabs))}
      />

      <PlanBand
        heading={`Thinking about ${subject.name} in ${where}?`}
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{
          href: `/study-abroad/${country.slug}`,
          label: `${country.name} guide`,
        }}
      />

      <ConnectBand
        actions={[
          /* With nothing listed here, "these courses" would open an empty
             search; the field everywhere is the useful next step. */
          none
            ? {
                href: `/courses?subject=${subject.slug}`,
                label: `Browse ${subject.name} courses`,
              }
            : { href: searchHere, label: 'Browse these courses' },
          /* The group below names six. This is the rest of them: the
             country's list, opened on this field. Only when there is
             one, since the list sets aside a field nothing there teaches
             and would open on every university instead. */
          ...(universities.total
            ? [
                {
                  href: subjectUniversitiesHref(country.slug, subject.slug),
                  label: `Universities teaching ${subject.name}`,
                  ghost: true,
                },
              ]
            : []),
          {
            href: `/study-abroad/${country.slug}/universities`,
            label: `Universities in ${where}`,
            ghost: true,
          },
          { href: `/subjects/${subject.slug}`, label: subject.name, ghost: true },
          /* An enquiry that already says what it is about. */
          { href: counselling, label: 'Talk to a Universta advisor', ghost: true },
        ]}
        groups={[
          {
            title: 'Specializations',
            /* It names six; the count is of all of them. */
            total: view.specializations.length,
            items: view.specializations.slice(0, 6).map((entry) => ({
              id: entry.id,
              name: entry.name,
              href: `${base}/${entry.slug}`,
            })),
          },
          universities,
        ]}
      />
    </>
  );
}
