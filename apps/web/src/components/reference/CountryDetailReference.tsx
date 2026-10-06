import Link from "next/link";
import type { CountryPage } from "@/lib/countries";
import type { CitySummary } from "@/lib/locations";
import { counsellingHref } from "@/lib/counselling-link";
const monthFormat = new Intl.DateTimeFormat("en", { month: "long" });
const monthName = (value: number) =>
  monthFormat.format(new Date(2020, value - 1, 1));
import { formatDate, formatNumber } from "@/lib/format";
import { RichText, richTextToPlainText } from "../phase1/RichText";
import { CountryFlagMark } from "./CountryFlagMark";
import { Disclosure } from "./Disclosure";

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

/** Section bodies are stored as free-form JSON, so every field read out of one
 * is whatever the author's editor put there. */
function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

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

/** How much of a card's description is shown before it offers the rest.
 *
 * One number for every card grid on the page, because equal collapsed height is
 * what keeps a row aligned, and a row cannot be aligned if each section picks
 * its own preview depth. The card's own floor in CSS is sized against this. */
const CARD_PREVIEW = 120;

/**
 * How many columns a grid of `count` cards should use.
 *
 * A fixed four-column desktop rule leaves whatever does not divide by four
 * stranded: six campus-life cards render as four and then two, with half a row
 * of empty space beside them. Choosing a column count that divides the cards
 * evenly is what makes a section look arranged rather than left over -- six
 * become three and three, nine become three rows of three.
 *
 * Four is still the ceiling: beyond that the cards are too narrow to hold a
 * title and a preview.
 */
export function columnsForCount(count: number): number {
  if (count <= 4) return Math.max(count, 1);
  if (count % 4 === 0) return 4;
  if (count % 3 === 0) return 3;
  if (count === 5) return 3;
  return 4;
}

