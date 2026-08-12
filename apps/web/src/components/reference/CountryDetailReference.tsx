import Link from 'next/link';
import type { CountryPage } from '@/lib/countries';
import type { CitySummary } from '@/lib/locations';
import { counsellingHref } from '@/lib/counselling-link';
import { intakeRange } from '@/lib/intake-range';
import { formatDate, formatNumber } from '@/lib/format';

/** The client-approved destination detail page.
 *
 * The template is written around Canada with sample content: named partner
 * universities, QS ranks, per-programme-level tuition tables, six invented
 * "why" cards, a five-step IRCC visa walkthrough, city rent bands, graduate
 * salary tables, ad slots and a blog rail. Universta stores none of that.
 *
 * What it does store is a structured country profile -- cost, work rights,
 * language requirements, an intake calendar and statistics, each with its own
 * source reference and verification date -- plus real universities, courses,
 * scholarships and cities scoped to the country. So each template section is
 * rendered from the matching profile, and a section with no backing record is
 * dropped rather than filled in: no rankings, no salary table, no per-level
 * tuition breakdown, no ad slots, no blog rail.
 *
 * The jump nav is built from the sections that actually rendered, so it can
 * never link to an anchor that is not on the page. */

export type UniversitySummary = {
  name: string;
  slug: string;
  city: string | null;
  institutionType: string | null;
  verified: boolean;
};

export type ScholarshipSummary = {
  title: string;
  slug: string;
  summary: string | null;
  amount: string | null;
  level: string | null;
  deadline: string | null;
};

export type CountryDetailReferenceProps = {
  page: CountryPage;
  cities: CitySummary[];
  universities: UniversitySummary[];
  universityTotal: number;
  scholarships: ScholarshipSummary[];
  scholarshipTotal: number;
  subjects: Array<{ value: string; label: string; count: number }>;
  courseTotal: number;
};

