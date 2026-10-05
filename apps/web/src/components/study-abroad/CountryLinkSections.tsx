import Link from 'next/link';
import { RowCard, countLabel } from './RowCard';
import type { Country, CountryTestimonial, ProfileSummary } from '@/lib/countries';
import { monthNames } from '@/lib/study-abroad-view';
import { inCountry } from '@/lib/country-article';
import { SectionHead } from './SectionHead';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import type { ScholarshipCard } from '@/lib/scholarship-card';
import { UniversityCard, type UniversityCardData } from './UniversityCard';
import { countryUniversitiesHref } from '@/lib/university-links';

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
  index?: string | null;
  eyebrow: string;
  title: string;
  lead: string;
  cta?: { href: string; label: string };
}) {
  return (
    <SectionHead n={index} eyebrow={eyebrow} title={title} lead={lead}>
      {cta ? (
        <div className="btn-row sec-head__cta">
          <Link className="btn" href={cta.href}>
            {cta.label}{' '}
            <span className="btn__arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      ) : null}
    </SectionHead>
  );
}

/**
 * A figure on the "by the numbers" band, and what it means for a reader.
 *
 * The meaning is derived from the same published data as the figure, never
 * written per country: a number on its own decides nothing, and the honest
 * thing to say about it is where it comes from and what it does not say.
 */
export type CountryFigure = { value: string; label: string; meaning: string };

/**
 * "By the numbers": the figures a country actually has, in the order the
 * section shows them. A figure with nothing behind it is left out rather than
 * shown as a zero or a dash., in the order the section shows them.
 *
 * Exported because the page has to know whether this section will render
 * before it renders: the bands alternate by position, so a section that
 * stands down has to stand down in the page's count too.
 */
export function countryFigures(
  country: Country,
  profiles: ProfileSummary,
): CountryFigure[] {
  const where = inCountry(country.name, country.iso2Code);
  const stats = country.derived?.statistics;
  const months = country.configuration?.intakeMonths ?? [];
  const intakeCount = months.length;
  const workMonths = country.configuration?.postStudyWorkPermitMonths ?? null;
  const symbol = country.currency?.symbol ?? '';
  const tuitionMin = profiles?.cost?.tuitionMin ?? null;
  const tuitionMax = profiles?.cost?.tuitionMax ?? null;
  const internationalStudents = country.statistics?.internationalStudentsCount ?? null;
  const money = (value: string | number) =>
    `${symbol}${Number(value).toLocaleString('en-US')}`;

  const figures: CountryFigure[] = [];
  if (stats?.universitiesCount)
    figures.push({
      value: String(stats.universitiesCount),
      label: 'Universities profiled',
      meaning: `University profiles Universta holds for ${where}, each with its own courses, fees and entry requirements. It is what we cover, not a count of every institution in the country.`,
    });
  if (stats?.publicUniversitiesCount)
    figures.push({
      value: String(stats.publicUniversitiesCount),
      label: 'Public universities',
      meaning: stats.universitiesCount
        ? `Of the ${stats.universitiesCount} profiled. A public university usually publishes one international fee for a programme; a private one sets its own, so the two are worth shortlisting separately.`
        : 'A public university usually publishes one international fee for a programme; a private one sets its own, so the two are worth shortlisting separately.',
    });
  if (stats?.coursesCount)
    figures.push({
      value: String(stats.coursesCount),
      label: 'Programmes listed',
      meaning: `Programmes published across those universities, filterable by subject and level. A subject with few programmes here is a subject to check directly with the university before you build a shortlist around it.`,
    });
  /* The one figure on the band that Universta cannot count for itself: it is
     published only because an editor recorded it. */
  if (internationalStudents)
    figures.push({
      value: internationalStudents.toLocaleString('en-US'),
      label: 'International students',
      meaning: `The country's own published figure, recorded by an editor rather than counted by Universta. It says how used to international students the system is -- support services, English-taught provision, visa processing -- rather than anything about your own chances.`,
    });
  if (tuitionMin !== null && tuitionMin !== undefined)
    figures.push({
      value: money(tuitionMin),
      label: 'Tuition from, per year',
      meaning:
        tuitionMax !== null && tuitionMax !== undefined
          ? `The lowest international rate published for ${where}; the range runs to ${money(tuitionMax)}. Your own figure sits somewhere between the two and depends on the university and the programme, not on the destination alone.`
          : `The lowest international rate published for ${where}. Your own figure depends on the university and the programme, not on the destination alone.`,
    });
  if (intakeCount)
    figures.push({
      value: String(intakeCount),
      label: intakeCount === 1 ? 'Intake per year' : 'Intakes per year',
      meaning: `${listMonths(monthNames(months))}. Applications usually open several months ahead of each one, so the intake you are aiming at decides when your documents have to be ready -- not when the course starts.`,
    });
  if (workMonths)
    figures.push({
      value: String(workMonths),
      label: 'Months of post-study work',
      meaning: `How long you may stay on to work after finishing. It is the length of the permit, not a job offer: it decides how much time you have to find work that could lead to a longer stay.`,
    });

  return figures;
}

/** "January and September", "January, May and September". */
function listMonths(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Two figures is the floor: one number on its own is a statistic, not a section. */
export const hasCountryFigures = (country: Country, profiles: ProfileSummary) =>
  countryFigures(country, profiles).length >= 2;

export function CountryNumbers({
  country,
  profiles,
  n = null,
  alt,
}: {
  country: Country;
  profiles: ProfileSummary;
  n?: string | null;
  alt: boolean;
}) {
  const figures = countryFigures(country, profiles);
  if (figures.length < 2) return null;

  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'}`} id="numbers">
      <div className="wrap">
        <SplitHead
          index={n}
          eyebrow="By the numbers"
          title={`Study in ${inCountry(country.name, country.iso2Code)} by the numbers`}
          lead="The figures that shape a decision, taken from what is published on Universta."
        />
        {/* Each figure says what it means, here, beside itself.
            It used to say it in a section of its own further down the page --
            an accordion of the same five numbers, each one opening on the
            sentence below. Two bands for one fact, and the sentence only
            reachable by a click nobody made. Three across rather than five,
            because a number with a caption under it needs the width. */}
        <div
          className="bignums"
          style={{ '--cols': Math.min(figures.length, 3) } as React.CSSProperties}
        >
          {figures.map((figure) => (
            <div className="bignum" key={figure.label}>
              <div className="bignum__v">{figure.value}</div>
              <div className="bignum__l">{figure.label}</div>
              <p className="bignum__m">{figure.meaning}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The universities to show for a country: ranked first when an editor has
 * curated them, then whatever else is published, so the section is never empty
 * while universities exist.
 */
/** What the band knows about a university: at least a name and an address,
 * and whatever else of the list's row arrived -- city, programmes, subjects
 * -- which the card shows when it has it. */
export type CountryUniversityCard = UniversityCardData;

/**
 * The institutions this band shows.
 *
 * It used to read only the two curated lists on `derived`, and both are
 * empty for every destination in the catalogue: `topRankedUniversities`
 * asks the database for `qsRanking > 0` and no imported university carries
 * a ranking, while `popularUniversities` is a table an editor fills by
 * hand and nobody has. So a destination with 159 universities rendered no
 * universities section at all -- while the count sitting beside those
 * lists said 159.
 *
 * `fallback` is the destination's own universities, read by the page the
 * same way its /universities sub-page reads them. It is used when the
 * curated lists have nothing, which is also what happens when `derived`
 * fails to arrive: the block comes back null under load, and a timeout
 * should cost a ranking order, not the whole section.
 */
export function countryUniversities(
  country: Country,
  fallback: CountryUniversityCard[] = [],
) {
  const curated = [
    ...(country.derived?.topRankedUniversities ?? []),
    ...(country.derived?.popularUniversities ?? []),
  ];
  return (curated.length ? curated : fallback).filter(
    (university, index, all) =>
      all.findIndex((other) => other.id === university.id) === index,
  );
}

/** "Explore universities in <country>". */
export function CountryUniversities({
  country,
  fallback = [],
  n = null,
  alt,
}: {
  country: Country;
  /** The destination's own universities, for when nothing is curated. */
  fallback?: CountryUniversityCard[];
  n?: string | null;
  alt: boolean;
}) {
  const where = inCountry(country.name, country.iso2Code);
  const universities = countryUniversities(country, fallback);
  if (!universities.length) return null;

  /* The derived count where it arrived, the list's own length otherwise --
     so a destination still states a true number when `derived` timed out. */
  const count =
    country.derived?.statistics?.universitiesCount || universities.length;
  const courses = country.derived?.statistics?.coursesCount ?? 0;

  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'}`} id="universities">
      <div className="wrap">
        <SplitHead
          index={n}
          eyebrow="Universities"
          title={`Explore universities in ${where}`}
          lead={
            courses
              ? `${count} ${count === 1 ? 'university' : 'universities'} and ${courses} ${courses === 1 ? 'programme' : 'programmes'} profiled with tuition, entry requirements and deadlines.`
              : `${count} ${count === 1 ? 'university' : 'universities'} profiled with tuition, entry requirements and deadlines.`
          }
          /* The destination is already chosen, so the way on is the rest
             of this destination's institutions -- not the global directory,
             which would drop the reader back into every country. */
          cta={{
            href: countryUniversitiesHref(country.slug),
            /* The heading above already names the destination, and a label
               carrying it too overflows a 390px screen the moment the name
               is as long as "United Arab Emirates". */
            label: 'All universities here',
          }}
        />
        {/* The list page's own card, so a university looks the same here as
            one click on. What the guide is handed about each one is less
            than the list holds -- a name, a type, a rank -- and the card
            shows what it has; the destination it does not need to be told. */}
        <div className="unigrid unigrid--compact">
          {universities.slice(0, 6).map((university) => (
            <UniversityCard
              key={university.id}
              university={{
                ...university,
                country: {
                  name: country.name,
                  slug: country.slug,
                  iso2Code: country.iso2Code ?? null,
                },
              }}
            />
          ))}
        </div>
        <div className="btn-row unigrid__after">
          {/* Opens the same assessment as every other entry point; the
              shell reads the destination off this page's address. */}
          <button
            className="btn btn--ghost btn--wrap"
            type="button"
            data-open-assessment
            data-intent="country-universities"
          >
            Find universities that match my profile{' '}
            <span className="btn__arrow" aria-hidden="true">
              →
            </span>
          </button>
          <Link className="linkcta" href="/compare/universities">
            Compare universities{' '}
            <span className="linkcta__arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/** How many subjects the guide shows before sending the reader to the rest. */
export const SUBJECTS_SHOWN = 6;

/** "Popular subjects to study in <country>". */
export function CountrySubjects({
  country,
  specializations = {},
  n = null,
  alt,
}: {
  country: Country;
  /** How many specializations each subject holds, by slug. A subject with
   * no entry shows its name alone, as every card did before. */
  specializations?: Readonly<Record<string, number>>;
  n?: string | null;
  alt: boolean;
}) {
  const where = inCountry(country.name, country.iso2Code);
  const subjects = country.subjects ?? [];
  if (!subjects.length) return null;

  /* A subject reaches this page one of two ways, and they are not the same
     claim. A derived one is here because a published course in it is taught
     in this destination -- open it and there is something behind it. An
     editorial one is here because somebody added it, usually for a market
     the catalogue has not caught up with, and may still be empty. Showing
     them undifferentiated is how a reader ends up on a page with nothing on
     it, so the ones we can stand behind come first and, when the six mix
     the two kinds, each of the others says on its own card that it has no
     programmes yet. */
  const taught = subjects.filter((subject) => subject.source !== 'EDITORIAL');
  const editorial = subjects.filter((subject) => subject.source === 'EDITORIAL');
  /* Six, in two rows of three, and one button to the rest. Thirty cards
     made this section ten rows of a guide that has fees, visas and intakes
     still to come; the page that lists every subject, with a search, is one
     press away. The ones with programmes behind them fill the six first. */
  const shown = [...taught, ...editorial].slice(0, SUBJECTS_SHOWN);
  const listedAmongShown = shown.some(
    (subject) => subject.source === 'EDITORIAL',
  );
  /* The field as studied here, not the field in general. A reader who
     picked a destination and then a subject has asked a narrower question
     than "what is Engineering", and the page that answers it is the one
     with the destination still in its address. The general page is one
     link away from there; from the general page there is no way back to
     this country.

     And as a card that says what is in it and that it opens: the name was
     alone in a box, with nothing to tell a reader there were eighteen
     specializations behind it or that pressing it went anywhere. */
  const card = (subject: (typeof subjects)[number]) => {
    const count = countLabel(specializations[subject.slug], 'specialization');
    /* Said on the card, not only in the sentence above the grid: "the rest"
       pointed at cards nobody could tell from the taught ones. Only when the
       two kinds are mixed -- with none taught, the sentence covers them all. */
    const empty = taught.length > 0 && subject.source === 'EDITORIAL';
    return (
      <RowCard
        key={subject.id}
        href={`/study-abroad/${country.slug}/${subject.slug}`}
        title={subject.name}
        meta={
          empty
            ? count
              ? `${count} · no programmes yet`
              : 'No programmes yet'
            : count
        }
        mark
      />
    );
  };

  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'}`} id="subjects">
      <div className="wrap">
        <SplitHead
          index={n}
          eyebrow="Find your field"
          title={`Popular subjects to study in ${where}`}
          lead={
            taught.length
              ? listedAmongShown
                ? 'The fields taught here come first, with the courses and specializations inside each one. The others say so on their card: they are listed with no programme in the catalogue yet.'
                : 'Explore the fields taught here, then see the courses and specializations inside each one.'
              : 'These fields are listed for this destination. The catalogue has no programmes under them yet.'
          }
        />
        {/* Three across, so six make two rows; one column on a phone. */}
        <div className="h-grid h-grid--wide">{shown.map(card)}</div>
        {/* One way to the rest, under the cards, where the reader is when
            they have read them. It is a button because it is the section's
            action, not an aside. */}
        <p className="h-more">
          <Link className="btn" href={`/study-abroad/${country.slug}/subjects`}>
            View all subjects{' '}
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </p>
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
  /** The fee for this destination, which is the one the card can quote. */
  selectedTuition?: {
    min: string | null;
    max: string | null;
    currencyCode: string | null;
    period: string;
  } | null;
};

/**
 * The courses to show for a country: the ones an editor curated as popular,
 * in the order they curated them, then whatever else the catalogue publishes
 * for the destination.
 *
 * Curation reaches the guide as names and ids only, so each curated course is
 * matched against the catalogue rows, which carry the subject, level and fee
 * the card prints. A curated course the catalogue page did not return still
 * leads -- it is shown from the curation itself, with the meta it lacks left
 * off rather than the whole card dropped.
 */
export function countryCourses(
  country: Country,
  published: CountryCourseCard[],
): CountryCourseCard[] {
  const curated = country.derived?.popularCourses ?? [];
  if (!curated.length) return published;
  const order = new Map(curated.map((course, index) => [course.id, index]));
  const known = new Set(published.map((course) => course.id));
  const missing: CountryCourseCard[] = curated
    .filter((course) => !known.has(course.id))
    .map((course) => ({
      id: course.id,
      name: course.name,
      slug: course.slug,
      courseLevel: null,
      subject: null,
    }));
  return [...missing, ...published].sort(
    (left, right) =>
      (order.get(left.id) ?? order.size) - (order.get(right.id) ?? order.size),
  );
}

/** A course's fee for this destination, per the period it is published for. */
function courseFee(course: CountryCourseCard, symbol: string): string | null {
  const tuition = course.selectedTuition;
  const amount = Number(tuition?.min ?? NaN);
  if (!Number.isFinite(amount)) return null;
  const unit = symbol || (tuition?.currencyCode ? `${tuition.currencyCode} ` : '');
  const period = tuition?.period?.toLowerCase() === 'year' ? ' a year' : '';
  return `From ${unit}${Math.round(amount).toLocaleString('en-US')}${period}`;
}

/** "Courses to explore". */
export function CountryCourses({
  country,
  courses,
  n = null,
  alt,
}: {
  country: Country;
  courses: CountryCourseCard[];
  n?: string | null;
  alt: boolean;
}) {
  const where = inCountry(country.name, country.iso2Code);
  if (!courses.length) return null;

  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'}`} id="courses">
      <div className="wrap">
        <SplitHead
          index={n}
          eyebrow="Courses"
          title={`Explore courses in ${where}`}
          lead="Each course page carries its tuition, entry requirements, intakes and deadlines."
          cta={{ href: '/courses', label: 'Search every course' }}
        />
        <div className="h-grid h-grid--wide">
          {courses.slice(0, 6).map((course) => {
            /* The fee is published in the country's own currency, so the
               country's symbol is the one to print it with. */
            const fee = courseFee(course, country.currency?.symbol ?? '');
            const meta = [course.courseLevel?.name, fee].filter(Boolean).join(' · ');
            return (
              <Link className="h-card" href={`/courses/${course.slug}`} key={course.id}>
                <strong className="h-card__t">{course.name}</strong>
                {course.subject ? <span className="h-card__d">{course.subject.name}</span> : null}
                {meta ? <span className="h-card__m">{meta}</span> : null}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** The initials shown beside a quote, from whatever attribution it carries. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * "What students say" -- testimonials attached to this destination.
 *
 * Only testimonials an editor has filed against the country appear here. A
 * university's own testimonials belong on that university's page, so nothing
 * is borrowed from one to fill the other, and the section stands down rather
 * than showing placeholder quotes.
 */
export function CountryTestimonials({
  country,
  testimonials,
  n = null,
  alt,
}: {
  country: Country;
  testimonials: CountryTestimonial[];
  n?: string | null;
  alt: boolean;
}) {
  const where = inCountry(country.name, country.iso2Code);
  if (!testimonials.length) return null;

  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'}`} id="testimonials">
      <div className="wrap">
        <SplitHead
          index={n}
          eyebrow="Student voices"
          title={`What students say about studying in ${where}`}
          lead="Published as given, with the attribution each student agreed to."
        />
        <div className="quotes">
          {testimonials.slice(0, 6).map((testimonial) => (
            <figure className="quote" key={testimonial.id}>
              <span className="quote__mark" aria-hidden="true">
                “
              </span>
              <blockquote className="quote__t">{testimonial.quote}</blockquote>
              {testimonial.attribution ? (
                <figcaption className="quote__by">
                  <span className="quote__init" aria-hidden="true">
                    {initials(testimonial.attribution)}
                  </span>
                  <span>
                    <span className="quote__n">{testimonial.attribution}</span>
                    {testimonial.attributionNote ? (
                      <>
                        <br />
                        <span className="quote__r">{testimonial.attributionNote}</span>
                      </>
                    ) : null}
                  </span>
                </figcaption>
              ) : null}
            </figure>
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
export function CountryConnect({ country, alt }: { country: Country; alt: boolean }) {
  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight h-connect`} id="connect">
      <div className="wrap">
        <div className="h-next">
          <p className="eyebrow eyebrow--plain">Explore next</p>
          <div className="btn-row">
            {/* The label does not name the country. The band sits on that
                country's own page, so "in <name>" says nothing extra -- and a
                button cannot wrap, so a long destination name pushed the whole
                page sideways at 390px. */}
            <Link className="btn btn--sm" href={`/courses?country=${country.slug}`}>
              Explore courses
            </Link>
            {/* The first thing a reader narrows by, and the one way out of
                this page the band did not offer. */}
            <Link
              className="btn btn--sm btn--ghost"
              href={`/study-abroad/${country.slug}/subjects`}
            >
              Browse subjects
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

/** "Funding to look into".
 *
 * The lead has always promised "the eligibility each one publishes" and the
 * cards carried a title, a summary and a provider -- not the eligibility,
 * the award or the closing date, all of which the list endpoint sends. They
 * use the funding card now, which prints what the record holds.
 *
 * The destination is the page, so the cards do not repeat it. */
export function CountryScholarships({
  country,
  scholarships,
  n = null,
  alt,
}: {
  country: Country;
  scholarships: ScholarshipCard[];
  n?: string | null;
  alt: boolean;
}) {
  const where = inCountry(country.name, country.iso2Code);
  if (!scholarships.length) return null;

  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'}`} id="scholarship-funding">
      <div className="wrap">
        <SplitHead
          index={n}
          eyebrow="Funding"
          title={`Scholarships to study in ${where}`}
          lead={`Funding open to international students here. ${FUNDING_CAVEAT}`}
          cta={{ href: `/scholarships?country=${country.slug}`, label: 'Find scholarships' }}
        />
        <ScholarshipCards
          scholarships={scholarships.slice(0, 6)}
          showCountries={false}
        />
      </div>
    </section>
  );
}