/** Splits the steps into rows so the journey can turn back on itself. */
function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    rows.push(items.slice(index, index + size));
  return rows;
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
  /* The Country's own twelve-month selection is the single source for intakes.
   * The intake module's per-country rows are still written by importers and
   * still serve Courses and Universities, but the Country editor offers one
   * intake control and this page reads exactly that. */
  const intakeMonths = [...(country.configuration?.intakeMonths ?? [])].sort(
    (a, b) => a - b,
  );
  const documents = country.documents ?? [];
  /* The tests the editor ticked. Labels come from the taxonomy the API
   * resolves, so this prints "IELTS · TOEFL" rather than the stored codes. */
  const acceptedTests = (country.configuration?.acceptedTests ?? [])
    .map((test) => test.label || test.code)
    .filter(Boolean);
  const profileTuition = range(cost?.tuitionMin, cost?.tuitionMax);
  const tuition =
    profileTuition ??
    (derivedTuition ? formatNumber(derivedTuition.amount) : null);
  const tuitionIsDerived = !profileTuition && Boolean(derivedTuition);
  /* Cost inherits the Country's currency. The cost card stopped carrying its
   * own currency control -- it was a second copy that could disagree with the
   * identity section -- so without this fallback a country whose cost profile
   * predates that change shows amounts with no currency at all. */
  const currencyCode =
    cost?.currencyCode ?? country.currency?.code ?? derivedTuition?.currencyCode;
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

  const intakeLabels = intakeMonths.map(monthName);

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

  /**
   * Why a student would come here.
   *
   * These were built from whatever the profiles happened to carry, which put
   * "3 intakes a year" and "English test waiver available" in a section headed
   * "Why study in India" -- facts, but not reasons, and both are stated again
   * in the panel and the English section that own them. Meanwhile the sixteen
   * features the editor actually ticked for this country reached the payload
   * and were rendered nowhere at all.
   *
   * So the features lead, because they are the authored answer to this exact
   * question, and the profile summaries that genuinely read as reasons -- work
   * rights, a residency pathway -- follow them with their own copy. Nothing
   * about intakes or test scores: those are facts, and they have sections.
   */
  /* A ticked feature is a label and nothing else -- "Low tuition fees",
   * "Residential campuses". Sixteen of those rendered as full cards produced
   * sixteen mostly-empty boxes nineteen rems tall. They are a different shape
   * of content from a work-rights summary, so they get a different, compact
   * treatment, and only the entries that actually carry copy get a card. */
  const featureTiles = (country.configuration?.features ?? []).map(
    (feature) => feature.label || feature.code,
  );

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
      p: work.partTimeSummary ?? "Part-time work is permitted during your studies.",
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

  /* Work guidance that the highlight cards above did not already publish.
   *
   * `partTimeSummary` was rendered only inside the "Work while you study" card,
   * which requires `partTimeAllowed`; `postStudyWorkSummary` only inside the
   * "Post-study work rights" card, which requires the right to exist and a
   * duration to go with it. For a destination where the honest answer to both
   * is no -- and India is one -- the author's own explanation of what the rules
   * actually are was written, saved, served, and then dropped by the very
   * condition it existed to explain.
   *
   * The cards stay as they are: a card headed "Work while you study" is a claim
   * and must not appear where the answer is no. The prose is not a claim, so it
   * moves into the visa section, and only when a card has not already used it. */
  const workProse = [
    !whyCards.some((card) => card.p === work?.partTimeSummary) &&
      work?.partTimeSummary && ["Working during your studies", work.partTimeSummary],
    !whyCards.some((card) => card.p === work?.postStudyWorkSummary) &&
      work?.postStudyWorkSummary && [
        "After you graduate",
        work.postStudyWorkSummary,
      ],
    !whyCards.some((card) => card.p === work?.immigrationPathwaySummary) &&
      work?.immigrationPathwaySummary && [
        "Staying on longer term",
        work.immigrationPathwaySummary,
      ],
  ].filter(Boolean) as Array<[string, string]>;

  /* The section used to be gated on `costRows.length` alone, so a destination
   * whose author wrote the tuition, living-cost and disclaimer guidance but
   * left the numeric ranges empty -- which is the honest thing to do where a
   * range would be invented -- published no cost section at all. Their copy
   * reached this component and was dropped by a condition about a different
   * field. Any authored cost content is enough to earn the section; the table
   * inside it still appears only when there are figures to put in it. */
  const costHasContent = Boolean(
    costRows.length ||
      cost?.tuitionNotes ||
      cost?.livingCostNotes ||
      cost?.disclaimer,
  );

  const languageRows = [
    ["IELTS", language?.ieltsRequirement, language?.ieltsMinScore, language?.ieltsNotes],
    ["TOEFL", language?.toeflRequirement, language?.toeflMinScore, language?.toeflNotes],
    ["PTE", language?.pteRequirement, language?.pteMinScore, language?.pteNotes],
    [
      "Duolingo",
      language?.duolingoRequirement,
      language?.duolingoMinScore,
      language?.duolingoNotes,
    ],
  ].filter(([, requirement]) => Boolean(requirement)) as Array<
    [string, string, string | null | undefined, string | null | undefined]
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
    /* A fact-table cell, not a prose block: flatten the authored markup rather
     * than printing its tags into the cell. */
    work?.proofOfFundsSummary && [
      "Proof of funds",
      richTextToPlainText(work.proofOfFundsSummary),
    ],
  ].filter(Boolean) as Array<[string, string]>;

  /* The four long-form fields in the client contract map to stable section
   * keys. `overview` is rendered separately above, so it is excluded here to
   * avoid showing the same body twice. */
  /**
   * Every long-form section the author published, in the order they ordered
   * them.
   *
   * This used to be a hard-coded list of four keys whose bodies were read as
   * `paragraphs` and nothing else, which quietly threw away most of what the
   * Country editor can produce. The editor offers a free-text section key and
   * six body types; a section filed under any other key, or written as a fact
   * grid, a set of steps, a card grid or a call to action, reached this
   * component in the payload and was dropped without trace. On the destination
   * this was reported against that was five of seven sections.
   *
   * The friendly headings for the conventional keys are kept as fallbacks, so
   * a section whose author left the heading blank still gets the one the page
   * used to give it.
   */
  const sectionFallbackHeading: Record<string, string> = {
    "why-study": `Why study in ${country.name}`,
    "application-steps": "Admission process",
    "cost-of-study": "Cost breakdown",
    "visa-process": "Visa process",
  };
  const sectionItems = (body: Record<string, unknown>) =>
    Array.isArray(body.items)
      ? (body.items as Array<Record<string, unknown>>).map((item) => ({
          /* FACT_GRID writes `label`/`value`; STEPS and CARD_GRID write
           * `title`/`description`, with STEPS adding its own `step`. Reading
           * both names keeps one renderer honest across all three. */
          step: str(item.step),
          title: str(item.title) || str(item.label),
          body: str(item.description) || str(item.value),
        }))
      : [];
  const clientSections = page.sections
    /* `overview` is rendered above as the country's own overview, so showing
     * it again here would print the same body twice. */
    .filter((section) => section.sectionKey !== "overview")
    .map((section) => {
      const body = (section.bodyJson ?? {}) as Record<string, unknown>;
      const paragraphs = Array.isArray(body.paragraphs)
        ? (body.paragraphs as unknown[]).filter(
            (line): line is string => typeof line === "string" && Boolean(line.trim()),
          )
        : [];
      const items = sectionItems(body).filter(
        (item) => item.title.trim() || item.body.trim(),
      );
      /* CTA and MEDIA carry a single block of copy under their own name. */
      const standalone = str(body.supportingText) || str(body.caption);
      if (!paragraphs.length && !items.length && !standalone.trim()) return null;
      return {
        key: section.sectionKey,
        type: section.sectionType,
        heading:
          section.heading?.trim() ||
          sectionFallbackHeading[section.sectionKey] ||
          "",
        eyebrow: section.eyebrow,
        subheading: section.subheading,
        paragraphs,
        items,
        standalone,
        ctaLabel: section.ctaLabel,
        ctaUrl: section.ctaUrl,
      };
    })
    .filter(Boolean) as Array<{
    key: string;
    type: string;
    heading: string;
    eyebrow: string | null;
    subheading: string | null;
    paragraphs: string[];
    items: Array<{ step: string; title: string; body: string }>;
    standalone: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
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

  /**
   * The at-a-glance panel.
   *
   * It used to read only the cost, work, language and intake profiles, so a
   * destination that had not published those showed a card with two rows in it
   * while the identity the editor had filled in -- capital, language, currency,
   * the tests it accepts -- sat unused in the same payload.
   *
   * Every row is built from a value that is actually present, in priority
   * order, and the list is then cut to what a summary card should hold. A row
   * is never invented and never printed empty: a value that is absent produces
   * no entry at all, which is what keeps this honest on a country at any stage
   * of authoring.
   *
   * A false boolean is not an absent one. "Part-time work: Not permitted" is
   * the answer a student needs, and hiding it would leave them to guess -- so
   * the work rows test for a published profile, not for a truthy value. What
   * they must never do is turn a false or missing value into a positive claim.
   */
  const workProfilePublished = Boolean(work);
  const quickFacts = [
    country.capitalCity && ["Capital", country.capitalCity],
    country.officialLanguage && ["Language", country.officialLanguage],
    country.currency?.code && [
      "Currency",
      country.currency.name
        ? `${country.currency.name} (${country.currency.code})`
        : `${country.currency.code}${country.currency.symbol ? ` (${country.currency.symbol})` : ""}`,
    ],
    intakeLabels.length && ["Intakes", intakeLabels.join(" · ")],
    /* Only a published range, and labelled for what it is when the figure is
     * the catalogue's average rather than the country's own. */
    tuition && [
      tuitionIsDerived ? "Average tuition" : "Tuition",
      `${currency}${tuition}${cost?.tuitionPeriod === "PER_YEAR" ? "/yr" : ""}`,
    ],
    living && [
      "Living cost",
      `${currency}${living}${cost?.livingCostPeriod === "PER_MONTH" ? "/mo" : ""}`,
    ],
    ielts && ["IELTS", ielts],
    workProfilePublished &&
      typeof work?.partTimeAllowed === "boolean" && [
        "Part-time work",
        work.partTimeAllowed
          ? work.partTimeHoursPerWeek
            ? `${work.partTimeHoursPerWeek} hours a week`
            : "Permitted"
          : "Not permitted",
      ],
    workProfilePublished &&
      typeof work?.postStudyWorkAvailable === "boolean" && [
        "Post-study work",
        work.postStudyWorkAvailable
          ? (postStudyWork ?? "Available")
          : "Not available",
      ],
    pathway && ["PR pathway", pathway],
    /* Below the work rows on purpose: this largely restates the IELTS line
     * above, so it earns a place only on a country with room to spare. */
    acceptedTests.length && ["English tests", acceptedTests.join(" · ")],
    statistics?.internationalStudentsCount && [
      "International students",
      formatNumber(statistics.internationalStudentsCount),
    ],
    derivedUniversityCount && [
      "Universities",
      formatNumber(derivedUniversityCount),
    ],
  ].filter(Boolean) as Array<[string, string]>;

  /* A summary, not a table. What does not fit is on the page below in full. */
  const shownQuickFacts = quickFacts.slice(0, 8);
  const hasQuickFacts = shownQuickFacts.length > 0;

  /* The Country source-verification workflow has been withdrawn: the editor no
   * longer asks for a source reference or a verification date, so a "verified
   * <date>" line here could only ever report whatever a legacy row happened to
   * carry -- stale on most countries and absent on every new one. The columns
   * remain and are still stored; they are simply not presented. */

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
    (whyCards.length || featureTiles.length) && ["why", `Why ${country.name}`],
    universitySectionAvailable && ["unis", "Universities"],
    subjects.length && ["subjects", "Subjects"],
    intakeLabels.length && ["intakes", "Intakes"],
    documents.length && ["documents", "Documents"],
    costHasContent && ["cost", "Cost"],
    scholarships.length && ["scholarships", "Scholarships"],
    languageRows.length && ["language", "English"],
    (work?.visaInformation || visaFacts.length || workProse.length) && [
      "visa",
      "Work and visa",
    ],
    cities.length && ["cities", "Cities"],
    statRows.length && ["statistics", "By the numbers"],
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
            <CountryFlagMark flag={country.flag} name={country.name} />
          </span>
          {/* A country can be published before its heading is written; the
            * name is what the page is about either way. */}
          <h1>{country.pageHeading?.trim() || country.name}</h1>
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
          {country.shortDescription ? (
            <Disclosure
              value={country.shortDescription}
              collapsedHeight={150}
              describes={`the introduction to ${country.name}`}
            />
          ) : null}
          <div className="hero-btns">
            <Link href={counselling} className="btn btn-primary btn-lg">
              Get free counselling
            </Link>
            {/* A count of courses opens the finder's course guides, which
                list that many. */}
            <Link
              href={`/courses?country=${country.slug}${props.courseTotal ? "&view=guides" : ""}`}
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
            <p className="qf-note">Published figures</p>
            {shownQuickFacts.map(([label, value]) => (
              <div className="qf-row" key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
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
            <Disclosure
              value={overviewBody}
              collapsedHeight={320}
              describes={`the overview of ${country.name}`}
            />
          </div>
        </section>
      ) : null}

      {/* WHY */}
      {whyCards.length || featureTiles.length ? (
        <section className="sec" id="why">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">The case for {country.name}</span>
              <h2>Why study in {country.name}</h2>
              <p>
                Every point below is something an editor recorded for{" "}
                {country.name}, not an editorial claim.
              </p>
            </div>
            {featureTiles.length ? (
              <ul className="cdx-tiles" data-testid="country-feature-tiles">
                {featureTiles.map((label) => (
                  <li className="cdx-tile" key={label}>
                    <span className="cdx-tile-mark" aria-hidden="true" />
                    <span className="cdx-tile-label">{label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {/* Only the entries that carry copy. These collapse like every
              * other card on the page, and the row stays level. */}
            {whyCards.length ? (
              <div
                className="cdx-grid"
                data-cols={columnsForCount(whyCards.length)}
                data-testid="country-why-cards"
              >
                {whyCards.map((card) => (
                  <article className="cdx-card" key={card.h}>
                    <h3>{card.h}</h3>
                    <Disclosure
                      value={card.p}
                      collapsedHeight={CARD_PREVIEW}
                      describes={card.h}
                    />
                    {card.stat ? <span className="stat">{card.stat}</span> : null}
                  </article>
                ))}
              </div>
            ) : null}
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

      {/* DOCUMENTS */}
      {documents.length ? (
        <section className="sec" id="documents">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Admissions</span>
              <h2>Documents required to study in {country.name}</h2>
              <p>What to have ready before you apply.</p>
            </div>
            {/* Fourteen documents, each with a few hundred words of guidance,
              * were rendering as one continuous column of prose that had to be
              * scrolled past to reach the rest of the page. A reader wants to
              * see what is on the list first and read about one item second. */}
            <div className="cdx-grid" data-cols={columnsForCount(documents.length)}>
              {documents.map((doc) => (
                <article className="cdx-card" key={doc.id}>
                  <span
                    className={`cdx-chip${doc.isRequired ? " is-required" : ""}`}
                  >
                    {doc.isRequired ? "Required" : "Optional"}
                  </span>
                  <h3>{doc.name}</h3>
                  {doc.details ? (
                    <Disclosure
                      value={doc.details}
                      collapsedHeight={CARD_PREVIEW}
                      describes={doc.name}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* INTAKES */}
      {intakeLabels.length ? (
        <section className="sec sec-alt" id="intakes">
          {/* Two or four month names cannot fill a page-width row on their
            * own, so the section stops trying: the explanation takes the left
            * column and the months sit in a panel beside it, which reads as a
            * designed pair rather than a line of chips against empty space. */}
          <div className="wrap cdx-split">
            <div className="head">
              <span className="eyebrow">Timing</span>
              <h2>Intakes in {country.name}</h2>
              <p>
                The months {country.name} opens for entry.{" "}
                {intakeLabels.length > 1
                  ? `More than one intake a year means a missed deadline costs months rather than a full year.`
                  : `Applications are built around this single entry point, so the deadlines matter.`}
              </p>
            </div>
            <div className="cdx-panel">
              <span className="cdx-panel-label">
                {intakeLabels.length} intake
                {intakeLabels.length === 1 ? "" : "s"} a year
              </span>
              <ul className="cdx-chips">
                {intakeLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {/* COST */}
      {costHasContent ? (
        <section className="sec" id="cost">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Budget</span>
              <h2>Cost of studying in {country.name}</h2>
              {costRows.length ? (
                <p>
                  Published ranges for international students, in{" "}
                  {cost?.currencyCode ?? "local currency"}.
                </p>
              ) : null}
            </div>
            {costRows.length ? (
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
            ) : null}
            {/* Each note is its own field describing a different row of the
              * table above. `??` between them meant a country that filled in
              * tuition notes could never show its living-cost notes. */}
            {cost?.tuitionNotes ? (
              <RichText className="disclaimer" value={cost.tuitionNotes} />
            ) : null}
            {cost?.livingCostNotes ? (
              <RichText className="disclaimer" value={cost.livingCostNotes} />
            ) : null}
            {cost?.disclaimer ? (
              <RichText className="disclaimer" value={cost.disclaimer} />
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
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Admissions</span>
              <h2>Language requirements for {country.name}</h2>
              {/* The general note runs to several paragraphs, and it was the
                * first thing between the heading and the answer a reader came
                * for. It opens, and continues if they want it. */}
              {language?.generalNotes ? (
                <Disclosure
                  value={language.generalNotes}
                  collapsedHeight={CARD_PREVIEW}
                  describes="the English requirement"
                />
              ) : null}
            </div>
            {/* One card per test rather than a four-row pseudo-table whose
              * notes column wrapped into a wall. */}
            <div className="cdx-grid" data-cols={columnsForCount(languageRows.length)}>
              {languageRows.map(([test, requirement, score, notes]) => (
                <article className="cdx-card" key={test}>
                  <span className="cdx-chip">
                    {humanise(requirement)}
                    {score ? ` · ${score}` : ""}
                  </span>
                  <h3>{test}</h3>
                  {notes ? (
                    <Disclosure
                      value={notes}
                      collapsedHeight={CARD_PREVIEW}
                      describes={`the ${test} note`}
                    />
                  ) : null}
                </article>
              ))}
            </div>
            {language?.languageWaiverAvailable ? (
              <div className="cdx-callout">
                <h3>An English test waiver is available</h3>
                {language.waiverNotes ? (
                  <Disclosure
                    value={language.waiverNotes}
                    collapsedHeight={CARD_PREVIEW}
                    describes="the waiver note"
                  />
                ) : (
                  <p>A waiver is available for some applicants.</p>
                )}
              </div>
            ) : null}
            {language?.disclaimer ? (
              <RichText className="disclaimer" value={language.disclaimer} />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* VISA */}
      {work?.visaInformation || visaFacts.length || workProse.length ? (
        <section className="sec sec-alt" id="visa">
          <div className="wrap narrow">
            <div className="head">
              <span className="eyebrow">Student visa</span>
              <h2>Work and visa pathways in {country.name}</h2>
              {work?.visaInformation ? (
                <Disclosure
                  value={work.visaInformation}
                  collapsedHeight={220}
                  describes="the visa process"
                />
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
            {workProse.map(([heading, body]) => (
              <div className="prose" key={heading}>
                <h3>{heading}</h3>
                <Disclosure
                  value={body}
                  collapsedHeight={200}
                  describes={heading}
                />
              </div>
            ))}
            <p className="disclaimer">
              Immigration rules change frequently. Always confirm current
              requirements with the official government source before applying.
            </p>
            {work?.disclaimer ? (
              <RichText className="disclaimer" value={work.disclaimer} />
            ) : null}
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
            {/* Text first. A city guide carries a short description and a
              * region, and most have no photograph -- the old card gave a
              * third of its height to a flat blue panel standing in for one,
              * then printed the description's `<p>` tags as literal text. */}
            <div className="cities" data-cols={columnsForCount(cities.length)}>
              {cities.map((city) => {
                // Stored as authored rich text. A card shows the words, not the
                // markup; the city's own page renders the rich version.
                const summary = city.shortDescription
                  ? richTextToPlainText(city.shortDescription)
                  : "";
                return (
                  <Link
                    className="city"
                    key={city.id}
                    // A city guide lives under its destination; `/cities/<slug>`
                    // is not a route the site serves, so every one of these
                    // links was a 404.
                    href={`/study-in/${country.slug}/${city.slug}`}
                  >
                    {city.heroMedia?.url ? (
                      <span
                        className="city-img"
                        style={{ backgroundImage: `url(${city.heroMedia.url})` }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="city-b">
                      <span className="city-name">{city.name}</span>
                      {city.state?.name ? (
                        <span className="city-region">{city.state.name}</span>
                      ) : null}
                      {summary ? <span className="city-sum">{summary}</span> : null}
                      <span className="city-go">
                        City guide<span aria-hidden="true"> →</span>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* STATISTICS
        * Counts only. Capital, language and currency used to be repeated here
        * under a second "at a glance" heading, which asked a reader to work out
        * which of two summaries of the same country was the real one. They are
        * in the hero panel; this section is what the catalogue counted. */}
      {statRows.length ? (
        <section className="sec sec-alt" id="statistics">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Published figures</span>
              <h2>{country.name} by the numbers</h2>
              {derivedStatistics ? (
                <p>
                  Calculated from published universities and course offerings in
                  the Universta catalogue.
                </p>
              ) : statistics ? (
                <p>Published figures from {country.name}’s statistics profile.</p>
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
              {section.heading ? <h2>{section.heading}</h2> : null}
              {section.subheading ? (
                <RichText value={section.subheading} />
              ) : null}
            </div>
            {/* An authored section runs to a couple of thousand characters, so
              * it opens and continues on request rather than arriving as a
              * wall. The markup is preserved: only the container collapses. */}
            {section.paragraphs.length ? (
              <Disclosure
                value={section.paragraphs.join("")}
                collapsedHeight={300}
                describes={section.heading || section.key}
              />
            ) : null}
            {/* A fact grid is a two-column table of short pairs; steps and
              * cards are a numbered or unnumbered list of headed blocks. They
              * differ enough in shape to be worth telling apart and not enough
              * to be worth three separate renderers. */}
            {/* Three shapes, three presentations the page already owns: the
              * fact table the cost section uses, the numbered rail the visa
              * steps use, and the card grid the "why" section uses. */}
            {section.items.length
              ? {
                  /* Ten label/value pairs across the full container read as a
                    * spreadsheet with a large empty right-hand side. Two
                    * columns of stacked facts fill the width and let a value
                    * sit under its own label where it belongs. */
                  FACT_GRID: (
                    <dl className="cdx-facts">
                      {section.items.map((item) => (
                        <div className="cdx-fact" key={`${section.key}-${item.title}`}>
                          <dt>{item.title}</dt>
                          <dd>{item.body}</dd>
                        </div>
                      ))}
                    </dl>
                  ),
                  /* A journey, laid out as one. The steps run left to right,
                    * then the next row runs back right to left, so the chain
                    * never jumps the width of the page to restart -- step five
                    * sits directly under step four. Reversing the row visually
                    * rather than in the markup keeps the reading and tab order
                    * in the order the steps are actually taken. */
                  STEPS: (
                    <div className="cdx-chain">
                      {chunk(
                        section.items,
                        columnsForCount(section.items.length),
                      ).map((row, rowIndex) => (
                        <div
                          className="cdx-chain-row"
                          data-reverse={rowIndex % 2 === 1 ? "true" : "false"}
                          key={`${section.key}-row-${rowIndex}`}
                        >
                          {row.map((item, itemIndex) => {
                            const number =
                              rowIndex * columnsForCount(section.items.length) +
                              itemIndex +
                              1;
                            return (
                              <div
                                className="cdx-step"
                                key={`${section.key}-${number}`}
                              >
                                <span className="s-no">
                                  {item.step || String(number)}
                                </span>
                                {item.title ? <h3>{item.title}</h3> : null}
                                {item.body ? (
                                  <Disclosure
                                    value={item.body}
                                    collapsedHeight={CARD_PREVIEW}
                                    describes={item.title || `step ${number}`}
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ),
                }[section.type] ?? (
                  <div
                    className="cdx-grid"
                    data-cols={columnsForCount(section.items.length)}
                  >
                    {section.items.map((item, itemIndex) => (
                      <article
                        className="cdx-card"
                        key={`${section.key}-${itemIndex}`}
                      >
                        {item.title ? <h3>{item.title}</h3> : null}
                        {item.body ? (
                          <Disclosure
                            value={item.body}
                            collapsedHeight={CARD_PREVIEW}
                            describes={item.title || "this card"}
                          />
                        ) : null}
                      </article>
                    ))}
                  </div>
                )
              : null}
            {section.standalone ? (
              <Disclosure
                value={section.standalone}
                collapsedHeight={240}
                describes={section.heading || section.key}
              />
            ) : null}
            {section.ctaLabel && section.ctaUrl ? (
              <p className="sec-cta">
                <Link className="btn btn-primary" href={section.ctaUrl}>
                  {section.ctaLabel}
                </Link>
              </p>
            ) : null}
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
          {/* Guidance cards carried a blurb and then eight hundred words of
            * overview, so two of them filled a screen and the grid lost any
            * shape. The blurb leads, the overview opens on request, and the
            * call to action stays pinned to the bottom edge so the cards line
            * up however long their copy is. */}
          {consultantCards.length ? (
            <div className="cdx-grid" data-cols={columnsForCount(consultantCards.length)}>
              {consultantCards.map((card) => (
                <article className="cdx-card cons" key={card.id}>
                  <div className="cons-top">
                    <span className="fl" aria-hidden="true">
                      {initials(card.title)}
                    </span>
                    <h3>{card.title}</h3>
                  </div>
                  <RichText value={card.shortDescription} />
                  {card.overview ? (
                    <Disclosure
                      value={card.overview}
                      collapsedHeight={CARD_PREVIEW}
                      describes={card.title}
                    />
                  ) : null}
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
              {country.name}’s published profile in the Universta catalogue.
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
