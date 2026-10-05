import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CountryTrail } from '@/components/study-abroad/CountryTrail';
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
  getCourses,
  getCoursesByLevel,
  getSubject,
} from '@/lib/catalog';
import {
  LEVEL_ROWS_FETCHED,
  levelCoursesHref,
  levelTotal,
} from '@/lib/course-levels';
import { CourseLevels } from '@/components/study-abroad/CourseLevels';
import { getStudyAbroadCountry } from '@/lib/study-abroad';
import { formatNumber } from '@/lib/format';
import { inCountry } from '@/lib/country-article';
import { counsellingHref } from '@/lib/counselling-link';
import {
  countrySubjectPage,
  figuresHere,
  intakeFigure,
  overviewParts,
  programmesHere,
  specializationCountsHere,
} from '@/lib/country-subject';
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

type Params = { params: Promise<{ countrySlug: string; subjectSlug: string }> };

async function load(countrySlug: string, subjectSlug: string) {
  const [page, subject] = await Promise.all([
    getStudyAbroadCountry(countrySlug),
    getSubject(subjectSlug).catch(() => null),
  ]);
  if (!page?.country || !subject) return null;
  return { page, country: page.country, subject };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { countrySlug, subjectSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug);
  if (!loaded)
    return {
      title: { absolute: 'Not found | Universta' },
      robots: { index: false },
    };
  const { country, subject } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  return {
    title: { absolute: `Study ${subject.name} in ${where} | Universta` },
    description:
      subject.shortDescription ??
      `The specializations, universities and programmes available in ${subject.name} for students going to ${where}.`,
    alternates: {
      canonical: `/study-abroad/${country.slug}/${subject.slug}`,
    },
  };
}

export default async function Page({ params }: Params) {
  const { countrySlug, subjectSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug);
  if (!loaded) notFound();
  const { page, country, subject } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  const base = `/study-abroad/${country.slug}/${subject.slug}`;

  /* Courses under their levels, and only what this destination teaches;
     the course filters for the same pair, which count this destination's
     courses per specialization and name its intakes; the tab strip; and
     the universities that teach the field here. Read together, and each
     failure costs only what it feeds. */
  const [levels, filters, tabs, universities] = await Promise.all([
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
  ]);
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
  const taught = view.specializations.filter((entry) => (entry.here ?? 0) > 0);
  const figures = figuresHere({
    programmes: filed,
    universities: universities.total ?? null,
    specializations: view.taughtHere,
    intakes: intakeFigure(filters?.intakes ?? []),
  });

  /* The reference opens the page on why the field is worth studying, from
     the subject's own overview. Its first paragraph is usually the short
     description the hero has just printed, so that one is not said twice. */
  const why = overviewParts(subject.overview, subject.shortDescription);
  const counselling = counsellingHref({
    source: 'subject',
    subject: subject.slug,
    country: country.slug,
    from: base,
  });
  const searchHere = `/courses?country=${country.slug}&subject=${subject.slug}`;
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
            detail={
              view.specializations.length
                ? `${view.specializations.length} ${view.specializations.length === 1 ? 'specialization' : 'specializations'}`
                : null
            }
          >
            <h1 className="hero__h1">
              Study {subject.name} in {where}
            </h1>

            {/* Both halves of what this page is, each a link back to itself.
                A reader who arrived from the subject can leave through the
                destination, and the other way round. */}
            <CountryTrail
              country={country}
              parts={[{ label: subject.name, href: `/subjects/${subject.slug}` }]}
            />

            {subject.shortDescription ? (
              <p className="hero__sub">{subject.shortDescription}</p>
            ) : null}

            {view.specializations.length ? (
              <div className="btn-row">
                <a className="btn btn--lg" href="#specializations">
                  Explore specializations{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </a>
              </div>
            ) : null}
          </CountryFieldHero>

          <FiguresStrip figures={figures} />

          <SpecializationChips
            chips={taught.map((entry) => ({
              id: entry.id,
              name: entry.name,
              href: `${base}/${entry.slug}`,
              count: entry.here ?? 0,
            }))}
          />
        </div>
      </section>

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
            <Link className="linkcta" href={`/subjects/${subject.slug}`}>
              {subject.name} everywhere{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <div className="h-grid">
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

      {shown === 'levels' && levels ? (
        <section className="sec sec--tight wrap" id="programs">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Programmes</span>
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
            groups={levels}
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
            <Link className="linkcta" href={searchHere}>
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
          <NothingListedHere
            field={subject.name}
            where={where}
            links={[
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
        </section>
      ) : null}

      {/* The design hands the reader on to a search already narrowed to
          what they are reading about, straight after the courses. Where
          nothing is listed here the search opens on the field everywhere,
          rather than on an empty result. */}
      <MatchBand
        heading={`Find ${subject.name} courses for your profile`}
        lead={
          shown === 'none'
            ? `None is listed in ${where} yet, so the search opens on ${subject.name} in every destination. Narrow it by level, budget and intake.`
            : `Now find the ${subject.name} programmes in ${where} that match your academic profile, budget and intake.`
        }
        href={shown === 'none' ? `/courses?subject=${subject.slug}` : searchHere}
        talkHref={counselling}
      />

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
          shown === 'none'
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
