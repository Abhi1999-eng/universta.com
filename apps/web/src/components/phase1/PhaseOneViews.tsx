import Link from "next/link";
import { intakeRange } from "@/lib/intake-range";
import { PhaseOneFooter, PhaseOneHeader, Crumbs } from "./PhaseOneChrome";
import { consultantContactActions } from "@/lib/consultant-contact";
import { RichText } from "./RichText";
import { StudentCatalogueActions } from "@/components/student/StudentCatalogueActions";
import {
  resolveContentVariables,
  type ContentVariableContext,
} from "../../../../../packages/content-variables";

type NamedRecord = { name?: string; shortLabel?: string };
type CourseOfferingRecord = { subject?: NamedRecord };

export type AnyRecord = {
  id: string;
  title?: string;
  name?: string;
  quote?: string;
  summary?: string;
  shortDescription?: string;
  description?: string;
  journey?: string;
  slug?: string;
  country?: NamedRecord;
  provider?: NamedRecord;
  university?: NamedRecord;
  campus?: NamedRecord;
  genericCourse?: CourseOfferingRecord;
  verificationStatus?: string;
  institutionType?: string;
  benefitType?: string;
  /* Published on scholarships and shown on the listing card; the detail page
   * shows it too rather than dropping to just the deadline. The currency is
   * already declared further down this type. */
  amount?: string | number | null;
  location?: string;
  deadline?: string | Date | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  expiryDate?: string | Date | null;
  publishedDate?: string | Date | null;
  createdAt?: string | Date | null;
  eventType?: string;
  venue?: string;
  onlineUrl?: string;
  employmentType?: string;
  remoteStatus?: string;
  sourceReference?: string;
  applicationUrl?: string;
  registrationUrl?: string;
  websiteUrl?: string;
  email?: string | null;
  phone?: string | null;
  applicationEmail?: string;
  overview?: string;
  eligibility?: string;
  responsibilities?: string;
  qualifications?: string;
  requirements?: AnyRecord[];
  intakes?: AnyRecord[];
  services?: AnyRecord[];
  speakersJson?: unknown;
  intake?: NamedRecord;
  notes?: string;
  city?: string;
  state?: string | NamedRecord;
  address?: string;
  offerings?: AnyRecord[];
  campuses?: AnyRecord[];
  _count?: { offerings?: number };
  bodyJson?: unknown;
  subheading?: string;
  sections?: AnyRecord[];
  eyebrow?: string;
  heading?: string;
  sectionKey?: string;
  /** Section settings such as per-device visibility (Website Builder). */
  configurationJson?: {
    visibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
  } | null;
  sectionType?: string;
  media?: { publicUrl?: string; url?: string; altText?: string; title?: string } | null;
  ctaPrimaryUrl?: string;
  ctaPrimaryLabel?: string;
  experimentKey?: string;
  experimentVariantKey?: string;
  costProfile?: { currencyCode?: string };
  workProfile?: { postStudyWorkSummary?: string };
  languageRequirements?: { ieltsRequirement?: string };
  tuitionMin?: string | number;
  tuitionMax?: string | number;
  currencyCode?: string;
  studyMode?: string;
  locations?: Array<{ location?: NamedRecord }>;
  countries?: Array<{ country?: NamedRecord }>;
};

export type PageMeta = {
  page: number;
  total: number;
  totalPages: number;
};
const labels: Record<string, string> = {
  universities: "Universities",
  scholarships: "Scholarships",
  consultants: "Study abroad consultants",
  jobs: "Careers",
  events: "Events",
  "success-stories": "Success stories",
  testimonials: "Testimonials",
  cities: "Cities",
};
const paths: Record<string, string> = {
  universities: "/universities",
  scholarships: "/scholarships",
  consultants: "/study-abroad-consultants",
  jobs: "/careers",
  events: "/events",
  "success-stories": "/success-stories",
  testimonials: "/testimonials",
};
const variableContextByResource: Record<string, ContentVariableContext> = {
  universities: "university",
  scholarships: "scholarship",
  consultants: "consultant",
  jobs: "job",
  events: "event",
  "success-stories": "successStory",
};

function title(row: AnyRecord) {
  return row.title ?? row.name ?? row.quote?.slice(0, 80) ?? "Published record";
}
function description(row: AnyRecord) {
  return (
    row.summary ??
    row.shortDescription ??
    row.description ??
    row.journey ??
    row.quote ??
    ""
  );
}
/** The published prose for a record, or null when there is none.
 *
 * Returning a "nothing here" sentence gave every sparse record a full section
 * -- an eyebrow, a 38px heading and one grey line -- so the page looked long
 * without saying anything. Callers now skip the section instead. Copy that
 * merely repeats the hero lede is treated as absent for the same reason. */
