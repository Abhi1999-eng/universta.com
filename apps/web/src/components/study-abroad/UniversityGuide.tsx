import Link from 'next/link';
import { RichText, richTextToPlainText } from '@/components/phase1/RichText';
import type { ConsultantPresence } from '@/lib/countries';
import { inCountry } from '@/lib/country-article';
import { jsonLdString } from '@/lib/json-ld';
import { dateLabel } from '@/lib/university-courses';
import {
  breadcrumbJsonLd,
  faqJsonLd,
  plainText,
  universityJsonLd,
  type Crumb,
} from '@/lib/university-json-ld';
import {
  COURSES_SHOWN,
  intakeSummary,
  levelsTaught,
  monthName,
  orderOfferings,
  popularSubjects,
  splitOverview,
  tuitionByLevel,
} from '@/lib/university-profile';
import {
  countryUniversitiesHref,
  universityCoursesHref,
  universityHref,
} from '@/lib/university-links';
import { CountryConsultants } from './CountryConsultants';
import { Crumbs } from './Crumbs';
import { FlagMark } from './FlagMark';
import { SectionHead } from './SectionHead';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import type { ScholarshipCard } from '@/lib/scholarship-card';
import { UniversityAssessmentButton } from './UniversityAssessmentButton';
import { UniversityCourseCards } from './UniversityCourseCards';
import {
  MoreUniversities,
  UniversityFaqs,
  UniversityFees,
  UniversityIntakes,
  type NearbyUniversity,
  type UniversityFaq,
} from './UniversityGuideSections';
import { UniversityTabs } from './UniversityTabs';
import { universityInitials } from '@/lib/university-initials';
import { countryScholarshipsHref } from '@/lib/country-scholarship-list';

export type { NearbyUniversity } from './UniversityGuideSections';

export type UniversityOffering = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  qualificationName: string | null;
  subject: { name: string; slug: string } | null;
  specialization: { name: string; slug: string } | null;
  courseLevel: {
    code: string | null;
    name: string;
    /** The level's place in the catalogue's order of levels. */
    order?: number | null;
  } | null;
  duration: { min: string | null; max: string | null; unit: string | null };
  /* What a student compares one university's courses on. Each is recorded
     per course, and each is optional: most courses in the catalogue state
     none of them yet. */
  studyMode?: string | null;
  tuition?: {
    min: string | null;
    max: string | null;
    currencyCode: string | null;
    period: string | null;
  } | null;
  intakes?: Array<{
    key: string;
    name: string;
    month: number | null;
    deadline: string | null;
  }>;
};

export type UniversityRecord = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  overview: string | null;
  institutionType: string | null;
  qsRanking: number | null;
  /* Somebody else's figures, which is why they travel with who published
     them and when. The page says that out loud rather than presenting a
     count of students as a fact of its own. */
  totalStudents: number | null;
  internationalStudentsPercent: string | number | null;
  studentFacultyRatio: string | number | null;
  establishedYear: number | null;
  campusSetting: string | null;
  websiteUrl: string | null;
  admissionsEmail: string | null;
  phone: string | null;
  statsSourceName: string | null;
  statsSourceUrl: string | null;
  statsYear: number | null;
  sourceReference: string | null;
  verifiedAt: string | null;
  campuses: number;
  /** The city of its first campus that names one. */
  city?: string | null;
  /** That campus's state or region, when it records one. */
  region?: string | null;
  country: {
    name: string;
    slug: string;
    iso2Code: string | null;
    officialLanguage: string | null;
    currencyCode: string | null;
    currencySymbol: string | null;
    intakeMonths: number[];
    postStudyWorkPermitMonths: number | null;
  } | null;
  offerings: UniversityOffering[];
  /** A few others in the same country, best ranked first, and how many
   *  others there are in all. */
  otherUniversities?: NearbyUniversity[];
  otherUniversityTotal?: number;
};

