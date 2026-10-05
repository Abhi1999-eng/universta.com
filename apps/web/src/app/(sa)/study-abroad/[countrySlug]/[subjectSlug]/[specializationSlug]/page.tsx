import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CountryTrail } from '@/components/study-abroad/CountryTrail';
import { CountryTabs } from '@/components/study-abroad/CountryTabs';
import { CountryGuideLinks } from '@/components/study-abroad/CountryGuideLinks';
import {
  CountryFieldHero,
  FiguresStrip,
  NothingListedHere,
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
  getSpecialization,
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
  figuresHere,
  intakeFigure,
  overviewParts,
  programmesHere,
  rankSpecializations,
  specializationCountsHere,
} from '@/lib/country-subject';
import {
  consultantsGroup,
  scholarshipsGroup,
  specializationUniversities,
} from '@/lib/country-subject-related';

/**
 * The narrowest page the catalogue can answer: one specialization, in one
 * destination.
 *
 * It exists because the level above it stops short. "Agriculture in the UK"
 * is still a shelf; "Agronomy in the UK" is a decision. The specialization
 * is also the only one of the three names that is not unique on its own --
 * its slug is unique inside its subject, so `artificial-intelligence` is a
 * record under Computer Science and another under Engineering. Nesting it
 * under the subject is what makes the URL mean one of them.
 */
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{
    countrySlug: string;
    subjectSlug: string;
    specializationSlug: string;
  }>;
};

async function load(
  countrySlug: string,
  subjectSlug: string,
  specializationSlug: string,
) {
  const [page, specialization] = await Promise.all([
    getStudyAbroadCountry(countrySlug),
    getSpecialization(subjectSlug, specializationSlug).catch(() => null),
  ]);
  if (!page?.country || !specialization) return null;
  return { page, country: page.country, specialization };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { countrySlug, subjectSlug, specializationSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug, specializationSlug);
  if (!loaded)
    return {
      title: { absolute: 'Not found | Universta' },
      robots: { index: false },
    };
  const { country, specialization } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  return {
    title: {
      absolute: `Study ${specialization.name} in ${where} | Universta`,
    },
    description:
      specialization.shortDescription ??
      `Programmes and universities for ${specialization.name} available to students going to ${where}.`,
    alternates: {
      canonical: `/study-abroad/${country.slug}/${specialization.subject.slug}/${specialization.slug}`,
    },
  };
}