function overviewValue(resource: string, row: AnyRecord): string | null {
  const value = row.overview ?? row.description ?? row.journey ?? row.quote ?? row.summary ?? null;
  if (!value || typeof value !== "string" || !value.trim()) return null;
  const lede = description(row);
  if (typeof lede === "string" && lede.trim() === value.trim()) return null;
  return resolveRichTextValue(resource, value, row);
}
function resolveRichTextValue(resource: string, value: string, row: AnyRecord) {
  const context = variableContextByResource[resource];
  return context
    ? resolveContentVariables(context, value, row as Record<string, unknown>)
    : value;
}
/** "10000" with "GBP" becomes "GBP 10,000"; either half missing yields null. */
function money(amount: unknown, currency: unknown) {
  if (amount === null || amount === undefined || amount === "") return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const formatted = new Intl.NumberFormat("en-IN").format(value);
  return currency ? `${String(currency)} ${formatted}` : formatted;
}
/** Turns a stored enum such as PUBLIC_UNIVERSITY into "Public university". */
function humanise(value: unknown) {
  return String(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}
/** Lowercases a label only when it is a plain noun; a label carrying a proper
 * name ("Cities in Canada") keeps its capitals. */
function lowerLabel(label: string) {
  return /\s(?:in|for|at)\s/i.test(label) ? label : label.toLowerCase();
}
function slugFor(row: AnyRecord) {
  return row.slug ?? row.id;
}
function date(value: unknown) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
        new Date(String(value)),
      )
    : null;
}