/** What the destination's guide holds that a university's page links into. */
export type UniversityDestination = {
  consultants?: ConsultantPresence;
  /** Sections of the country guide, each offered only when the guide
   *  renders it: the visa route, documents, language tests, work rights. */
  links: Array<{ key: string; label: string; href: string }>;
  /** The guide's cost section, when it has one. */
  costHref: string | null;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function typeLabel(value: string | null) {
  if (!value) return null;
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}

/** An offering is named for the catalogue it sits in -- "Master of Data
 * Science at Elmswood Polytechnic University" -- which is the right name in
 * a search result and a redundant one on Elmswood's own page, where it
 * stutters down a column of nine cards. The institution's name comes off
 * here, and only here. */
export function programmeName(name: string, university: string): string {
  const suffix = ` at ${university}`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

/** "a, b and c", as a list reads inside a sentence. */
function listOf(parts: string[]) {
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : (parts[0] ?? '');
}

/**
 * The questions a university's record can answer, each answered from it.
 * A question the record has nothing for is left out rather than answered
 * with a guess -- except funding, where "none is linked yet" is itself the
 * true answer and the one a student needs.
 */
function questionsFor({
  university,
  where,
  coursesHref,
  scholarshipTotal,
}: {
  university: UniversityRecord;
  where: string | null;
  coursesHref: string;
  scholarshipTotal: number;
}): UniversityFaq[] {
  const { country, offerings, name } = university;
  const faqs: UniversityFaq[] = [];
  if (country && where)
    faqs.push({
      id: 'where',
      question: `Where is ${name}?`,
      answer: (
        <>
          {university.city
            ? `${name} is in ${university.city}, in ${where}.`
            : `${name} is in ${where}.`}{' '}
          Fees, the student visa and living costs are set by the destination, and{' '}
          <Link href={`/study-abroad/${country.slug}`}>the guide to {where}</Link> covers them.
        </>
      ),
    });
  const type = typeLabel(university.institutionType);
  if (type || university.establishedYear)
    faqs.push({
      id: 'kind',
      question: `What kind of institution is ${name}?`,
      answer: [
        type ? `The catalogue records it as a ${type.toLowerCase()} institution.` : null,
        university.establishedYear ? `It was founded in ${university.establishedYear}.` : null,
      ]
        .filter(Boolean)
        .join(' '),
    });
  if (offerings.length) {
    const levels = levelsTaught(offerings).map(
      (level) => `${level.count} at ${level.name} level`,
    );
    faqs.push({
      id: 'courses',
      question: `What can I study at ${name}?`,
      answer: (
        <>
          Universta profiles {offerings.length}{' '}
          {offerings.length === 1 ? 'course' : 'courses'} here
          {levels.length ? `: ${listOf(levels)}` : ''}. A university usually teaches more than
          a catalogue carries.{' '}
          <Link href={coursesHref}>
            See all {offerings.length} {offerings.length === 1 ? 'course' : 'courses'}
          </Link>
          .
        </>
      ),
    });
  }
  const intakes = intakeSummary(offerings).map(
    (intake) => monthName(intake.month) ?? intake.name,
  );
  const countryMonths = [...(country?.intakeMonths ?? [])]
    .sort((left, right) => left - right)
    .map((month) => MONTHS[month - 1])
    .filter((month): month is string => Boolean(month));
  if (intakes.length || countryMonths.length)
    faqs.push({
      id: 'intakes',
      question: `When does ${name} take new students?`,
      answer: intakes.length
        ? `Its courses list ${intakes.length === 1 ? 'an intake' : 'intakes'} in ${listOf([...new Set(intakes)])}. Each course sets its own deadline, so check the course before you plan around one.`
        : `The courses here do not record their own intakes yet. In ${where ?? 'this destination'} the main ${countryMonths.length === 1 ? 'intake is' : 'intakes are'} ${listOf(countryMonths)}; check the course for its own dates.`,
    });
  faqs.push({
    id: 'funding',
    question: `Are there scholarships for studying at ${name}?`,
    answer: scholarshipTotal ? (
      <>
        {scholarshipTotal === 1
          ? `One scholarship is recorded against ${name}.`
          : `${scholarshipTotal} scholarships are recorded against ${name}.`}{' '}
        <Link href={`/scholarships?university=${university.slug}`}>See every one</Link>, and
        check each award&rsquo;s own terms: being eligible is not a guarantee of an award.
      </>
    ) : (
      <>
        None is linked to {name} in our catalogue yet. That reflects the catalogue, not the
        university&rsquo;s funding.
        {country ? (
          <>
            {' '}
            <Link href={countryScholarshipsHref(country.slug)}>
              Scholarships for {where ?? country.name}
            </Link>{' '}
            may still apply.
          </>
        ) : null}
      </>
    ),
  });
  return faqs;
}

/**
 * A university's guide, at /universities/<slug>.
 *
 * The approved build's template carries a long run of sections. Some read a
 * record this catalogue does not keep per institution -- admission
 * thresholds, living costs, campus life and graduate outcomes are recorded
 * against a programme or a destination here, not against the university --
 * and its profile-fit panel is scored against a student profile this product
 * does not collect. Those are left in the reference rather than filled with
 * figures nobody has verified.
 *
 * What is here is what the catalogue holds about an institution, laid out in
 * the template's order: who it is and where, what it teaches (six courses
 * and the way to the rest, as the behaviour reference shows them), what its
 * courses say about fees and intakes, the people who can help, the
 * destination it sits in, the questions its record answers, and the other
 * universities in that destination. Sections stand down rather than render
 * empty; the numbered run and the strip of section links are both built
 * from the ones that render, so neither skips nor points at nothing.
 */
export function UniversityGuide({
  university,
  scholarships = [],
  scholarshipTotal,
  destination = null,
}: {
  university: UniversityRecord;
  /** Awards the catalogue records against this institution. Read on the
   *  page rather than carried on the record, because a failure to reach the
   *  funding list should cost a section, not the university. */
  scholarships?: ScholarshipCard[];
  /** How many awards there are in all; the cards are the first few. */
  scholarshipTotal?: number;
  /** The destination guide's parts this page links into, when it loaded. */
  destination?: UniversityDestination | null;
}) {
  const { country, offerings } = university;
  const overview = university.overview?.trim();
  const hasOverview = Boolean(overview && richTextToPlainText(overview));
  const split = hasOverview
    ? splitOverview(overview!, university.shortDescription)
    : { intro: null, highlights: [] };
  const type = typeLabel(university.institutionType);
  const where = country ? inCountry(country.name, country.iso2Code) : null;
  const self = universityHref(university.slug);
  const coursesHref = country
    ? universityCoursesHref(country.slug, university.slug)
    : `/universities/${university.slug}/courses`;
  const compareHref = `/compare/universities?items=${university.slug}`;
  const assessment = {
    countrySlug: country?.slug,
    countryName: country?.name,
    sourcePagePath: self,
  };
  const fundingTotal = Math.max(scholarshipTotal ?? 0, scholarships.length);
  const others = university.otherUniversities ?? [];
  const consultants = destination?.consultants?.total ? destination.consultants : undefined;
  const guideLinks = destination?.links ?? [];

  const nameOf = (offering: UniversityOffering) =>
    programmeName(offering.name, university.name);
  const ordered = orderOfferings(offerings, nameOf);
  const shown = ordered.slice(0, COURSES_SHOWN);
  const subjects = country ? popularSubjects(offerings) : [];
  const faqs = questionsFor({
    university,
    where,
    coursesHref,
    scholarshipTotal: fundingTotal,
  });

  /* What renders, in the template's order. The bands alternate along this
     run; the numbers count only the sections the template numbers, which
     leaves out the consultants band and the closing list of universities. */
  const hasContact = Boolean(
    university.websiteUrl || university.admissionsEmail || university.phone,
  );
  const run = [
    'snapshot',
    hasOverview ? 'about' : null,
    offerings.length ? 'programmes' : null,
    country && consultants ? 'consultants' : null,
    tuitionByLevel(offerings).length ? 'fees' : null,
    scholarships.length ? 'funding' : null,
    intakeSummary(offerings).length ? 'intakes' : null,
    hasContact ? 'contact' : null,
    country ? 'destination' : null,
    faqs.length ? 'faqs' : null,
    country && others.length ? 'similar' : null,
  ].filter((id): id is string => Boolean(id));
  /* The template numbers from the overview: the snapshot under the hero is
     unnumbered, and counting it started the run at 02. */
  const UNNUMBERED = new Set(['snapshot', 'consultants', 'similar']);
  const numbered = run.filter((id) => !UNNUMBERED.has(id));
  const n = (id: string) => {
    const index = numbered.indexOf(id);
    return index < 0 ? null : String(index + 1).padStart(2, '0');
  };
  const alt = (id: string) => run.indexOf(id) % 2 === 1;
  const band = (id: string) => `sec ${alt(id) ? 'sec--paper' : 'sec--white'}`;

  const TAB_LABELS: Record<string, string> = {
    about: 'Overview',
    programmes: 'Courses',
    fees: 'Fees',
    funding: 'Scholarships',
    intakes: 'Intakes',
    contact: 'Contact',
    destination: 'Destination',
    faqs: 'FAQs',
    similar: 'More universities',
  };
  const tabs = run
    .filter((id) => TAB_LABELS[id])
    .map((id) => ({ id, label: TAB_LABELS[id]! }));

  /* Only the cells this record can fill. A snapshot with "—" in half of it
     says less than a shorter one that is entirely true. */
  const snapshot: Array<{ label: string; value: string }> = [];
  /* The zip opens on where the university is, city and country. Without a
     recorded city the cell names the destination, as it always has. */
  if (country)
    snapshot.push(
      university.city
        ? { label: 'Location', value: `${university.city}, ${country.name}` }
        : { label: 'Destination', value: country.name },
    );
  if (type) snapshot.push({ label: 'Type', value: type });
  snapshot.push({
    label: 'Programmes',
    value: String(offerings.length),
  });
  const levels = levelsTaught(offerings);
  if (levels.length)
    snapshot.push({
      label: levels.length === 1 ? 'Degree level' : 'Degree levels',
      value: levels.map((level) => level.name).join(' · '),
    });
  if (university.campuses)
    snapshot.push({ label: 'Campuses', value: String(university.campuses) });
  if (country?.officialLanguage)
    snapshot.push({ label: 'Language', value: country.officialLanguage });
  if (country?.currencyCode)
    snapshot.push({
      label: 'Currency',
      value: [country.currencyCode, country.currencySymbol]
        .filter(Boolean)
        .join(' '),
    });
  /* The university's own intakes, as its courses list them -- the months the
     intakes band and the questions further down name -- so the page gives
     one answer. Only when no course records an intake does the cell fall
     back on the destination's months, and then it says they are the
     destination's, not the university's. */
  const ownIntakes = [
    ...new Set(
      intakeSummary(offerings).map((intake) => monthName(intake.month) ?? intake.name),
    ),
  ];
  if (ownIntakes.length)
    snapshot.push({
      label: ownIntakes.length === 1 ? 'Intake' : 'Intakes',
      value: ownIntakes.join(' · '),
    });
  else if (country?.intakeMonths?.length)
    snapshot.push({
      label: `Main ${country.intakeMonths.length === 1 ? 'intake' : 'intakes'} in ${where}`,
      value: [...country.intakeMonths]
        .sort((a, b) => a - b)
        .map((month) => MONTHS[month - 1] ?? String(month))
        .join(' · '),
    });
  if (country?.postStudyWorkPermitMonths)
    snapshot.push({
      label: 'Post-study work',
      value: `${country.postStudyWorkPermitMonths} months`,
    });
  if (university.qsRanking)
    snapshot.push({ label: 'QS ranking', value: `#${university.qsRanking}` });

  /* The figures a student compares institutions on. Each is added only when
     the record holds it, for the same reason as every cell above: a
     snapshot half full of dashes says less than a short one that is true. */
  const figure = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? null : Number(value);
  const students = figure(university.totalStudents);
  const international = figure(university.internationalStudentsPercent);
  const ratio = figure(university.studentFacultyRatio);
  if (students)
    snapshot.push({
      label: 'Students',
      value: students.toLocaleString('en-GB'),
    });
  if (international)
    snapshot.push({ label: 'International', value: `${international}%` });
  if (ratio)
    snapshot.push({ label: 'Students per staff', value: String(ratio) });
  if (university.establishedYear)
    snapshot.push({
      label: 'Founded',
      value: String(university.establishedYear),
    });
  if (university.campusSetting)
    snapshot.push({
      label: 'Setting',
      value:
        university.campusSetting[0] +
        university.campusSetting.slice(1).toLowerCase(),
    });

  /* Who counted, and when. Without this the numbers above would read as the
     catalogue's own, which they are not. Student figures only: a founding
     year is not somebody's count, and with nothing else recorded the page
     warned about "student figures" it was not showing. */
  const figuresShown = Boolean(students || international || ratio);
  const figureSource =
    figuresShown && (university.statsSourceName || university.statsYear)
      ? [university.statsSourceName, university.statsYear]
          .filter(Boolean)
          .join(', ')
      : null;

  /* Home / Study abroad / the country / its universities / this one, as the
     behaviour reference files a university: the way back is to the
     destination's own list, not the worldwide directory. The structured
     data reads the same trail, so the two cannot disagree. */
  const trail: Crumb[] = [
    { label: 'Home', href: '/' },
    ...(country
      ? [
          { label: 'Study abroad', href: '/study-abroad' },
          { label: country.name, href: `/study-abroad/${country.slug}` },
          { label: 'Universities', href: countryUniversitiesHref(country.slug) },
        ]
      : [{ label: 'Universities', href: '/universities' }]),
    { label: university.name },
  ];
  /* The answers as a reader sees them, links and all, without the markup. */
  const faqData = faqJsonLd(
    faqs.map((faq) => ({ question: faq.question, answer: plainText(faq.answer) })),
  );
  const structured = [
    breadcrumbJsonLd(trail, self),
    universityJsonLd(university),
    faqData,
  ].filter((data): data is Record<string, unknown> => Boolean(data));

  return (
    <>
      {structured.map((data) => (
        <script
          key={String(data['@type'])}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
        />
      ))}

      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={trail} />

          <div className="unihero">
            <div className="unihero__main">
              <div className="unihero__id">
                <span className="unimark unimark--lg" aria-hidden="true">
                  {universityInitials(university.name)}
                </span>
                <div>
                  {type || university.establishedYear ? (
                    <p className="hero__eyebrow">
                      {type}
                      {type && university.establishedYear ? <b> · </b> : null}
                      {university.establishedYear
                        ? `Founded ${university.establishedYear}`
                        : null}
                    </p>
                  ) : null}
                  <h1 className="unihero__name">{university.name}</h1>
                  {country ? (
                    <p className="unihero__where">
                      <FlagMark iso2Code={country.iso2Code} bands={null} />
                      <span>
                        {university.city ? `${university.city}, ` : null}
                        <Link href={`/study-abroad/${country.slug}`}>{country.name}</Link>
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              {university.shortDescription ? (
                <p className="unihero__desc">{university.shortDescription}</p>
              ) : null}

              <div className="btn-row">
                <UniversityAssessmentButton
                  className="btn btn--lg"
                  intent="university"
                  {...assessment}
                >
                  Check my eligibility{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </UniversityAssessmentButton>
                {offerings.length ? (
                  <Link className="btn btn--lg btn--ghost" href="#programmes">
                    See its programmes
                  </Link>
                ) : null}
                {country ? (
                  <Link
                    className="btn btn--lg btn--ghost"
                    href={`/study-abroad/${country.slug}`}
                  >
                    {country.name} guide
                  </Link>
                ) : null}
                <Link className="btn btn--lg btn--ghost" href={compareHref}>
                  Compare
                </Link>
              </div>

              {university.qsRanking ? (
                <p className="rankline">
                  <span>
                    <b>#{university.qsRanking}</b> QS World University Rankings
                  </span>
                  <em>
                    Ranking is one factor among many. Programme fit, cost and
                    entry requirements usually matter more to your outcome.
                  </em>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <UniversityTabs tabs={tabs} />

      <section className={`${band('snapshot')} sec--tight`} id="snapshot">
        <div className="wrap">
          <div className="unisnap unisnap--uni">
            {snapshot.map((cell) => (
              <div className="unisnap__cell" key={cell.label}>
                <span className="label">{cell.label}</span>
                <b>{cell.value}</b>
              </div>
            ))}
          </div>
          {figureSource ? (
            <p className="unisnap__source">
              Student figures as published by{' '}
              {university.statsSourceUrl ? (
                <a
                  href={university.statsSourceUrl}
                  rel="nofollow noopener"
                  target="_blank"
                >
                  {figureSource}
                </a>
              ) : (
                figureSource
              )}
              . Universta does not count them itself.
            </p>
          ) : figuresShown ? (
            <p className="unisnap__source">
              Student figures are recorded in the catalogue without a
              published source, so treat them as indicative.
            </p>
          ) : null}
          <div className="verifybar">
            <div className="verifybar__body">
              <strong>Check before you apply.</strong> Fees, entry requirements
              and deadlines are set by the university and change between
              intakes. This page records what the catalogue holds, not an
              offer.
              {university.verifiedAt || university.sourceReference ? (
                <p className="verifybar__note">
                  {dateLabel(university.verifiedAt)
                    ? `Last checked ${dateLabel(university.verifiedAt)}.`
                    : null}{' '}
                  {university.sourceReference ? (
                    <>
                      Source:{' '}
                      <a
                        href={university.sourceReference}
                        rel="nofollow noopener"
                        target="_blank"
                      >
                        the institution&rsquo;s own pages
                      </a>
                      .
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {hasOverview ? (
        <section className={band('about')} id="about">
          <div className="wrap">
            <SectionHead
              n={n('about')}
              eyebrow="Overview"
              title="About this university"
              lead={university.shortDescription ?? undefined}
            />
            {split.intro ? (
              <div className="prose">
                <RichText value={split.intro} />
              </div>
            ) : null}
            {split.highlights.length ? (
              <div
                className={`rulegrid rulegrid--2${split.intro ? ' uniguide__highlights' : ''}`}
              >
                {split.highlights.map((highlight, index) => (
                  <article className="rulegrid__item" key={`${index}-${highlight.title}`}>
                    <span className="rulegrid__n">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="rulegrid__t">{highlight.title}</h3>
                    {highlight.body ? (
                      <div className="rulegrid__b">
                        <RichText value={highlight.body} />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {offerings.length ? (
        <section className={band('programmes')} id="programmes">
          <div className="wrap">
            <SectionHead
              n={n('programmes')}
              eyebrow="Courses"
              title={`Programmes at ${university.name}`}
              lead={`${offerings.length} ${offerings.length === 1 ? 'programme is' : 'programmes are'} profiled here, each with its own page. A university usually lists more than a catalogue carries, so treat this as a starting point rather than its full prospectus.`}
            >
              {subjects.length && country ? (
                <div className="specchips">
                  <span className="label">Popular subjects here</span>
                  <div className="specchips__row">
                    {subjects.map((subject) => (
                      <Link
                        className="specchip specchip--live"
                        key={subject.slug}
                        href={`/study-abroad/${country.slug}/${subject.slug}`}
                      >
                        {subject.name}
                        <em>{subject.count}</em>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </SectionHead>
            <UniversityCourseCards
              offerings={shown}
              universitySlug={university.slug}
              countrySlug={country?.slug ?? null}
              countryName={country?.name ?? null}
              countryWhere={where}
              nameOf={nameOf}
            />
            {/* Always there, even when every course already fits above: the
                full list is where a student filters and sorts, and the
                behaviour reference offers it whatever the count. */}
            <div className="cresults__more">
              <span className="results__count">
                {shown.length === offerings.length
                  ? `Showing all ${offerings.length}`
                  : `Showing ${shown.length} of ${offerings.length}`}
              </span>
              <Link className="btn btn--ghost" href={coursesHref}>
                View all {offerings.length}{' '}
                {offerings.length === 1 ? 'course' : 'courses'}{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {country && consultants ? (
        <CountryConsultants
          countryName={country.name}
          countrySlug={country.slug}
          iso2Code={country.iso2Code ?? null}
          presence={consultants}
          alt={alt('consultants')}
          heading={`Need help applying to ${university.name}?`}
        />
      ) : null}

      <UniversityFees
        offerings={offerings}
        n={n('fees')}
        band={band('fees')}
        costHref={destination?.costHref ?? null}
      />

      {scholarships.length ? (
        <section className={band('funding')} id="funding">
          <div className="wrap">
            <SectionHead
              n={n('funding')}
              eyebrow="Funding"
              title={`Scholarships at ${university.name}`}
              lead={`${fundingTotal} ${fundingTotal === 1 ? 'award is' : 'awards are'} recorded against this institution. ${FUNDING_CAVEAT}`}
            />
            <ScholarshipCards scholarships={scholarships} showCountries={false} />
            <div className="btn-row uniguide__after">
              <Link
                className="btn"
                href={`/scholarships?university=${university.slug}`}
              >
                View all {fundingTotal}{' '}
                {fundingTotal === 1 ? 'scholarship' : 'scholarships'}{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
              <UniversityAssessmentButton
                className="btn btn--ghost"
                intent="scholarships"
                {...assessment}
              >
                Find scholarships for my profile{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </UniversityAssessmentButton>
            </div>
          </div>
        </section>
      ) : null}

      <UniversityIntakes
        offerings={offerings}
        n={n('intakes')}
        band={band('intakes')}
        assessment={assessment}
      />

      {hasContact ? (
        <section className={`${band('contact')} sec--tight`} id="contact">
          <div className="wrap">
            <SectionHead
              n={n('contact')}
              eyebrow="Contact"
              title="Ask the university directly"
              lead="Anything on this page can change between intakes. These are the institution's own channels, which is where an answer is binding."
            />
            <div className="switcher switcher--few">
              {university.websiteUrl ? (
                <a
                  className="switcher__item"
                  href={university.websiteUrl}
                  rel="nofollow noopener"
                  target="_blank"
                >
                  <span className="cchip__name">Official website</span>
                  <span className="switcher__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </a>
              ) : null}
              {university.admissionsEmail ? (
                <a
                  className="switcher__item"
                  href={`mailto:${university.admissionsEmail}`}
                >
                  <span className="cchip__name">
                    {university.admissionsEmail}
                  </span>
                </a>
              ) : null}
              {university.phone ? (
                <a
                  className="switcher__item"
                  href={`tel:${university.phone.replace(/[^+\d]/g, '')}`}
                >
                  <span className="cchip__name">{university.phone}</span>
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {country ? (
        <section className={`${band('destination')} sec--tight`} id="destination">
          <div className="wrap">
            <SectionHead
              n={n('destination')}
              eyebrow="Destination"
              title={`Studying in ${where ?? country.name}`}
              lead="Fees, visa route, intakes and living costs are set by the destination rather than the institution, so they live on its guide."
            />
            <div className="switcher switcher--few">
              <Link
                className="switcher__item"
                href={`/study-abroad/${country.slug}`}
              >
                <FlagMark iso2Code={country.iso2Code} bands={null} />
                <span className="cchip__name">{country.name}</span>
                <span className="switcher__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
              <Link
                className="switcher__item"
                href={countryUniversitiesHref(country.slug)}
              >
                <span className="cchip__name">
                  Other universities in {where ?? country.name}
                </span>
                <span className="switcher__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
              {guideLinks.map((link) => (
                <Link className="switcher__item" href={link.href} key={link.key}>
                  <span className="cchip__name">{link.label}</span>
                  <span className="switcher__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <UniversityFaqs
        name={university.name}
        faqs={faqs}
        n={n('faqs')}
        band={band('faqs')}
      />

      {country && where ? (
        <MoreUniversities
          university={university}
          country={{
            name: country.name,
            slug: country.slug,
            iso2Code: country.iso2Code,
            where,
          }}
          others={others}
          total={university.otherUniversityTotal ?? others.length}
          band={band('similar')}
        />
      ) : null}
    </>
  );
}
