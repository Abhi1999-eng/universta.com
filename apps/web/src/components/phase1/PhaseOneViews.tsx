import Link from "next/link";
import { PhaseOneFooter, PhaseOneHeader, Crumbs } from "./PhaseOneChrome";
import { consultantContactActions } from "@/lib/consultant-contact";
import { RichText } from "./RichText";

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
            Explore currently published Phase 1 information. Filters and details
            are backed by the local catalog API.
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
              {meta?.total ?? rows.length} published {label.toLowerCase()}
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
                      <span>
                        {String(row.verificationStatus).replaceAll("_", " ")}
                      </span>
                    ) : null}
                    {date(row.deadline ?? row.startsAt ?? row.expiryDate) ? (
                      <span>
                        {date(row.deadline ?? row.startsAt ?? row.expiryDate)}
                      </span>
                    ) : null}
                  </div>
                  <h2>{title(row)}</h2>
                  <p>
                    {description(row) ||
                      "Published information will appear here when available."}
                  </p>
                  <div className="catalog-card-facts">
                    {row.institutionType ? (
                      <span>{row.institutionType}</span>
                    ) : null}
                    {row.location ? <span>{row.location}</span> : null}
                    {row.benefitType ? <span>{row.benefitType}</span> : null}
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
          <div className="empty-state">
            <h2>No published records yet</h2>
            <p>
              This directory is connected to the local Admin catalogue. Publish
              a record to display it here.
            </p>
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
  const facts: Array<[string, string | null]> = [
    ["Country", row.country?.name ?? null],
    ["University", row.university?.name ?? null],
    ["Provider", row.provider?.name ?? null],
    ["Campus", row.campus?.name ?? null],
    ["Location", row.location ?? null],
    ["Deadline", date(row.deadline) ?? null],
    ["Event date", date(row.startsAt) ?? null],
    ["Verification", row.verificationStatus ?? null],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const consultantActions =
    resource === "consultants" ? consultantContactActions(row) : null;
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
        <div className="shell detail-hero-grid">
          <div>
            <Link className="back-link" href={path}>
              ← All {label.toLowerCase()}
            </Link>
            <p className="eyebrow">Published information</p>
            <h1>{title(row)}</h1>
            <p className="hero-copy">
              {description(row) || "Structured local Phase 1 information."}
            </p>
            {row.sourceReference ? (
              <p className="source-note">
                Source:{" "}
                <a href={row.sourceReference} target="_blank" rel="noreferrer">
                  Reference
                </a>
              </p>
            ) : null}
            <div className="hero-actions">
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
                <Link
                  className="button"
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
          <div className="hero-card">
            <div className="hero-placeholder">{title(row).slice(0, 1)}</div>
            <span>{label}</span>
            <small>Published local record</small>
          </div>
        </div>
      </section>
      <section className="shell detail-content">
        <div className="detail-main">
          <section className="editorial-section">
            <p className="eyebrow">Overview</p>
            <h2>What to know</h2>
            <RichText value={row.overview ?? row.description ?? row.journey ?? row.quote ?? row.summary ?? "No further overview is published."} />
          </section>
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
                    <strong>{item.intake?.name ?? "Intake"}</strong>
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
        <aside className="facts-panel">
          <p className="eyebrow">At a glance</p>
          <h2>{title(row)}</h2>
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
      </section>
      <PhaseOneFooter />
    </main>
  );
}

export function UniversityDetail({ row }: { row: AnyRecord }) {
  return (
    <main>
      <PhaseOneHeader />
      <Crumbs
        items={[["Home", "/"], ["Universities", "/universities"], [title(row)]]}
      />
      <section className="detail-hero">
        <div className="shell detail-hero-grid">
          <div>
            <Link className="back-link" href="/universities">
              ← All universities
            </Link>
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
          <div className="hero-card">
            <div className="hero-placeholder">{title(row).slice(0, 1)}</div>
            <span>
              {row._count?.offerings ?? row.offerings?.length ?? 0} offerings
            </span>
            <small>{row.institutionType ?? "Institution"}</small>
          </div>
        </div>
      </section>
      <section className="shell detail-content">
        <div className="detail-main">
          <section className="editorial-section">
            <p className="eyebrow">Overview</p>
            <h2>About this university</h2>
            <RichText value={row.overview ?? "No overview is published."} />
          </section>
          <section className="editorial-section">
            <p className="eyebrow">Campuses</p>
            <h2>Locations</h2>
            <div className="editorial-items">
              {row.campuses?.length ? (
                row.campuses.map((campus: AnyRecord) => (
                  <div key={campus.id}>
                    <strong>{campus.name}</strong>
                    <span>
                      {[campus.city, campus.state, campus.address]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                ))
              ) : (
                <p>No campuses are published.</p>
              )}
            </div>
          </section>
          <section className="editorial-section">
            <p className="eyebrow">Available programs</p>
            <h2>University course offerings</h2>
            <div className="editorial-items">
              {row.offerings?.length ? (
                row.offerings.map((offering: AnyRecord) => (
                  <div key={offering.id}>
                    <Link
                      className="text-link"
                      href={`/universities/${slugFor(row)}/courses/${slugFor(offering)}`}
                    >
                      {offering.name}
                    </Link>
                    <span>
                      {offering.genericCourse?.subject?.name ??
                        "Published offering"}
                    </span>
                  </div>
                ))
              ) : (
                <p>No offerings are published.</p>
              )}
            </div>
          </section>
        </div>
        <aside className="facts-panel">
          <p className="eyebrow">Institution facts</p>
          <h2>{row.country?.name ?? "University"}</h2>
          <div className="fact">
            <span>Type</span>
            <strong>{row.institutionType ?? "Not published"}</strong>
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