export function PhaseListing({
  resource,
  rows,
  meta,
  search = true,
  basePath,
  title: customTitle,
  details = !["success-stories", "testimonials"].includes(resource),
}: {
  resource: string;
  rows: AnyRecord[];
  meta?: PageMeta | null;
  search?: boolean;
  basePath?: string;
  title?: string;
  /** Listing-only resources must not expose routes that the product does not implement. */
  details?: boolean;
}) {
  const label = customTitle ?? labels[resource] ?? resource;
  const path = basePath ?? paths[resource] ?? `/${resource}`;
  return (
    <main>
      <PhaseOneHeader />
      <section className="listing-hero">
        <div className="shell">
          <p className="eyebrow">Published directory</p>
          <h1>{label}</h1>
          <p>
            Browse what Universta has published. Every record below is a real
            catalogue entry — nothing here is placeholder content.
          </p>
        </div>
      </section>
      <section
        className="catalog-explorer shell"
        aria-labelledby={`${resource}-heading`}
      >
        {search ? (
          <form className="catalog-toolbar" action={path}>
            <div>
              <label htmlFor={`${resource}-search`}>
                Search {label.toLowerCase()}
              </label>
              <div className="catalog-search">
                <input
                  id={`${resource}-search`}
                  name="q"
                  type="search"
                  placeholder={`Search ${label.toLowerCase()}`}
                />
                <button className="button" type="submit">
                  Search
                </button>
              </div>
            </div>
          </form>
        ) : null}
        <div className="results-heading">
          <div>
            <p className="eyebrow">Results</p>
            <h2 id={`${resource}-heading`}>
              {/* The label carries real names ("Cities in Canada"), so it is
                  not safe to lowercase wholesale. */}
              {meta?.total ?? rows.length} published {lowerLabel(label)}
            </h2>
          </div>
        </div>
        {rows.length ? (
          <div className="catalog-card-grid">
            {rows.map((row) => (
              <article className="catalog-card" key={row.id}>
                <div className="catalog-card-placeholder" aria-hidden="true">
                  {title(row).slice(0, 1)}
                </div>
                <div className="catalog-card-body">
                  <div className="card-badges">
                    {row.country?.name ? <span>{row.country.name}</span> : null}
                    {row.provider?.name ? (
                      <span>{row.provider.name}</span>
                    ) : null}
                    {row.verificationStatus ? (
                      <span>{humanise(row.verificationStatus)}</span>
                    ) : null}
                    {date(row.deadline ?? row.startsAt ?? row.expiryDate) ? (
                      <span>
                        {date(row.deadline ?? row.startsAt ?? row.expiryDate)}
                      </span>
                    ) : null}
                  </div>
                  <h2>{title(row)}</h2>
                  {/* A card with no summary said so in a full sentence, which
                    * reads as a broken record rather than a short one. */}
                  {description(row) ? <p>{description(row)}</p> : null}
                  <div className="catalog-card-facts">
                    {row.institutionType ? (
                      <span>{humanise(row.institutionType)}</span>
                    ) : null}
                    {row.location ? <span>{row.location}</span> : null}
                    {row.benefitType ? <span>{humanise(row.benefitType)}</span> : null}
                  </div>
                  {details ? (
                    <Link className="card-link" href={`${path}/${slugFor(row)}`}>
                      View details <span aria-hidden="true">→</span>
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* An empty directory was a dead end: a full-width card with two lines
           * and nowhere to go. It now offers the same next steps the consultant
           * directory does. */
          <div className="empty-state">
            <h3>Nothing published here yet</h3>
            <p>
              This directory only lists published records. A counsellor can
              talk through your options while it fills up.
            </p>
            <div className="empty-actions">
              <Link
                className="button"
                href={`/counselling?source=general&from=${encodeURIComponent(path)}`}
              >
                Book free counselling
              </Link>
              <Link className="button secondary" href="/countries">
                Browse study destinations
              </Link>
            </div>
          </div>
        )}
        {meta && meta.totalPages > 1 ? (
          <nav className="pagination" aria-label="Pages">
            <span>
              Page {meta.page} of {meta.totalPages}
            </span>
          </nav>
        ) : null}
      </section>
      <PhaseOneFooter />
    </main>
  );
}

export function PhaseDetail({
  resource,
  row,
  parent,
  basePath,
}: {
  resource: string;
  row: AnyRecord;
  parent?: [string, string];
  /** Overrides the resource's default flat path, for nested routes (e.g. a
   * city detail page living under its country's canonical URL). */
  basePath?: string;
}) {
  const label = labels[resource] ?? resource;
  const path = basePath ?? paths[resource] ?? `/${resource}`;
  const facts = ([
    /* The scholarship listing card already showed funding and award type, so
     * a reader who followed the card reached a page with less on it than the
     * card. Both are published fields; they belong here too. */
    ["Funding", money(row.amount, row.currencyCode)],
    ["Award type", row.benefitType ? humanise(row.benefitType) : null],
    ["Country", row.country?.name ?? null],
    ["University", row.university?.name ?? null],
    ["Provider", row.provider?.name ?? null],
    ["Campus", row.campus?.name ?? null],
    ["Location", row.location ?? null],
    ["Deadline", date(row.deadline) ?? null],
    ["Event date", date(row.startsAt) ?? null],
    ["Verification", row.verificationStatus ?? null],
  ] as Array<[string, string | null]>).filter(
    (item): item is [string, string] => Boolean(item[1]),
  );
  const consultantActions =
    resource === "consultants" ? consultantContactActions(row) : null;
  const overview = overviewValue(resource, row);
  /* The hero used to close with a card reading "Scholarships / Published local
   * record" -- the resource's own name and a status, beside the title that
   * already said both. The published facts live in the sidebar instead, and
   * the hero is a single column with nothing competing for the eye. */
  const hasFacts = facts.length > 0 || Boolean(row.applicationEmail);
  /* Suppressing empty prose sections left records whose only content is a
   * deadline with a two-column body: an empty main column beside one small
   * card. When there is no prose to read, the facts move up into the hero --
   * the same panel the consultant profile uses -- so the one thing the record
   * publishes sits beside the title instead of alone under it. */
  const hasBody = Boolean(
    overview ||
      (resource === "scholarships" && row.eligibility) ||
      (resource === "jobs" && (row.responsibilities || row.qualifications)) ||
      row.requirements?.length ||
      row.intakes?.length ||
      row.services?.length ||
      row.speakersJson,
  );
  const factRows: Array<[string, string]> = [
    ...facts,
    ...(row.applicationEmail
      ? ([["Apply by email", String(row.applicationEmail)]] as Array<[string, string]>)
      : []),
  ];
  const heroPanel = !hasBody && factRows.length > 0;
  return (
    <main>
      <PhaseOneHeader />
      <Crumbs
        items={[
          ["Home", "/"],
          [label, path],
          ...(parent ? [parent] : []),
          [title(row)],
        ]}
      />
      <section className="detail-hero">
        <div className={`shell detail-hero-grid${heroPanel ? "" : " detail-hero-solo"}`}>
          <div>
            {/* No "← All scholarships" link here: the breadcrumb above already
              * names the parent and links to it, and two back affordances
              * stacked on top of each other read as an unfinished page. */}
            <p className="eyebrow">Published information</p>
            <h1>{title(row)}</h1>
            <p className="hero-copy">
              {description(row) || "Published record."}
            </p>
            {row.sourceReference ? (
              <p className="source-note">
                Source:{" "}
                <a href={row.sourceReference} target="_blank" rel="noreferrer">
                  Reference
                </a>
              </p>
            ) : null}
            {/* One row for every call to action. Save/Apply previously rendered
              * in their own block above this one, which split the hero into two
              * disconnected button groups. */}
            <div className="hero-actions">
              {resource === "scholarships" ? (
                <StudentCatalogueActions kind="scholarships" entityId={row.id} scholarshipId={row.id} />
              ) : null}
              {consultantActions ? (
                consultantActions.map((action) => (
                  <a
                    className={action.primary ? "button" : "button secondary"}
                    href={action.href}
                    key={action.label}
                  >
                    {action.label}
                  </a>
                ))
              ) : (
                /* One primary per hero. A scholarship already offers "Apply
                 * with Universta" as its main action, so counselling steps down
                 * to secondary there; on records with no action of their own it
                 * remains the primary. */
                <Link
                  className={resource === "scholarships" ? "button secondary" : "button"}
                  href={`/counselling?source=general&from=${encodeURIComponent(path)}`}
                >
                  Talk to a counsellor
                </Link>
              )}
              {resource !== "consultants" &&
              (row.applicationUrl || row.registrationUrl || row.websiteUrl) ? (
                <a
                  className="button secondary"
                  href={
                    row.applicationUrl ?? row.registrationUrl ?? row.websiteUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Open official link
                </a>
              ) : null}
            </div>
          </div>
          {heroPanel ? (
            <aside className="pd-panel detail-hero-panel">
              <h2>At a glance</h2>
              <dl className="pd-rows">
                {factRows.map(([key, value]) => (
                  <div className="pd-row" key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          ) : null}
        </div>
      </section>
      {hasBody ? (
      <section className={`shell detail-content${hasFacts ? "" : " detail-content-solo"}`}>
        <div className="detail-main">
          {overview ? (
            <section className="editorial-section">
              <p className="eyebrow">Overview</p>
              <h2>What to know</h2>
              <RichText value={overview} />
            </section>
          ) : null}
          {resource === "scholarships" && row.eligibility ? (
            <section className="editorial-section">
              <p className="eyebrow">Eligibility</p>
              <h2>Who can apply</h2>
              <RichText value={resolveRichTextValue(resource, row.eligibility, row)} />
            </section>
          ) : null}
          {resource === "jobs" && row.responsibilities ? (
            <section className="editorial-section">
              <p className="eyebrow">Role details</p>
              <h2>Responsibilities</h2>
              <RichText value={resolveRichTextValue(resource, row.responsibilities, row)} />
            </section>
          ) : null}
          {resource === "jobs" && row.qualifications ? (
            <section className="editorial-section">
              <p className="eyebrow">Requirements</p>
              <h2>Qualifications</h2>
              <RichText value={resolveRichTextValue(resource, row.qualifications, row)} />
            </section>
          ) : null}
          {row.requirements?.length ? (
            <section className="editorial-section">
              <p className="eyebrow">Entry requirements</p>
              <h2>Requirements</h2>
              <div className="editorial-items">
                {row.requirements.map((item: AnyRecord) => (
                  <div key={item.id}>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {row.intakes?.length ? (
            <section className="editorial-section">
              <p className="eyebrow">Availability</p>
              <h2>Intakes</h2>
              <div className="editorial-items">
                {row.intakes.map((item: AnyRecord) => (
                  <div key={item.id}>
                    <strong>{intakeRange(item.intake ?? {})}</strong>
                    <span>
                      {date(item.deadline) ??
                        item.notes ??
                        "Deadline not published"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {row.services?.length ? (
            <section className="editorial-section">
              <p className="eyebrow">Services</p>
              <h2>Available support</h2>
              <div className="card-facts">
                {row.services.map((item: AnyRecord) => (
                  <span key={item.id}>{item.name}</span>
                ))}
              </div>
            </section>
          ) : null}
          {row.speakersJson ? (
            <section className="editorial-section">
              <p className="eyebrow">Event information</p>
              <h2>Speakers</h2>
              <p>Speaker details are provided in the official event listing.</p>
            </section>
          ) : null}
        </div>
        {/* The panel repeated the h1 as its own heading and rendered even when
          * it had no rows to show. It is now labelled, not titled, and absent
          * when the record publishes no facts. */}
        {hasFacts ? (
          <aside className="facts-panel">
            <h2>At a glance</h2>
            {facts.map(([key, value]) => (
              <div className="fact" key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
            {row.applicationEmail ? (
              <div className="fact">
                <span>Apply by email</span>
                <strong>{row.applicationEmail}</strong>
              </div>
            ) : null}
          </aside>
        ) : null}
      </section>
      ) : null}
      <PhaseOneFooter />
    </main>
  );
}

export function UniversityDetail({ row }: { row: AnyRecord }) {
  const offerings: AnyRecord[] = row.offerings ?? [];
  const campuses: AnyRecord[] = row.campuses ?? [];
  const offeringCount = row._count?.offerings ?? offerings.length ?? 0;
  const overview = typeof row.overview === "string" && row.overview.trim() ? row.overview : null;
  return (
    <main>
      <PhaseOneHeader />
      <Crumbs
        items={[["Home", "/"], ["Universities", "/universities"], [title(row)]]}
      />
      <section className="detail-hero">
        <div className="shell detail-hero-grid detail-hero-solo">
          <div>
            {/* The breadcrumb above links back to Universities. The offering
              * count and institution type moved into the facts panel, which
              * was already showing the same two values. */}
            <p className="eyebrow">
              {row.country?.name ?? "Published university"}
            </p>
            <h1>{title(row)}</h1>
            <p className="hero-copy">
              {row.shortDescription ??
                row.overview ??
                "Published university information."}
            </p>
            <div className="hero-actions">
              <StudentCatalogueActions kind="universities" entityId={row.id} />
              <Link
                className="button"
                href={`/universities/${slugFor(row)}/courses`}
              >
                View university courses
              </Link>
              <Link
                className="button secondary"
                href={`/counselling?source=general&from=/universities/${slugFor(row)}`}
              >
                Talk to a counsellor
              </Link>
              <Link
                className="text-link"
                href={`/universities/${slugFor(row)}/claim`}
              >
                Claim this university
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="shell detail-content">
        <div className="detail-main">
          {/* Three sections that each rendered a "nothing is published" line
            * turned a record with one campus and one course into a page of
            * empty bands. Every block below appears only when it has content,
            * and the campus and course lists use the shared detail primitives
            * rather than two more one-off list styles. */}
          {overview ? (
            <section className="editorial-section">
              <p className="eyebrow">Overview</p>
              <h2>About this university</h2>
              <RichText value={resolveContentVariables("university", overview, row as Record<string, unknown>)} />
            </section>
          ) : null}
          {campuses.length ? (
            <section className="editorial-section">
              <p className="eyebrow">Campuses</p>
              <h2>{campuses.length === 1 ? "Location" : "Locations"}</h2>
              {/* Same card as a course offering, so the two lists on this
                * page read as one system rather than two treatments. */}
              <div className="pd-grid pd-grid-cards">
                {campuses.map((campus: AnyRecord) => (
                  <div className="pd-block" key={campus.id}>
                    <h3>Campus</h3>
                    <strong>{campus.name}</strong>
                    <span className="pd-block-sub">
                      {[campus.city, campus.state, campus.address]
                        .filter(Boolean)
                        .join(", ") || "Published without an address"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {offerings.length ? (
            <section className="editorial-section">
              <p className="eyebrow">Available programs</p>
              <h2>Course offerings</h2>
              <div className="pd-grid pd-grid-cards">
                {offerings.map((offering: AnyRecord) => (
                  <Link
                    className="pd-block pd-block-link"
                    key={offering.id}
                    href={`/universities/${slugFor(row)}/courses/${slugFor(offering)}`}
                  >
                    <h3>
                      {offering.genericCourse?.subject?.name ?? "Published offering"}
                    </h3>
                    <strong>{offering.name}</strong>
                    <span className="pd-more">View offering &rarr;</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {!overview && !campuses.length && !offerings.length ? (
            <section className="editorial-section">
              <p className="eyebrow">Overview</p>
              <h2>About this university</h2>
              <p>
                This institution is published with its name and country only.
                Course offerings and campuses appear here as they are added.
              </p>
            </section>
          ) : null}
        </div>
        <aside className="facts-panel">
          <h2>Institution facts</h2>
          {row.country?.name ? (
            <div className="fact">
              <span>Country</span>
              <strong>{row.country.name}</strong>
            </div>
          ) : null}
          {row.institutionType ? (
            <div className="fact">
              <span>Type</span>
              <strong>{humanise(row.institutionType)}</strong>
            </div>
          ) : null}
          <div className="fact">
            <span>Course offerings</span>
            <strong>{offeringCount}</strong>
          </div>
          {row.sourceReference ? (
            <p className="source-note">
              <a href={row.sourceReference} target="_blank" rel="noreferrer">
                View source
              </a>
            </p>
          ) : null}
        </aside>
      </section>
      <PhaseOneFooter />
    </main>
  );
}
