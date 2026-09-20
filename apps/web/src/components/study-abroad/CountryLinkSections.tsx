import Link from 'next/link';
import type { Country, ProfileSummary } from '@/lib/countries';

/**
 * The country guide's sections that link out to the rest of the catalogue:
 * what the destination has, and where to go next.
 *
 * The approved design ships these with their own filtering widgets -- a
 * university card grid and a subject explorer, each with its own search and
 * level filters. Those filters already exist on `/universities`, `/courses`
 * and `/subjects`, which hold the whole catalogue rather than one country's
 * slice, so these sections surface what the destination has and hand the
 * student on rather than carrying a second copy of the same controls.
 *
 * Every section renders only when it has something to show. A country guide
 * that says "0 universities" states an absence the student cannot act on,
 * which is the same rule the snapshot panel and the directory already follow.
 */

function SplitHead({
  index,
  eyebrow,
  title,
  lead,
  cta,
}: {
  index: string;
  eyebrow: string;
  title: string;
  lead: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="sec-head sec-head--split">
      <div className="sec-head__aside">
        <p className="eyebrow">
          <span className="eyebrow__n">{index}</span> {eyebrow}
        </p>
        <h2 className="sec-title">{title}</h2>
      </div>
      <div>
        <p className="sec-lead">{lead}</p>
        {cta ? (
          <div className="btn-row" style={{ marginTop: 20 }}>
            <Link className="btn" href={cta.href}>
              {cta.label}{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "By the numbers".
 *
 * Every figure is one the catalogue already holds, and a figure with nothing
 * behind it is left out rather than shown as a zero or a dash.
 */
export function CountryNumbers({
  country,
  profiles,
}: {
  country: Country;
  profiles: ProfileSummary;
}) {
  const stats = country.derived?.statistics;
  const intakeCount = country.configuration?.intakeMonths?.length ?? 0;
  const workMonths = country.configuration?.postStudyWorkPermitMonths ?? null;
  const symbol = country.currency?.symbol ?? '';
  const tuitionMin = profiles?.cost?.tuitionMin ?? null;

  const figures: Array<{ value: string; label: string }> = [];
  if (stats?.universitiesCount)
    figures.push({ value: String(stats.universitiesCount), label: 'Universities profiled' });
  if (stats?.publicUniversitiesCount)
    figures.push({
      value: String(stats.publicUniversitiesCount),
      label: 'Public universities',
    });
  if (stats?.coursesCount)
    figures.push({ value: String(stats.coursesCount), label: 'Programmes listed' });
  if (tuitionMin !== null && tuitionMin !== undefined)
    figures.push({
      value: `${symbol}${Number(tuitionMin).toLocaleString('en-US')}`,
      label: 'Tuition from, per year',
    });
  if (intakeCount)
    figures.push({
      value: String(intakeCount),
      label: intakeCount === 1 ? 'Intake per year' : 'Intakes per year',
    });
  if (workMonths)
    figures.push({ value: String(workMonths), label: 'Months of post-study work' });

  if (figures.length < 2) return null;

  return (
    <section className="sec sec--paper" id="numbers">
      <div className="wrap">
        <SplitHead
          index="09"
          eyebrow="By the numbers"
          title={`Study in ${country.name} by the numbers`}
          lead="The figures that shape a decision, taken from what is published on Universta."
        />
        <div className="bignums">
          {figures.map((figure) => (
            <div className="bignum" key={figure.label}>
              <div className="bignum__v">{figure.value}</div>
              <div className="bignum__l">{figure.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** "Explore universities in <country>". */
export function CountryUniversities({ country }: { country: Country }) {
  /* Ranked first when an editor has curated them, then whatever else is
     published, so the section is never empty while universities exist. */
  const universities = [
    ...(country.derived?.topRankedUniversities ?? []),
    ...(country.derived?.popularUniversities ?? []),
  ].filter(
    (university, index, all) =>
      all.findIndex((other) => other.id === university.id) === index,
  );
  if (!universities.length) return null;

  const count = country.derived?.statistics?.universitiesCount ?? universities.length;
  const courses = country.derived?.statistics?.coursesCount ?? 0;

  return (
    <section className="sec sec--white" id="universities">
      <div className="wrap">
        <SplitHead
          index="04"
          eyebrow="Universities"
          title={`Explore universities in ${country.name}`}
          lead={
            courses
              ? `${count} ${count === 1 ? 'university' : 'universities'} and ${courses} ${courses === 1 ? 'programme' : 'programmes'} profiled with tuition, entry requirements and deadlines.`
              : `${count} ${count === 1 ? 'university' : 'universities'} profiled with tuition, entry requirements and deadlines.`
          }
          cta={{ href: '/universities', label: 'Explore all universities' }}
        />
        <div className="h-grid h-grid--wide">
          {universities.slice(0, 6).map((university) => (
            <Link className="h-card" href={`/universities/${university.slug}`} key={university.id}>
              <strong className="h-card__t">{university.name}</strong>
              {university.institutionType ? (
                <span className="h-card__d">{university.institutionType}</span>
              ) : null}
              {university.qsRanking ? (
                <span className="h-card__m">QS #{university.qsRanking}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** "Popular subjects to study in <country>". */
export function CountrySubjects({ country }: { country: Country }) {
  const subjects = country.subjects ?? [];
  if (!subjects.length) return null;

  return (
    <section className="sec sec--paper" id="subjects">
      <div className="wrap">
        <SplitHead
          index="05"
          eyebrow="Find your field"
          title={`Popular subjects to study in ${country.name}`}
          lead="Explore the fields taught here, then see the courses and specializations inside each one."
          cta={{ href: '/subjects', label: 'Browse the full subject taxonomy' }}
        />
        <div className="h-grid h-grid--4">
          {subjects.map((subject) => (
            <Link className="h-card" href={`/subjects/${subject.slug}`} key={subject.id}>
              <strong className="h-card__t">{subject.name}</strong>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export type CountryCourseCard = {
  id: string;
  name: string;
  slug: string;
  courseLevel: { name: string } | null;
  subject: { name: string } | null;
};

/** "Courses to explore". */
export function CountryCourses({
  country,
  courses,
}: {
  country: Country;
  courses: CountryCourseCard[];
}) {
  if (!courses.length) return null;

  return (
    <section className="sec sec--white" id="courses">
      <div className="wrap">
        <SplitHead
          index="06"
          eyebrow="Courses"
          title={`Courses to explore in ${country.name}`}
          lead="Each course page carries its tuition, entry requirements, intakes and deadlines."
          cta={{ href: '/courses', label: 'Search every course' }}
        />
        <div className="h-grid h-grid--wide">
          {courses.slice(0, 6).map((course) => (
            <Link className="h-card" href={`/courses/${course.slug}`} key={course.id}>
              <strong className="h-card__t">{course.name}</strong>
              {course.subject ? <span className="h-card__d">{course.subject.name}</span> : null}
              {course.courseLevel ? (
                <span className="h-card__m">{course.courseLevel.name}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * "Explore next" -- the closing band of country-filtered ways on.
 *
 * Every link carries the country, so a student leaves the guide with the
 * listing already narrowed to the destination they were reading about rather
 * than at the top of an unfiltered catalogue.
 */
export function CountryConnect({ country }: { country: Country }) {
  return (
    <section className="sec sec--paper sec--tight h-connect" id="connect">
      <div className="wrap">
        <div className="h-next">
          <p className="eyebrow eyebrow--plain">Explore next</p>
          <div className="btn-row">
            <Link className="btn btn--sm" href={`/courses?country=${country.slug}`}>
              Explore courses in {country.name}
            </Link>
            <Link
              className="btn btn--sm btn--ghost"
              href={`/scholarships?country=${country.slug}`}
            >
              Find scholarships
            </Link>
            <Link className="btn btn--sm btn--ghost" href="/counselling">
              Talk to a Universta advisor
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export type CountryScholarshipCard = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  provider?: { name?: string | null } | null;
};

/** "Funding to look into". */
export function CountryScholarships({
  country,
  scholarships,
}: {
  country: Country;
  scholarships: CountryScholarshipCard[];
}) {
  if (!scholarships.length) return null;

  return (
    <section className="sec sec--paper" id="scholarship-funding">
      <div className="wrap">
        <SplitHead
          index="07"
          eyebrow="Funding"
          title={`Scholarships for ${country.name}`}
          lead="Funding open to international students here, with the eligibility each one publishes."
          cta={{ href: '/scholarships', label: 'Find scholarships' }}
        />
        <div className="h-grid h-grid--wide">
          {scholarships.slice(0, 6).map((scholarship) => (
            <Link
              className="h-card"
              href={`/scholarships/${scholarship.slug}`}
              key={scholarship.id}
            >
              <strong className="h-card__t">{scholarship.title}</strong>
              {scholarship.summary ? (
                <span className="h-card__d">{scholarship.summary}</span>
              ) : null}
              {scholarship.provider?.name ? (
                <span className="h-card__m">{scholarship.provider.name}</span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
