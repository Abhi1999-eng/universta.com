import Link from "next/link";
import { PhaseOneFooter, PhaseOneHeader, Crumbs } from "./PhaseOneChrome";
import type { AnyRecord } from "./PhaseOneViews";
import { ComparisonSelector, type ComparisonOption } from "./ComparisonSelector";

function title(row: AnyRecord) {
  return row.name ?? row.title ?? "Published item";
}
function value(row: AnyRecord, type: string, field: string) {
  if (type === "countries")
    return field === "Costs"
      ? (row.costProfile?.currencyCode ?? "Not published")
      : field === "Intakes"
        ? row.intakes
            ?.map((x: AnyRecord) => x.intake?.shortLabel ?? x.intake?.name)
            .join(", ") || "Not published"
        : field === "Work"
          ? (row.workProfile?.postStudyWorkSummary ?? "Not published")
          : (row.languageRequirements?.ieltsRequirement ?? "Not published");
  if (type === "universities")
    return field === "Country"
      ? (row.country?.name ?? "Not published")
      : field === "Type"
        ? (row.institutionType ?? "Not published")
        : field === "Campuses"
          ? String(row.campuses?.length ?? 0)
          : String(row._count?.offerings ?? 0);
  if (type === "courses")
    return field === "University"
      ? (row.university?.name ?? "Not published")
      : field === "Campus"
        ? (row.campus?.name ?? "Not published")
        : field === "Tuition"
          ? [row.currencyCode, row.tuitionMin, row.tuitionMax]
              .filter(Boolean)
              .join(" ") || "Not published"
          : (row.studyMode ?? "Not published");
  return field === "Locations"
    ? row.locations
        ?.map((x) => x.location?.name)
        .filter(Boolean)
        .join(", ") || "Not published"
    : field === "Services"
      ? row.services?.map((x) => x.name).join(", ") || "Not published"
      : field === "Countries"
        ? row.countries
            ?.map((x) => x.country?.name)
            .filter(Boolean)
            .join(", ") || "Not published"
        : (row.verificationStatus ?? "Not published");
}

function ComparisonReference({ rows }: { rows: AnyRecord[] }) {
  if (!rows.length) return null;
  const sections = [
    ["General information", ["Country", "Type", "Campuses", "Offerings"]],
    ["Academic comparison", ["Country", "Type", "Offerings"]],
    ["Campus & programme availability", ["Campuses", "Offerings"]],
  ] as const;
  return <div className="reference-comparison-sections">
    <header><span>University comparison</span><h2>Compare universities side by side</h2><p>Review the published country, institution, campus and course-offering information in one shareable view.</p></header>
    {sections.map(([heading, fields]) => <section key={heading}><h3>{heading}</h3><div className="reference-comparison-table"><table><thead><tr><th>Details</th>{rows.map((row) => <th key={row.slug}>{title(row)}</th>)}</tr></thead><tbody>{fields.map((field) => <tr key={field}><th>{field}</th>{rows.map((row) => <td key={row.slug}>{value(row, "universities", field)}</td>)}</tr>)}</tbody></table></div></section>)}
    <section className="reference-comparison-next"><h3>Ready to take the next step?</h3><p>Use the published comparison as a starting point, then open an institution or course record to review available details.</p><Link href="/universities">Explore universities</Link></section>
  </div>;
}
export function CompareView({
  type,
  result,
  items,
  options,
}: {
  type: string;
  result: { items: AnyRecord[]; invalid: string[] };
  items: string[];
  options: ComparisonOption[];
}) {
  const fields =
    type === "countries"
      ? ["Costs", "Intakes", "Work", "Language"]
      : type === "universities"
        ? ["Country", "Type", "Campuses", "Offerings"]
        : type === "courses"
          ? ["University", "Campus", "Tuition", "Study mode"]
          : ["Locations", "Services", "Countries", "Verification"];
  return (
    <main className={type === "universities" ? "reference-comparison-page" : undefined}>
      <PhaseOneHeader />
      <Crumbs items={[["Home", "/"], ["Compare"]]} />
      <section className="listing-hero">
        <div className="shell">
          <p className="eyebrow">Shareable comparison</p>
          <h1>{type === "universities" ? "Compare universities side by side" : `Compare ${type}`}</h1>
          <p>
            Select up to three published items using a comma-separated `items`
            URL parameter. Comparison URLs are intentionally noindex.
          </p>
        </div>
      </section>
      <section className="shell phase1-compare">
        <ComparisonSelector type={type} initial={items} options={options} />
        {result.invalid.length ? (
          <p className="phase1-notice">
            Unavailable or unpublished: {result.invalid.join(", ")}
          </p>
        ) : null}
        {result.items.length ? (
          <>
            {type === "universities" ? <ComparisonReference rows={result.items} /> : null}
            <div className="phase1-compare-desktop">
              <table>
                <thead>
                  <tr>
                    <th>Field</th>
                    {result.items.map((row) => (
                      <th key={row.slug}>{title(row)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field}>
                      <th>{field}</th>
                      {result.items.map((row) => (
                        <td key={row.slug}>{value(row, type, field)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="phase1-compare-mobile">
              {result.items.map((row) => (
                <article className="facts-panel" key={row.slug}>
                  <p className="eyebrow">Comparison item</p>
                  <h2>{title(row)}</h2>
                  {fields.map((field) => (
                    <div className="fact" key={field}>
                      <span>{field}</span>
                      <strong>{value(row, type, field)}</strong>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>Select published records to compare</h2>
            <p>
              Use up to three comma-separated slugs. Invalid or unpublished
              records are omitted safely.
            </p>
            <Link className="button secondary" href="/countries">
              Browse countries
            </Link>
          </div>
        )}
      </section>
      <PhaseOneFooter />
    </main>
  );
}