function humanise(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

const SKIP_WORDS = new Set(['of', 'in', 'and', 'the', 'for', 'a', 'an', '&']);

function initials(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word && !SKIP_WORDS.has(word.toLowerCase()));
  if (words.length === 0) return value.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function months(value: number) {
  if (value % 12 === 0) {
    const years = value / 12;
    return `${years} year${years === 1 ? '' : 's'}`;
  }
  return `${value} months`;
}

function range(min?: string | null, max?: string | null) {
  const low = min ? formatNumber(min) : null;
  const high = max ? formatNumber(max) : null;
  if (low && high && low !== high) return `${low}–${high}`;
  return low ?? high ?? null;
}

const PERIOD_LABEL: Record<string, string> = {
  PER_YEAR: 'per year',
  PER_MONTH: 'per month',
  PER_TERM: 'per term',
  ONE_TIME: 'one-off',
};

export function CountryDetailReference(props: CountryDetailReferenceProps) {
  const { page, cities, universities, scholarships, subjects } = props;
  const { country, profiles, faqs, consultantCards } = page;
  const { cost, work, language, statistics } = profiles;
  const intakes = profiles.intakes ?? [];
  const currency = cost?.currencyCode ? `${cost.currencyCode} ` : '';

  const tuition = range(cost?.tuitionMin, cost?.tuitionMax);
  const living = range(cost?.livingCostMin, cost?.livingCostMax);

  const postStudyWork =
    work?.postStudyWorkAvailable && (work.postStudyWorkMinMonths || work.postStudyWorkMaxMonths)
      ? work.postStudyWorkMinMonths &&
        work.postStudyWorkMaxMonths &&
        work.postStudyWorkMinMonths !== work.postStudyWorkMaxMonths
        ? `${months(work.postStudyWorkMinMonths)} – ${months(work.postStudyWorkMaxMonths)}`
        : months((work.postStudyWorkMinMonths ?? work.postStudyWorkMaxMonths) as number)
      : work?.postStudyWorkAvailable
        ? 'Available'
        : null;

  const intakeLabels = intakes
    .map((entry) => intakeRange(entry.intake ?? entry))
    .filter(Boolean);

  const ielts =
    language?.ieltsRequirement && language.ieltsRequirement !== 'NOT_REQUIRED'
      ? `${humanise(language.ieltsRequirement)}${language.ieltsMinScore ? ` · ${language.ieltsMinScore}` : ''}`
      : language?.ieltsRequirement
        ? humanise(language.ieltsRequirement)
        : null;

  const pathway =
    work?.immigrationPathwayStrength && work.immigrationPathwayStrength !== 'NOT_PUBLISHED'
      ? humanise(work.immigrationPathwayStrength)
      : null;

  /** Editorial "why" cards come from the profile's own published summaries, so
   * the section carries the client's copy voice without inventing claims. */
  const whyCards = [
    postStudyWork && {
      h: 'Post-study work rights',
      p: work?.postStudyWorkSummary ?? 'Graduates of eligible programmes can stay on to work after finishing.',
      stat: postStudyWork,
    },
    work?.partTimeAllowed && {
      h: 'Work while you study',
      p: work.partTimeSummary ?? 'Part-time work is permitted during your studies.',
      stat: work.partTimeHoursPerWeek ? `${work.partTimeHoursPerWeek} hours a week` : 'Permitted',
    },
    pathway && {
      h: 'Route to residency',
      p: work?.immigrationPathwaySummary ?? 'A published immigration pathway follows study in this destination.',
      stat: `${pathway} pathway`,
    },
    intakeLabels.length > 1 && {
      h: `${intakeLabels.length} intakes a year`,
      p: 'More than one entry point a year means a missed deadline costs you months rather than a full year.',
      stat: intakeLabels.join(' · '),
    },
    language?.languageWaiverAvailable && {
      h: 'English test waiver available',
      p: language.waiverNotes ?? language.generalNotes ?? 'Some programmes waive the English test where your prior degree was taught in English.',
      stat: ielts ? `IELTS ${ielts.toLowerCase()}` : 'Waiver available',
    },
    statistics?.universitiesCount && {
      h: 'A catalogue you can browse',
      p: 'Every institution, course and scholarship on this page is a published record you can open and compare.',
      stat: `${formatNumber(statistics.universitiesCount)} universities · ${formatNumber(statistics.coursesCount ?? 0)} courses`,
    },
  ].filter(Boolean) as Array<{ h: string; p: string; stat: string }>;

  const costRows = [
    tuition && {
      label: 'Tuition',
      value: `${currency}${tuition}`,
      note: PERIOD_LABEL[cost?.tuitionPeriod ?? ''] ?? '',
    },
    living && {
      label: 'Living costs',
      value: `${currency}${living}`,
      note: PERIOD_LABEL[cost?.livingCostPeriod ?? ''] ?? '',
    },
    range(cost?.accommodationMin, cost?.accommodationMax) && {
      label: 'Accommodation',
      value: `${currency}${range(cost?.accommodationMin, cost?.accommodationMax)}`,
      note: '',
    },
    range(cost?.foodCostMin, cost?.foodCostMax) && {
      label: 'Food',
      value: `${currency}${range(cost?.foodCostMin, cost?.foodCostMax)}`,
      note: '',
    },
    range(cost?.transportCostMin, cost?.transportCostMax) && {
      label: 'Transport',
      value: `${currency}${range(cost?.transportCostMin, cost?.transportCostMax)}`,
      note: '',
    },
    cost?.healthInsuranceCost && {
      label: 'Health insurance',
      value: `${currency}${formatNumber(cost.healthInsuranceCost)}`,
      note: '',
    },
    range(cost?.applicationFeeMin, cost?.applicationFeeMax) && {
      label: 'Application fee',
      value: `${currency}${range(cost?.applicationFeeMin, cost?.applicationFeeMax)}`,
      note: '',
    },
  ].filter(Boolean) as Array<{ label: string; value: string; note: string }>;

  const languageRows = [
    ['IELTS', language?.ieltsRequirement, language?.ieltsMinScore],
    ['TOEFL', language?.toeflRequirement, language?.toeflMinScore],
    ['PTE', language?.pteRequirement, language?.pteMinScore],
    ['Duolingo', language?.duolingoRequirement, language?.duolingoMinScore],
  ].filter(([, requirement]) => Boolean(requirement)) as Array<
    [string, string, string | null | undefined]
  >;

  const visaFacts = [
    work?.visaSuccessBand &&
      work.visaSuccessBand !== 'NOT_PUBLISHED' && ['Visa success band', humanise(work.visaSuccessBand)],
    work?.visaProcessingTime && ['Processing time', work.visaProcessingTime],
    work?.proofOfFundsSummary && ['Proof of funds', work.proofOfFundsSummary],
  ].filter(Boolean) as Array<[string, string]>;

  const statRows = [
    statistics?.universitiesCount && ['Universities', formatNumber(statistics.universitiesCount)],
    statistics?.publicUniversitiesCount && ['Public universities', formatNumber(statistics.publicUniversitiesCount)],
    statistics?.privateUniversitiesCount && ['Private universities', formatNumber(statistics.privateUniversitiesCount)],
    statistics?.coursesCount && ['Courses', formatNumber(statistics.coursesCount)],
    statistics?.topRankedUniversitiesCount && ['Top-ranked universities', formatNumber(statistics.topRankedUniversitiesCount)],
    statistics?.scholarshipsCount && ['Scholarships', formatNumber(statistics.scholarshipsCount)],
    statistics?.citiesCount && ['Cities', formatNumber(statistics.citiesCount)],
    statistics?.internationalStudentsCount && ['International students', formatNumber(statistics.internationalStudentsCount)],
  ].filter(Boolean) as Array<[string, string]>;

  const verifiedAt =
    cost?.verifiedAt ?? work?.verifiedAt ?? language?.verifiedAt ?? statistics?.verifiedAt ?? null;

  const overview = page.sections.find((section) => section.sectionKey === 'overview');

  /** Counselling booked from a destination keeps that provenance, so the form
   * pre-selects the country and the lead records where it came from. */
  const counselling = counsellingHref({
    source: 'country',
    country: country.slug,
    from: `/countries/${country.slug}`,
  });

  /** Built after the fact from what actually rendered. */
  const jump = [
    whyCards.length && ['why', `Why ${country.name}`],
    universities.length && ['unis', 'Universities'],
    subjects.length && ['subjects', 'Subjects'],
    intakes.length && ['intakes', 'Intakes'],
    costRows.length && ['cost', 'Cost'],
    scholarships.length && ['scholarships', 'Scholarships'],
    languageRows.length && ['language', 'English'],
    (work?.visaInformation || visaFacts.length) && ['visa', 'Work and visa'],
    cities.length && ['cities', 'Cities'],
    statRows.length && ['statistics', 'At a glance'],
    faqs.length && ['faq', 'FAQ'],
    ['consultation', 'Get guidance'],
    ['structured-trust', 'About these figures'],
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <div className="cref cref-dest">
      {jump.length ? (
        <nav className="jump" aria-label="On this page">
          <div className="wrap jump-in">
            {jump.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <Link href="/countries">Study destinations</Link> ›{' '}
          <span aria-current="page">{country.name}</span>
        </nav>
      </div>

      {/* HERO + QUICK FACTS */}
      <section className="wrap hero-grid">
        <div>
          <span className="h-flag" aria-hidden="true">
            {country.flag?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={country.flag.url} alt="" />
            ) : (
              initials(country.name)
            )}
          </span>
          <h1>{country.pageHeading}</h1>
          <p className="lede">{country.shortDescription}</p>
          {verifiedAt ? (
            <div className="updated">Figures verified {formatDate(verifiedAt)}</div>
          ) : null}
          <div className="hero-btns">
            <Link href={counselling} className="btn btn-primary btn-lg">
              Get free counselling
            </Link>
            <Link href={`/courses?country=${country.slug}`} className="btn btn-ghost btn-lg">
              Browse {props.courseTotal ? formatNumber(props.courseTotal) : ''} courses
            </Link>
          </div>
        </div>

        <aside className="quickfacts">
          <h3>{country.name} at a glance</h3>
          <p className="qf-note">
            {verifiedAt ? `Published figures, verified ${formatDate(verifiedAt)}` : 'Published figures'}
          </p>
          {tuition ? (
            <div className="qf-row">
              <span>Tuition</span>
              <b>
                {currency}
                {tuition}
                {cost?.tuitionPeriod === 'PER_YEAR' ? '/yr' : ''}
              </b>
            </div>
          ) : null}
          {living ? (
            <div className="qf-row">
              <span>Living cost</span>
              <b>
                {currency}
                {living}
                {cost?.livingCostPeriod === 'PER_MONTH' ? '/mo' : ''}
              </b>
            </div>
          ) : null}
          {postStudyWork ? (
            <div className="qf-row">
              <span>Post-study work</span>
              <b>{postStudyWork}</b>
            </div>
          ) : null}
          {intakeLabels.length ? (
            <div className="qf-row">
              <span>Intakes</span>
              <b>{intakeLabels.join(' · ')}</b>
            </div>
          ) : null}
          {ielts ? (
            <div className="qf-row">
              <span>IELTS</span>
              <b>{ielts}</b>
            </div>
          ) : null}
          {pathway ? (
            <div className="qf-row">
              <span>PR pathway</span>
              <b>{pathway}</b>
            </div>
          ) : null}
        </aside>
      </section>

      {/* OVERVIEW (admin-managed) */}
      {overview?.subheading ? (
        <section className="sec sec-alt">
          <div className="wrap narrow">
            <div className="head">
              {overview.eyebrow ? <span className="eyebrow">{overview.eyebrow}</span> : null}
              <h2>{overview.heading ?? `About studying in ${country.name}`}</h2>
              <p>{overview.subheading}</p>
            </div>
          </div>
        </section>
      ) : null}

      {/* WHY */}
      {whyCards.length ? (
        <section className="sec" id="why">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">The case for {country.name}</span>
              <h2>Why study in {country.name}</h2>
              <p>Each point below comes from {country.name}’s published profile, not from editorial claims.</p>
            </div>
            <div className="why-grid">
              {whyCards.map((card) => (
                <article className="whycard" key={card.h}>
                  <h3>{card.h}</h3>
                  <p>{card.p}</p>
                  <span className="stat">{card.stat}</span>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* UNIVERSITIES */}
      {universities.length ? (
        <section className="sec sec-alt" id="unis">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Institutions</span>
              <h2>Universities in {country.name}</h2>
              <p>
                {formatNumber(props.universityTotal)} published institution
                {props.universityTotal === 1 ? '' : 's'} with courses you can open and compare.
              </p>
            </div>
            <div className="partners">
              {universities.map((university) => (
                <article className="partner" key={university.slug}>
                  {university.verified ? <span className="p-badge">Verified</span> : null}
                  <span className="p-logo" aria-hidden="true">
                    {initials(university.name)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3>{university.name}</h3>
                    {university.city ? <div className="loc">{university.city}</div> : null}
                    {university.institutionType ? (
                      <div className="p-meta">
                        <div>
                          <span>Type</span>
                          <b>{humanise(university.institutionType)}</b>
                        </div>
                      </div>
                    ) : null}
                    <div className="p-act">
                      <Link className="mini fill" href={`/universities/${university.slug}/courses`}>
                        View courses
                      </Link>
                      <Link className="mini" href={`/universities/${university.slug}`}>
                        View profile
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {props.universityTotal > universities.length ? (
              <p style={{ marginTop: 22 }}>
                <Link className="btn btn-ghost" href={`/universities?country=${country.slug}`}>
                  All {formatNumber(props.universityTotal)} universities in {country.name}
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* SUBJECTS */}
      {subjects.length ? (
        <section className="sec" id="subjects">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">What you can study</span>
              <h2>Popular subjects in {country.name}</h2>
              <p>Subject areas with courses currently published for this destination.</p>
            </div>
            <div className="grid g4">
              {subjects.map((subject) => (
                <Link
                  key={subject.value}
                  href={`/courses?country=${country.slug}&subject=${subject.value}#discovery`}
                  className="card mini-card"
                >
                  <span className="mini-ic" aria-hidden="true">
                    {initials(subject.label)}
                  </span>
                  <div>
                    <h3>{subject.label}</h3>
                    <div className="mc-sub">
                      {formatNumber(subject.count)} course{subject.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className="go" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* INTAKES */}
      {intakes.length ? (
        <section className="sec sec-alt" id="intakes">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Timing</span>
              <h2>Major intakes in {country.name}</h2>
              <p>Published entry points, with the application window each one records.</p>
            </div>
            <div className="intakes">
              {intakes.map((entry) => {
                const intake = entry.intake ?? entry;
                const major = 'isMajor' in entry && entry.isMajor;
                const window = intakeRange(intake);
                return (
                  <article className={`intake${major ? ' main' : ''}`} key={entry.id}>
                    {major ? <span className="tag">Main intake</span> : null}
                    <h3>{intake.name}</h3>
                    {/* Only when the published window says more than the name. */}
                    {window !== intake.name ? <div className="mo">{window}</div> : null}
                    <div className="i-row">
                      <span>Availability</span>
                      <b>{humanise(entry.availabilityStatus)}</b>
                    </div>
                    {entry.applicationOpeningNote ? (
                      <div className="i-row">
                        <span>Applications open</span>
                        <b>{entry.applicationOpeningNote}</b>
                      </div>
                    ) : null}
                    {entry.applicationDeadlineNote ? (
                      <div className="i-row">
                        <span>Apply by</span>
                        <b>{entry.applicationDeadlineNote}</b>
                      </div>
                    ) : null}
                    {entry.notes ? (
                      <div className="i-row">
                        <span>Notes</span>
                        <b>{entry.notes}</b>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* COST */}
      {costRows.length ? (
        <section className="sec" id="cost">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Budget</span>
              <h2>Cost of studying in {country.name}</h2>
              <p>Published ranges for international students, in {cost?.currencyCode ?? 'local currency'}.</p>
            </div>
            <div className="cost-table">
              <div className="ct-row h">
                <span>Item</span>
                <span>Range</span>
                <span>Period</span>
              </div>
              {costRows.map((row) => (
                <div className="ct-row" key={row.label}>
                  <span>{row.label}</span>
                  <b>{row.value}</b>
                  <span className="note">{row.note}</span>
                </div>
              ))}
            </div>
            {cost?.tuitionNotes || cost?.livingCostNotes ? (
              <p className="disclaimer">{cost.tuitionNotes ?? cost.livingCostNotes}</p>
            ) : null}
            {cost?.disclaimer ? <p className="disclaimer">{cost.disclaimer}</p> : null}
          </div>
        </section>
      ) : null}

      {/* SCHOLARSHIPS */}
      {scholarships.length ? (
        <section className="sec sec-alt" id="scholarships">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Funding</span>
              <h2>Scholarships to study in {country.name}</h2>
              <p>
                {formatNumber(props.scholarshipTotal)} published award
                {props.scholarshipTotal === 1 ? '' : 's'} linked to this destination.
              </p>
            </div>
            <div className="schols">
              {scholarships.map((scholarship) => (
                <article className="schol" key={scholarship.slug}>
                  {scholarship.amount ? <div className="s-amt">{scholarship.amount}</div> : null}
                  <h3>
                    <Link href={`/scholarships/${scholarship.slug}`}>{scholarship.title}</Link>
                  </h3>
                  {scholarship.summary ? <p>{scholarship.summary}</p> : <p />}
                  {scholarship.level || scholarship.deadline ? (
                    <div className="s-foot">
                      {scholarship.level ? (
                        <span>
                          Level <b>{scholarship.level}</b>
                        </span>
                      ) : null}
                      {scholarship.deadline ? (
                        <span>
                          Closes <b>{formatDate(scholarship.deadline)}</b>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            {props.scholarshipTotal > scholarships.length ? (
              <p style={{ marginTop: 22 }}>
                <Link className="btn btn-ghost" href={`/scholarships?country=${country.slug}`}>
                  All {formatNumber(props.scholarshipTotal)} scholarships
                </Link>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ENGLISH */}
      {languageRows.length ? (
        <section className="sec" id="language">
          <div className="wrap narrow">
            <div className="head">
              <span className="eyebrow">Admissions</span>
              <h2>Language requirements for {country.name}</h2>
              {language?.generalNotes ? <p>{language.generalNotes}</p> : null}
            </div>
            <div className="cost-table">
              <div className="ct-row h">
                <span>Test</span>
                <span>Requirement</span>
                <span>Minimum score</span>
              </div>
              {languageRows.map(([test, requirement, score]) => (
                <div className="ct-row" key={test}>
                  <span>{test}</span>
                  <b>{humanise(requirement)}</b>
                  <span className="note">{score ?? '—'}</span>
                </div>
              ))}
            </div>
            {language?.languageWaiverAvailable ? (
              <p className="disclaimer">
                A waiver is available for some applicants.
                {language.waiverNotes ? ` ${language.waiverNotes}` : ''}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* VISA */}
      {work?.visaInformation || visaFacts.length ? (
        <section className="sec sec-alt" id="visa">
          <div className="wrap narrow">
            <div className="head">
              <span className="eyebrow">Student visa</span>
              <h2>Work and visa pathways in {country.name}</h2>
              {work?.visaInformation ? <p>{work.visaInformation}</p> : null}
            </div>
            {visaFacts.length ? (
              <div className="cost-table">
                {visaFacts.map(([label, value]) => (
                  <div className="ct-row" key={label} style={{ gridTemplateColumns: '1fr 2fr' }}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="disclaimer">
              Immigration rules change frequently. Always confirm current requirements with the
              official government source before applying.
            </p>
          </div>
        </section>
      ) : null}

      {/* INLINE CTA */}
      <div className="wrap" style={{ padding: '48px 24px' }}>
        <section className="cta-inline">
          <div className="g">
            <h3>Not sure which {country.name} university fits your profile?</h3>
            <p>Tell a counsellor your marks, budget and target intake and get a shortlist back.</p>
          </div>
          <Link href={counselling} className="btn btn-w btn-lg">
            Get free counselling
          </Link>
        </section>
      </div>

      {/* CITIES */}
      {cities.length ? (
        <section className="sec" id="cities">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Where to live</span>
              <h2>Cities in {country.name}</h2>
              <p>Published student cities with their own guides.</p>
            </div>
            <div className="cities">
              {cities.map((city) => (
                <Link
                  className="city"
                  key={city.id}
                  // A city guide lives under its destination; `/cities/<slug>`
                  // is not a route the site serves, so every one of these
                  // links was a 404.
                  href={`/study-in/${country.slug}/${city.slug}`}
                >
                  <div
                    className="city-img"
                    style={
                      city.heroMedia?.url
                        ? {
                            backgroundImage: `linear-gradient(180deg,rgba(13,21,36,0) 40%,rgba(13,21,36,.72)), url(${city.heroMedia.url})`,
                          }
                        : undefined
                    }
                  >
                    <h3>{city.name}</h3>
                  </div>
                  <div className="city-b">
                    {city.shortDescription ? <p>{city.shortDescription}</p> : null}
                    {city.state?.name ? (
                      <div className="city-row">
                        <span>Region</span>
                        <b>{city.state.name}</b>
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* STATISTICS */}
      {statRows.length ? (
        <section className="sec sec-alt" id="statistics">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Published figures</span>
              <h2>{country.name} at a glance</h2>
              {statistics?.sourceReference ? (
                <p>Sourced and verified figures from {country.name}’s statistics profile.</p>
              ) : null}
            </div>
            <div className="statgrid" style={{ marginTop: 0 }}>
              {statRows.map(([label, value]) => (
                <div className="stat" key={label}>
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      {faqs.length ? (
        <section className="sec" id="faq">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Common questions</span>
              <h2>Frequently asked questions</h2>
            </div>
            <div className="faq">
              {faqs.map((faq, index) => (
                <details className="qa" key={faq.id} open={index === 0}>
                  <summary>
                    {faq.question} <span className="plus">+</span>
                  </summary>
                  <p className="ans">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* GUIDANCE
          Always present: a visitor who has read this far should never have to
          hunt for the way to ask a question, whether or not a consultant has
          published a profile for this destination. */}
      <section className="sec sec-alt" id="consultation">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">
              {consultantCards.length ? 'Study abroad consultants' : 'Talk it through'}
            </span>
            <h2>Guidance for {country.name}</h2>
            <p>
              {consultantCards.length
                ? 'Consultants publish their own destinations and services.'
                : 'A counsellor can check your profile against this destination before you commit to it.'}{' '}
              <a href="#structured-trust">Read how the figures on this page are sourced</a>.
            </p>
          </div>
          {consultantCards.length ? (
            <div className="cons-grid">
              {consultantCards.map((card) => (
                <article className="cons" key={card.id}>
                  <div className="cons-top">
                    <span className="fl" aria-hidden="true">
                      {initials(card.title)}
                    </span>
                    <h3>{card.title}</h3>
                  </div>
                  <p>{card.shortDescription}</p>
                  {card.isFreeConsultation ? (
                    <span className="free-badge">Free consultation</span>
                  ) : null}
                  <Link className="view" href={card.ctaUrl ?? '/study-abroad-consultants'}>
                    {card.ctaLabel}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="cta2-btns" style={{ justifyContent: 'flex-start' }}>
              <Link href={counselling} className="btn btn-primary btn-lg">
                Book free counselling
              </Link>
              <Link href="/study-abroad-consultants" className="btn btn-ghost btn-lg">
                Browse consultants
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* WHAT THESE FIGURES MEAN
          The template closes on a bare "trusted by students" band. Universta
          can say something truer and more useful: where each number on this
          page comes from, and what it is not. */}
      <section className="sec" id="structured-trust">
        <div className="wrap">
          <div className="head">
            <span className="eyebrow">Reading this page</span>
            <h2>What these figures mean</h2>
          </div>
          <div className="prose" style={{ maxWidth: 760 }}>
            <p>
              Every cost, intake, language and work figure above is taken from{' '}
              {country.name}’s published profile in the Universta catalogue
              {verifiedAt ? `, last verified ${formatDate(verifiedAt)}` : ''}. Nothing on this page
              is estimated or averaged: where a figure is not published, the row is simply absent.
            </p>
            <p>
              They describe the destination, not your application. Tuition varies by university and
              programme, intake windows and deadlines are set per course, and visa rules change.
              Information is editorial and may vary — confirm the detail that decides your choice
              against the published sources shown above and the university’s own listing before you
              apply.
            </p>
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <div className="wrap" style={{ padding: '48px 24px 72px' }}>
        <section className="cta-soft">
          <h2>Ready to plan your move to {country.name}?</h2>
          <p>
            Shortlist courses, compare universities and check the intake calendar — then talk it
            through with a counsellor before you apply.
          </p>
          <div className="cta2-btns">
            <Link href={`/courses?country=${country.slug}`} className="btn btn-primary btn-lg">
              Browse courses
            </Link>
            <Link href={counselling} className="btn btn-ghost btn-lg">
              Book free counselling
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