export default async function Page({ params }: Params) {
  const { countrySlug, subjectSlug, specializationSlug } = await params;
  const loaded = await load(countrySlug, subjectSlug, specializationSlug);
  if (!loaded) notFound();
  const { page, country, specialization } = loaded;
  const where = inCountry(country.name, country.iso2Code);
  const subject = specialization.subject;
  const subjectHref = `/study-abroad/${country.slug}/${subject.slug}`;
  const self = `${subjectHref}/${specialization.slug}`;

  /* Courses under their levels, and only what this destination teaches;
     the course filters for the same three, which name the intakes and count
     this destination's courses in each sibling; the tab strip; and the
     closing band's groups. Read together, and each failure costs only what
     it feeds. */
  const [levels, filters, tabs, teaching, scholarships, consultants] =
    await Promise.all([
      getCoursesByLevel({
        subject: subject.slug,
        subSubject: specialization.slug,
        country: country.slug,
        perLevel: LEVEL_ROWS_FETCHED,
      }).catch(() => null),
      getCourseFilterOptions({
        subject: subject.slug,
        subSubject: specialization.slug,
        country: country.slug,
      }).catch(() => null),
      loadCountryTabs(country.slug, (country.subjects ?? []).length),
      specializationUniversities(subject, specialization, country, where),
      scholarshipsGroup(country.slug, where),
      consultantsGroup(country.slug, where),
    ]);
  /* The mixed run of nine is kept for when the grouped read fails. */
  const courses = levels
    ? null
    : await getCourses({
        country: country.slug,
        subject: subject.slug,
        subSubject: specialization.slug,
        limit: '9',
      }).catch(() => null);
  const shown = programmesHere(levels, courses);
  const total = levels ? levelTotal(levels) : (courses?.meta.total ?? 0);

  /* The destination does not have to claim the field. It used to: a page
     rendered only where the country listed the subject or published a
     course in it, which meant a destination with no courses yet 404d on
     every one of the thirty fields the catalogue knows. The taxonomy is
     not per-country -- what varies is which fields have programmes behind
     them here, and this page says that plainly where there are none. The
     subject itself still has to exist, which `load` has already settled. */

  /* All of them. The API sends a dozen at most and the page showed eight,
     so a third of a subject's other specializations could not be reached
     from one of its own. The ones taught here come first, with this
     destination's count; the filters' specialization counts leave this
     one's own filter aside, so they cover every sibling. */
  const countsHere = specializationCountsHere(filters, subject.slug);
  const siblings = rankSpecializations(
    specialization.siblings.filter((entry) => entry.slug !== specialization.slug),
    (entry) => countsHere?.get(entry.slug) ?? 0,
  );
  const figures = figuresHere({
    programmes: total,
    universities: teaching.total,
    intakes: intakeFigure(filters?.intakes ?? []),
  });

  /* What the specialization is, said for this destination: the reference
     opens on it, and this page went from the hero straight to the courses
     without ever saying Software Engineering is a part of Computer
     Science. The overview's first paragraph is usually the short
     description the hero has printed, so it is not repeated. */
  const about = overviewParts(
    specialization.overview,
    specialization.shortDescription,
  );
  const searchHere = `/courses?country=${country.slug}&subject=${subject.slug}&subSubject=${specialization.slug}`;
  const searchEverywhere = `/courses?subject=${subject.slug}&subSubject=${specialization.slug}`;
  const counselling = counsellingHref({
    source: 'specialization',
    subject: subject.slug,
    specialization: specialization.slug,
    country: country.slug,
    from: self,
  });
  /* A course opened from here stays in this destination: the course page
     narrows to one country when it is told which, and without it a reader
     who came for the United Kingdom landed on all ten. */
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
            <Link href={subjectHref}>{subject.name}</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{specialization.name}</span>
          </nav>

          <CountryFieldHero
            country={country}
            icon={specialization.iconMedia}
            kind="Specialization"
            detail={
              <>
                within <Link href={subjectHref}>{subject.name}</Link>
              </>
            }
          >
            <h1 className="hero__h1">
              Study {specialization.name} in {where}
            </h1>

            <CountryTrail
              country={country}
              parts={[
                { label: subject.name, href: subjectHref },
                { label: specialization.name },
              ]}
            />

            {specialization.shortDescription ? (
              <p className="hero__sub">{specialization.shortDescription}</p>
            ) : null}

            {/* Up one level, and still in this country: the rest of the
                subject as it is studied here. */}
            <div className="btn-row">
              <Link className="btn btn--lg btn--wrap" href={subjectHref}>
                {subject.name} in {where}{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </div>
          </CountryFieldHero>

          <FiguresStrip figures={figures} />
        </div>
      </section>

      <CountryTabs tabs={tabs} current="subjects" below />

      <section className="sec sec--tight wrap" id="about">
        <div className="sec-head left">
          <div>
            <span className="eyebrow">Overview</span>
            <h2 className="sec-title">
              Studying {specialization.name} in {where}
            </h2>
          </div>
        </div>
        <div className="prose fieldwhy__lead">
          <p>
            {specialization.name} is a specialization within{' '}
            <Link className="textlink" href={subjectHref}>
              {subject.name}
            </Link>
            {`. Universities in ${where} may teach it as a degree of its own or as a pathway inside a broader ${subject.name} programme, so compare what each course covers, its entry requirements and its fees on the university’s own pages.`}
          </p>
          {about.lead ? <RichText value={about.lead} /> : null}
        </div>
        {about.rest ? (
          <Longform label={`More about ${specialization.name}`}>
            <div className="prose">
              <RichText value={about.rest} />
            </div>
          </Longform>
        ) : null}
      </section>

      <section className="sec sec--tight wrap" id="programs">
        <div className="sec-head left row-between">
          <div>
            <span className="eyebrow">Programmes</span>
            <h2 className="sec-title">
              {specialization.name} in {where}
            </h2>
            {total ? (
              <p className="sec-lead">
                {`${formatNumber(total)} published ${total === 1 ? 'programme' : 'programmes'} a student going to ${where} can apply to${levels?.length ? ', each under the level it is taught at' : ''}.`}
              </p>
            ) : shown === 'unknown' ? (
              /* Neither read answered, so the page does not know whether
                 there are any; it used to say there were none. */
              <p className="sec-lead">
                The programmes could not be loaded just now. The search
                lists them.
              </p>
            ) : null}
          </div>
          {total || shown === 'unknown' ? (
            <Link className="linkcta" href={searchHere}>
              Open in search{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          ) : null}
        </div>
        {levels?.length ? (
          <CourseLevels
            groups={levels}
            branch={false}
            allHref={(level) =>
              levelCoursesHref({
                subject: subject.slug,
                subSubject: specialization.slug,
                country: country.slug,
                level,
              })
            }
            courseHref={(course) => courseHref(course.slug)}
          />
        ) : null}
        {courses?.data.length ? (
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
        ) : null}
        {/* Said plainly, and with the two ways on: the specialization where
            it is taught, and the rest of the subject here. The line it
            replaces sent the reader to the subject here as having "more that
            may fit", which in a destination teaching none of it was not so. */}
        {shown === 'none' ? (
          <NothingListedHere
            field={specialization.name}
            where={where}
            links={[
              {
                href: `/subjects/${subject.slug}/${specialization.slug}#destinations`,
                label: `${specialization.name} in other destinations`,
              },
              { href: subjectHref, label: `${subject.name} in ${where}` },
            ]}
          />
        ) : null}
      </section>

      {/* The design's hand-on to a search narrowed to this specialization
          here, and to an advisor who is told what the reader came about.
          With nothing listed here the search opens on it everywhere. */}
      <MatchBand
        heading={`Find ${specialization.name} courses for your profile`}
        lead={
          shown === 'none'
            ? `None is listed in ${where} yet, so the search opens on ${specialization.name} in every destination.`
            : `Now find the ${specialization.name} programmes in ${where} that match your academic profile, budget and intake.`
        }
        href={shown === 'none' ? searchEverywhere : searchHere}
        talkHref={counselling}
      />

      {siblings.length ? (
        <section className="sec sec--tight wrap">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Explore next</span>
              <h2 className="sec-title">
                More in {subject.name}, in {where}
              </h2>
            </div>
            <Link className="linkcta" href={subjectHref}>
              All of {subject.name}{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <div className="h-grid">
            {siblings.map((entry) => (
              <RowCard
                key={entry.id}
                href={`${subjectHref}/${entry.slug}`}
                title={entry.name}
                meta={countLabel(countsHere?.get(entry.slug), 'course')}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Out of the specialization and into the country it is studied in. */}
      <CountryGuideLinks
        countrySlug={country.slug}
        where={where}
        links={guideLinks(page, tabCounts(tabs))}
      />

      <PlanBand
        heading={`Is ${specialization.name} in ${where} right for you?`}
        countrySlug={country.slug}
        countryName={country.name}
        secondary={{ href: subjectHref, label: `${subject.name} in ${where}` }}
      />

      <ConnectBand
        actions={[
          /* With nothing listed here, "these courses" would open an empty
             search; the specialization everywhere is the useful next step. */
          shown === 'none'
            ? {
                href: searchEverywhere,
                label: `Browse ${specialization.name} courses`,
              }
            : { href: searchHere, label: 'Browse these courses' },
          {
            href: `/subjects/${subject.slug}/${specialization.slug}`,
            label: `${specialization.name} everywhere`,
            ghost: true,
          },
          {
            href: `/study-abroad/${country.slug}/universities`,
            label: `Universities in ${where}`,
            ghost: true,
          },
          /* An enquiry that arrives saying which specialization, in which
             destination, the reader was looking at. */
          { href: counselling, label: 'Talk to a Universta advisor', ghost: true },
        ]}
        groups={[
          {
            title: `More in ${subject.name}`,
            /* It names six; the count is of all of them. It printed 6 over
               a subject with eleven others. */
            total: siblings.length,
            items: siblings.slice(0, 6).map((entry) => ({
              id: entry.id,
              name: entry.name,
              href: `${subjectHref}/${entry.slug}`,
            })),
          },
          teaching.group,
          scholarships,
          consultants,
        ]}
      />
    </>
  );
}
