import Link from "next/link";
import type { CountryPage } from "@/lib/countries";
import type { CitySummary } from "@/lib/locations";
import { counsellingHref } from "@/lib/counselling-link";
import { intakeRange } from "@/lib/intake-range";
import { formatDate, formatNumber } from "@/lib/format";
import { RichText, richTextToPlainText } from "../phase1/RichText";

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
  subjects: Array<{ id: string; name: string; slug: string }>;
  courseTotal: number;
};

function humanise(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

const SKIP_WORDS = new Set(["of", "in", "and", "the", "for", "a", "an", "&"]);

function initials(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word && !SKIP_WORDS.has(word.toLowerCase()));
  if (words.length === 0) return value.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function months(value: number) {
  if (value % 12 === 0) {
    const years = value / 12;
    return `${years} year${years === 1 ? "" : "s"}`;
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
  PER_YEAR: "per year",
  PER_MONTH: "per month",
  PER_TERM: "per term",
  ONE_TIME: "one-off",
};

export function CountryDetailReference(props: CountryDetailReferenceProps) {
  const { page, cities, universities, scholarships, subjects } = props;
  const { country, profiles, faqs, consultantCards } = page;
  const { cost, work, language, statistics } = profiles;
  // Institutional totals and curated highlights are calculated by the API from
  // published catalogue records. Country profiles remain the source for
  // editorial facts (cost notes, visas, language and intake guidance), but
  // must not duplicate the catalogue's counts or rankings.
  const derived = country.derived;
  const derivedTuition = derived?.averageTuition ?? null;
  const derivedStatistics = derived?.statistics ?? null;
  const rankedUniversitySource = derived?.topRankedUniversities ?? [];
  const popularUniversitySource = derived?.popularUniversities ?? [];
  const popularCourses = derived?.popularCourses ?? [];
  /* The three university blocks are independent queries over the same
   * published set: the listing takes the first few, the ranked block takes
   * everything holding a QS position, and the popular block takes the curated
   * picks. Across a large catalogue those are different institutions. Across a
   * small one they are not -- Malta publishes a single university, which
   * satisfied all three and printed three identical cards. Each block now
   * shows only what the blocks above it have not, and disappears when that
   * leaves it empty. */
  const listedUniversitySlugs = new Set(universities.map((row) => row.slug));
  const topRankedUniversities = rankedUniversitySource.filter(
    (row) => !listedUniversitySlugs.has(row.slug),
  );
  const shownUniversitySlugs = new Set([
    ...listedUniversitySlugs,
    ...topRankedUniversities.map((row) => row.slug),
  ]);
  const popularUniversities = popularUniversitySource.filter(
    (row) => !shownUniversitySlugs.has(row.slug),
  );
  /* The QS position is the one fact the listing card does not already carry,
   * so it moves onto that card rather than vanishing with the suppressed
   * ranked duplicate. */
  const qsRankingBySlug = new Map<string, number>(
    rankedUniversitySource.flatMap((row) =>
      typeof row.qsRanking === "number" && row.qsRanking > 0
        ? [[row.slug, row.qsRanking] as [string, number]]
        : [],
    ),
  );
  const derivedUniversityCount = derivedStatistics?.universitiesCount ?? null;
  const derivedPublicUniversityCount =
    derivedStatistics?.publicUniversitiesCount ?? null;
  const derivedCourseCount = derivedStatistics?.coursesCount ?? null;
  const intakes = profiles.intakes ?? [];
  const profileTuition = range(cost?.tuitionMin, cost?.tuitionMax);
  const tuition =
    profileTuition ??
    (derivedTuition ? formatNumber(derivedTuition.amount) : null);
  const tuitionIsDerived = !profileTuition && Boolean(derivedTuition);
  const currencyCode = cost?.currencyCode ?? derivedTuition?.currencyCode;
  const currency = currencyCode ? `${currencyCode} ` : "";

  const living = range(cost?.livingCostMin, cost?.livingCostMax);

  const postStudyWork =
    work?.postStudyWorkAvailable &&
    (work.postStudyWorkMinMonths || work.postStudyWorkMaxMonths)
      ? work.postStudyWorkMinMonths &&
        work.postStudyWorkMaxMonths &&
        work.postStudyWorkMinMonths !== work.postStudyWorkMaxMonths
        ? `${months(work.postStudyWorkMinMonths)} – ${months(work.postStudyWorkMaxMonths)}`
        : months(
            (work.postStudyWorkMinMonths ??
              work.postStudyWorkMaxMonths) as number,
          )
      : work?.postStudyWorkAvailable
        ? "Available"
        : null;

  const intakeLabels = intakes
    .map((entry) => intakeRange(entry.intake ?? entry))
    .filter(Boolean);

  const ielts =
    language?.ieltsRequirement && language.ieltsRequirement !== "NOT_REQUIRED"
      ? `${humanise(language.ieltsRequirement)}${language.ieltsMinScore ? ` · ${language.ieltsMinScore}` : ""}`
      : language?.ieltsRequirement
        ? humanise(language.ieltsRequirement)
        : null;

  const pathway =
    work?.immigrationPathwayStrength &&
    work.immigrationPathwayStrength !== "NOT_PUBLISHED"
      ? humanise(work.immigrationPathwayStrength)
      : null;

  /** Editorial "why" cards come from the profile's own published summaries, so
   * the section carries the client's copy voice without inventing claims. */
  const whyCards = [
    postStudyWork && {
      h: "Post-study work rights",
      p:
        work?.postStudyWorkSummary ??
        "Graduates of eligible programmes can stay on to work after finishing.",
      stat: postStudyWork,
    },
    work?.partTimeAllowed && {
      h: "Work while you study",
      p:
        work.partTimeSummary ??
        "Part-time work is permitted during your studies.",
      stat: work.partTimeHoursPerWeek
        ? `${work.partTimeHoursPerWeek} hours a week`
        : "Permitted",
    },
    pathway && {
      h: "Route to residency",
      p:
        work?.immigrationPathwaySummary ??
        "A published immigration pathway follows study in this destination.",
      stat: `${pathway} pathway`,
    },
    intakeLabels.length > 1 && {
      h: `${intakeLabels.length} intakes a year`,
      p: "More than one entry point a year means a missed deadline costs you months rather than a full year.",
      stat: intakeLabels.join(" · "),
    },
    language?.languageWaiverAvailable && {
      h: "English test waiver available",
      p:
        language.waiverNotes ??
        language.generalNotes ??
        "Some programmes waive the English test where your prior degree was taught in English.",
      stat: ielts ? `IELTS ${ielts.toLowerCase()}` : "Waiver available",
    },
    derivedUniversityCount && {
      h: "A catalogue you can browse",
      p: "Every institution, course and scholarship on this page is a published record you can open and compare.",
      stat: `${formatNumber(derivedUniversityCount)} universities${derivedCourseCount ? ` · ${formatNumber(derivedCourseCount)} courses` : ""}`,
    },
  ].filter(Boolean) as Array<{ h: string; p: string; stat: string }>;

  const costRows = [
    tuition && {
      label: tuitionIsDerived ? "Average tuition" : "Tuition",
      value: `${currency}${tuition}`,
      note:
        PERIOD_LABEL[cost?.tuitionPeriod ?? derivedTuition?.period ?? ""] ?? "",
    },
    living && {
      label: "Living costs",
      value: `${currency}${living}`,
      note: PERIOD_LABEL[cost?.livingCostPeriod ?? ""] ?? "",
    },
    range(cost?.accommodationMin, cost?.accommodationMax) && {
      label: "Accommodation",
      value: `${currency}${range(cost?.accommodationMin, cost?.accommodationMax)}`,
      note: "",
    },
    range(cost?.foodCostMin, cost?.foodCostMax) && {
      label: "Food",
      value: `${currency}${range(cost?.foodCostMin, cost?.foodCostMax)}`,
      note: "",
    },
    range(cost?.transportCostMin, cost?.transportCostMax) && {
      label: "Transport",
      value: `${currency}${range(cost?.transportCostMin, cost?.transportCostMax)}`,
      note: "",
    },
    cost?.healthInsuranceCost && {
      label: "Health insurance",
      value: `${currency}${formatNumber(cost.healthInsuranceCost)}`,
      note: "",
    },
    range(cost?.applicationFeeMin, cost?.applicationFeeMax) && {
      label: "Application fee",
      value: `${currency}${range(cost?.applicationFeeMin, cost?.applicationFeeMax)}`,
      note: "",
    },
  ].filter(Boolean) as Array<{ label: string; value: string; note: string }>;

  const languageRows = [
    ["IELTS", language?.ieltsRequirement, language?.ieltsMinScore],
    ["TOEFL", language?.toeflRequirement, language?.toeflMinScore],
    ["PTE", language?.pteRequirement, language?.pteMinScore],
    ["Duolingo", language?.duolingoRequirement, language?.duolingoMinScore],
  ].filter(([, requirement]) => Boolean(requirement)) as Array<
    [string, string, string | null | undefined]
  >;

  const visaFacts = [
    work?.visaType && ["Visa type", work.visaType],
    work?.visaFee && [
      "Visa fee",
      `${work.visaFeeCurrencyCode ? `${work.visaFeeCurrencyCode} ` : ""}${formatNumber(work.visaFee)}`,
    ],
    work?.visaSuccessBand &&
      work.visaSuccessBand !== "NOT_PUBLISHED" && [
        "Visa success band",
        humanise(work.visaSuccessBand),
      ],
    work?.visaProcessingTime && ["Processing time", work.visaProcessingTime],
    work?.proofOfFundsSummary && ["Proof of funds", work.proofOfFundsSummary],
  ].filter(Boolean) as Array<[string, string]>;

  /* Country identity the client contract asks for. These are plain published
   * attributes of the destination rather than verified statistics, so they are
   * not behind the profile verification gate. */
  const identityRows = [
    country.capitalCity && ["Capital", country.capitalCity],
    country.officialLanguage && ["Language", country.officialLanguage],
    country.currency?.code && [
      "Currency",
      `${country.currency.code}${country.currency.symbol ? ` (${country.currency.symbol})` : ""}`,
    ],
  ].filter(Boolean) as Array<[string, string]>;

  /* The four long-form fields in the client contract map to stable section
   * keys. `overview` is rendered separately above, so it is excluded here to
   * avoid showing the same body twice. */
  const clientSections = (
    [
      ["why-study", `Why study in ${country.name}`],
      // These are the keys the Country editor actually offers; "admission-process"
      // and "cost-breakdown" read naturally but are not in its vocabulary, so a
      // section written for them could never reach this page.
      ["application-steps", "Admission process"],
      ["cost-of-study", "Cost breakdown"],
      ["visa-process", "Visa process"],
    ] as Array<[string, string]>
  )
    .map(([key, fallbackHeading]) => {
      const section = page.sections.find((row) => row.sectionKey === key);
      if (!section) return null;
      const body = (section.bodyJson ?? {}) as { paragraphs?: unknown };
      const paragraphs = Array.isArray(body.paragraphs)
        ? body.paragraphs.filter(
            (line): line is string => typeof line === "string" && Boolean(line.trim()),
          )
        : [];
      if (!paragraphs.length) return null;
      return {
        key,
        heading: section.heading ?? fallbackHeading,
        eyebrow: section.eyebrow ?? null,
        paragraphs,
      };
    })
    .filter(Boolean) as Array<{
    key: string;
    heading: string;
    eyebrow: string | null;
    paragraphs: string[];
  }>;

  const statRows = [
    derivedUniversityCount && [
      "Universities",
      formatNumber(derivedUniversityCount),
    ],
    derivedPublicUniversityCount && [
      "Public universities",
      formatNumber(derivedPublicUniversityCount),
    ],
    statistics?.privateUniversitiesCount && [
      "Private universities",
      formatNumber(statistics.privateUniversitiesCount),
    ],
    derivedCourseCount && ["Courses", formatNumber(derivedCourseCount)],
    /* A count of how many ranked universities the country has, not of how many
     * cards survived deduplication -- so it reads the unfiltered set. */
    rankedUniversitySource.length > 0 && [
      "Top-ranked universities",
      formatNumber(rankedUniversitySource.length),
    ],
    statistics?.scholarshipsCount && [
      "Scholarships",
      formatNumber(statistics.scholarshipsCount),
    ],
    statistics?.citiesCount && ["Cities", formatNumber(statistics.citiesCount)],
    statistics?.internationalStudentsCount && [
      "International students",
      formatNumber(statistics.internationalStudentsCount),
    ],
  ].filter(Boolean) as Array<[string, string]>;

  /* Every row in this panel is optional. On a destination whose cost, work,
   * language and intake profiles are all unpublished the aside still rendered
   * as a titled card with nothing in it, so it is only mounted when it has at
   * least one figure to show. */
  const hasQuickFacts = Boolean(
    tuition ||
    living ||
    postStudyWork ||
    intakeLabels.length ||
    ielts ||
    pathway,
  );

  const verifiedAt =
    cost?.verifiedAt ??
    work?.verifiedAt ??
    language?.verifiedAt ??
    statistics?.verifiedAt ??
    null;

  /* The client's `content` column. Country.overview is canonical; the legacy
   * editorial "overview" section supplies the body only when it is absent, so
   * the page never shows two overviews. It holds rich text, so it goes through
   * the same RichText renderer the long-form sections use -- splitting it into
   * paragraphs printed the markup itself on the page. */
  const overviewSection = page.sections.find(
    (section) => section.sectionKey === "overview",
  );
  const overviewBody =
    country.overview?.trim() || overviewSection?.subheading?.trim() || "";
  const universityTotal = derivedUniversityCount ?? props.universityTotal;
  const universityHighlightsAvailable =
    topRankedUniversities.length > 0 ||
    popularUniversities.length > 0 ||
    popularCourses.length > 0;
  const universitySectionAvailable =
    universities.length > 0 || universityHighlightsAvailable;

  /** Counselling booked from a destination keeps that provenance, so the form
   * pre-selects the country and the lead records where it came from. */
  const counselling = counsellingHref({
    source: "country",
    country: country.slug,
    from: `/countries/${country.slug}`,
  });

  /** Built after the fact from what actually rendered. */
  const jump = [
    whyCards.length && ["why", `Why ${country.name}`],
    universitySectionAvailable && ["unis", "Universities"],
    subjects.length && ["subjects", "Subjects"],
    intakes.length && ["intakes", "Intakes"],
    costRows.length && ["cost", "Cost"],
    scholarships.length && ["scholarships", "Scholarships"],
    languageRows.length && ["language", "English"],
    (work?.visaInformation || visaFacts.length) && ["visa", "Work and visa"],
    cities.length && ["cities", "Cities"],
    statRows.length && ["statistics", "At a glance"],
    ...clientSections.map(
      (section) => [`country-${section.key}`, section.heading] as [string, string],
    ),
    faqs.length && ["faq", "FAQ"],
    ["consultation", "Get guidance"],
    ["structured-trust", "About these figures"],
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
          <Link href="/">Home</Link> ›{" "}
          <Link href="/countries">Study destinations</Link> ›{" "}
          <span aria-current="page">{country.name}</span>
        </nav>
      </div>

      {/* HERO + QUICK FACTS */}
      <section
        className={`wrap hero-grid${hasQuickFacts ? "" : " hero-grid-solo"}`}
      >
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
          {country.heroImage?.url ? (
            <figure className="hero-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={country.heroImage.url}
                alt={country.heroImage.alt || country.name}
                loading="eager"
              />
            </figure>
          ) : null}
          {country.tagline ? <p className="eyebrow">{country.tagline}</p> : null}
          <p className="lede">{richTextToPlainText(country.shortDescription)}</p>
          {verifiedAt ? (
            <div className="updated">
              Figures verified {formatDate(verifiedAt)}
            </div>
          ) : null}
          <div className="hero-btns">
            <Link href={counselling} className="btn btn-primary btn-lg">
              Get free counselling
            </Link>
            <Link
              href={`/courses?country=${country.slug}`}
              className="btn btn-ghost btn-lg"
            >
              Browse {props.courseTotal ? formatNumber(props.courseTotal) : ""}{" "}
              courses
            </Link>
          </div>
        </div>

        {hasQuickFacts ? (
          <aside className="quickfacts">
            <h2>{country.name} at a glance</h2>
            <p className="qf-note">
              {verifiedAt
                ? `Published figures, verified ${formatDate(verifiedAt)}`
                : "Published figures"}
            </p>
            {tuition ? (
              <div className="qf-row">
                <span>Tuition</span>
                <b>
                  {currency}
                  {tuition}
                  {cost?.tuitionPeriod === "PER_YEAR" ? "/yr" : ""}
                </b>
              </div>
            ) : null}
            {living ? (
              <div className="qf-row">
                <span>Living cost</span>
                <b>
                  {currency}
                  {living}
                  {cost?.livingCostPeriod === "PER_MONTH" ? "/mo" : ""}
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
                <b>{intakeLabels.join(" · ")}</b>
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
        ) : null}
      </section>

      {/* OVERVIEW (the client's `content`) */}
      {overviewBody ? (
        <section className="sec sec-alt" id="overview">
          <div className="wrap narrow">
            <div className="head">
              {overviewSection?.eyebrow ? (
                <span className="eyebrow">{overviewSection.eyebrow}</span>
              ) : null}
              <h2>
                {overviewSection?.heading ??
                  `About studying in ${country.name}`}
              </h2>
            </div>
            <div className="prose">
              <RichText value={overviewBody} />
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
              <p>
                Each point below comes from {country.name}’s published profile,
                not from editorial claims.
              </p>
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
      {universitySectionAvailable ? (
        <section className="sec sec-alt" id="unis">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Institutions</span>
              <h2>Universities in {country.name}</h2>
              {universityTotal ? (
                <p>
                  {formatNumber(universityTotal)} published institution
                  {universityTotal === 1 ? "" : "s"} with courses you can open
                  and compare.
                </p>
              ) : null}
            </div>
            {universities.length ? (
              <div className="partners">
                {universities.map((university) => {
                  const qsRanking = qsRankingBySlug.get(university.slug);
                  return (
                    <article className="partner" key={university.slug}>
                      {university.verified ? (
                        <span className="p-badge">Verified</span>
                      ) : null}
                      <span className="p-logo" aria-hidden="true">
                        {initials(university.name)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>{university.name}</h3>
                        {university.city ? (
                          <div className="loc">{university.city}</div>
                        ) : null}
                        {university.institutionType || qsRanking ? (
                          <div className="p-meta">
                            {university.institutionType ? (
                              <div>
                                <span>Type</span>
                                <b>{humanise(university.institutionType)}</b>
                              </div>
                            ) : null}
                            {qsRanking ? (
                              <div>
                                <span>QS ranking</span>
                                <b>#{formatNumber(qsRanking)}</b>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="p-act">
                          <Link
                            className="mini fill"
                            href={`/universities/${university.slug}/courses`}
                          >
                            View courses
                          </Link>
                          <Link
                            className="mini"
                            href={`/universities/${university.slug}`}
                          >
                            View profile
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
            {universityTotal > universities.length ? (
              <p style={{ marginTop: 22 }}>
                <Link
                  className="btn btn-ghost"
                  href={`/universities?country=${country.slug}`}
                >
                  All {formatNumber(universityTotal)} universities in{" "}
                  {country.name}
                </Link>
              </p>
            ) : null}
            {topRankedUniversities.length ? (
              <div style={{ marginTop: 32 }}>
                <div className="head">
                  <h3>Top ranked universities</h3>
                </div>
                <div className="partners">
                  {topRankedUniversities.map((university) => (
                    <article className="partner" key={university.id}>
                      <span className="p-logo" aria-hidden="true">
                        {initials(university.name)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>{university.name}</h3>
                        <div className="p-meta">
                          {university.institutionType ? (
                            <div>
                              <span>Type</span>
                              <b>{humanise(university.institutionType)}</b>
                            </div>
                          ) : null}
                          {university.qsRanking ? (
                            <div>
                              <span>QS ranking</span>
                              <b>#{formatNumber(university.qsRanking)}</b>
                            </div>
                          ) : null}
                        </div>
                        <div className="p-act">
                          <Link
                            className="mini"
                            href={`/universities/${university.slug}`}
                          >
                            View profile
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            {popularUniversities.length ? (
              <div style={{ marginTop: 32 }}>
                <div className="head">
                  <h3>Popular universities</h3>
                </div>
                <div className="partners">
                  {popularUniversities.map((university) => (
                    <article className="partner" key={university.id}>
                      <span className="p-logo" aria-hidden="true">
                        {initials(university.name)}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3>{university.name}</h3>
                        {university.institutionType ? (
                          <div className="p-meta">
                            <div>
                              <span>Type</span>
                              <b>{humanise(university.institutionType)}</b>
                            </div>
                          </div>
                        ) : null}
                        <div className="p-act">
                          <Link
                            className="mini"
                            href={`/universities/${university.slug}`}
                          >
                            View profile
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            {popularCourses.length ? (
              <div style={{ marginTop: 32 }}>
                <div className="head">
                  <h3>Popular courses</h3>
                </div>
                <div className="grid g3">
                  {popularCourses.map((course) => (
                    <Link
                      className="card mini-card"
                      href={`/courses/${course.slug}`}
                      key={course.id}
                    >
                      <span className="mini-ic" aria-hidden="true">
                        {initials(course.name)}
                      </span>
                      <div>
                        <h3>{course.name}</h3>
                        {course.shortDescription ? (
                          <div className="mc-sub">
                            {course.shortDescription}
                          </div>
                        ) : null}
                      </div>
                      <span className="go" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
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
              <h2>Subjects in {country.name}</h2>
              <p>Subjects directly assigned to this study destination.</p>
            </div>
            <div className="grid g4">
              {subjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={`/subjects/${subject.slug}`}
                  className="card mini-card"
                >
                  <span className="mini-ic" aria-hidden="true">
                    {initials(subject.name)}
                  </span>
                  <div>
                    <h3>{subject.name}</h3>
                    <div className="mc-sub">View subject</div>
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
              <p>
                Published entry points, with the application window each one
                records.
              </p>
            </div>
            <div className="intakes">
              {intakes.map((entry) => {
                const intake = entry.intake ?? entry;
                const major = "isMajor" in entry && entry.isMajor;
                const window = intakeRange(intake);
                return (
                  <article
                    className={`intake${major ? " main" : ""}`}
                    key={entry.id}
                  >
                    {major ? <span className="tag">Main intake</span> : null}
                    <h3>{intake.name}</h3>
                    {/* Only when the published window says more than the name. */}
                    {window !== intake.name ? (
                      <div className="mo">{window}</div>
                    ) : null}
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
              <p>
                Published ranges for international students, in{" "}
                {cost?.currencyCode ?? "local currency"}.
              </p>
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
            {/* Each note is its own field describing a different row of the
              * table above. `??` between them meant a country that filled in
              * tuition notes could never show its living-cost notes. */}
            {cost?.tuitionNotes ? (
              <p className="disclaimer">{cost.tuitionNotes}</p>
            ) : null}
            {cost?.livingCostNotes ? (
              <p className="disclaimer">{cost.livingCostNotes}</p>
            ) : null}
            {cost?.disclaimer ? (
              <p className="disclaimer">{cost.disclaimer}</p>
            ) : null}
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
                {props.scholarshipTotal === 1 ? "" : "s"} linked to this
                destination.
              </p>
            </div>
            <div className="schols">
              {scholarships.map((scholarship) => (
                <article className="schol" key={scholarship.slug}>
                  {scholarship.amount ? (
                    <div className="s-amt">{scholarship.amount}</div>
                  ) : null}
                  <h3>
                    <Link href={`/scholarships/${scholarship.slug}`}>
                      {scholarship.title}
                    </Link>
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
                <Link
                  className="btn btn-ghost"
                  href={`/scholarships?country=${country.slug}`}
                >
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
                  <span className="note">{score ?? "—"}</span>
                </div>
              ))}
            </div>
            {language?.languageWaiverAvailable ? (
              <p className="disclaimer">
                A waiver is available for some applicants.
                {language.waiverNotes ? ` ${language.waiverNotes}` : ""}
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
              {work?.visaInformation ? (
                <RichText value={work.visaInformation} />
              ) : null}
            </div>
            {visaFacts.length ? (
              <div className="cost-table">
                {visaFacts.map(([label, value]) => (
                  <div
                    className="ct-row"
                    key={label}
                    style={{ gridTemplateColumns: "1fr 2fr" }}
                  >
                    <span>{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="disclaimer">
              Immigration rules change frequently. Always confirm current
              requirements with the official government source before applying.
            </p>
          </div>
        </section>
      ) : null}

      {/* INLINE CTA */}
      <div className="wrap" style={{ padding: "48px 24px" }}>
        <section className="cta-inline">
          <div className="g">
            <h3>Not sure which {country.name} university fits your profile?</h3>
            <p>
              Tell a counsellor your marks, budget and target intake and get a
              shortlist back.
            </p>
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
                    {city.shortDescription ? (
                      <p>{city.shortDescription}</p>
                    ) : null}
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
              {derivedStatistics ? (
                <p>
                  Calculated from published universities and course offerings in
                  the Universta catalogue.
                </p>
              ) : statistics?.sourceReference ? (
                <p>
                  Sourced and verified figures from {country.name}’s statistics
                  profile.
                </p>
              ) : null}
            </div>
            <div className="statgrid" style={{ marginTop: 0 }}>
              {statRows.map(([label, value]) => (
                <div className="stat" key={label}>
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
              {identityRows.map(([label, value]) => (
                <div className="stat" key={label}>
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : identityRows.length ? (
        // Identity is published for every country, so it still has a home when
        // no verified statistics exist to anchor the section.
        <section className="sec sec-alt" id="statistics">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Published figures</span>
              <h2>{country.name} at a glance</h2>
            </div>
            <div className="statgrid" style={{ marginTop: 0 }}>
              {identityRows.map(([label, value]) => (
                <div className="stat" key={label}>
                  <b>{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* CLIENT LONG-FORM SECTIONS */}
      {clientSections.map((section, index) => (
        <section
          className={`sec${index % 2 === 0 ? "" : " sec-alt"}`}
          id={`country-${section.key}`}
          key={section.key}
        >
          <div className="wrap narrow">
            <div className="head">
              {section.eyebrow ? (
                <span className="eyebrow">{section.eyebrow}</span>
              ) : null}
              <h2>{section.heading}</h2>
            </div>
            <div className="prose">
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <RichText
                  key={`${section.key}-${paragraphIndex}`}
                  value={paragraph}
                />
              ))}
            </div>
          </div>
        </section>
      ))}

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
                  <RichText className="ans" value={faq.answer} />
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
              {consultantCards.length
                ? "Study abroad consultants"
                : "Talk it through"}
            </span>
            <h2>Guidance for {country.name}</h2>
            <p>
              {consultantCards.length
                ? "Consultants publish their own destinations and services."
                : "A counsellor can check your profile against this destination before you commit to it."}{" "}
              <a href="#structured-trust">
                Read how the figures on this page are sourced
              </a>
              .
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
                  <Link
                    className="view"
                    href={card.ctaUrl ?? "/study-abroad-consultants"}
                  >
                    {card.ctaLabel}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="cta2-btns" style={{ justifyContent: "flex-start" }}>
              <Link href={counselling} className="btn btn-primary btn-lg">
                Book free counselling
              </Link>
              <Link
                href="/study-abroad-consultants"
                className="btn btn-ghost btn-lg"
              >
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
              Every cost, intake, language and work figure above is taken from{" "}
              {country.name}’s published profile in the Universta catalogue
              {verifiedAt ? `, last verified ${formatDate(verifiedAt)}` : ""}.
              Nothing on this page is estimated or averaged: where a figure is
              not published, the row is simply absent.
            </p>
            <p>
              They describe the destination, not your application. Tuition
              varies by university and programme, intake windows and deadlines
              are set per course, and visa rules change. Information is
              editorial and may vary — confirm the detail that decides your
              choice against the published sources shown above and the
              university’s own listing before you apply.
            </p>
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <div className="wrap" style={{ padding: "48px 24px 72px" }}>
        <section className="cta-soft">
          <h2>Ready to plan your move to {country.name}?</h2>
          <p>
            Shortlist courses, compare universities and check the intake
            calendar — then talk it through with a counsellor before you apply.
          </p>
          <div className="cta2-btns">
            <Link
              href={`/courses?country=${country.slug}`}
              className="btn btn-primary btn-lg"
            >
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
