import Link from "next/link";
import { PhaseOneFooter, PhaseOneHeader, Crumbs } from "./PhaseOneChrome";
import type { AnyRecord } from "./PhaseOneViews";

function body(section: AnyRecord) {
  const data = section.bodyJson;
  if (typeof data === "string") return data;
  if (
    data &&
    typeof data === "object" &&
    "text" in data &&
    typeof data.text === "string"
  )
    return data.text;
  return section.subheading ?? "";
}

export function EditorialPage({
  page,
  fallbackTitle,
  fallbackDescription,
  home = false,
}: {
  page?: AnyRecord | null;
  fallbackTitle: string;
  fallbackDescription: string;
  home?: boolean;
}) {
  const title = page?.title ?? fallbackTitle;
  const description = page?.shortDescription ?? fallbackDescription;
  const sections = page?.sections ?? [];
  return (
    <main>
      <PhaseOneHeader />
      {home ? null : <Crumbs items={[["Home", "/"], [title]]} />}
      <section className="listing-hero">
        <div className="shell">
          <p className="eyebrow">Universta</p>
          <h1>{title}</h1>
          <p>{description}</p>
          {home ? (
            <div className="hero-actions">
              <Link className="button" href="/countries">
                Explore countries
              </Link>
              <Link className="button secondary" href="/counselling">
                Book free counselling
              </Link>
            </div>
          ) : null}
        </div>
      </section>
      <section className="shell phase1-editorial">
        {sections.length ? (
          sections.map((section: AnyRecord) => (
            <article className="editorial-section" key={section.id}>
              <p className="eyebrow">{section.eyebrow ?? "Universta"}</p>
              <h2>{section.heading ?? section.sectionKey}</h2>
              <p>{body(section)}</p>
              {section.ctaPrimaryUrl && section.ctaPrimaryLabel ? (
                <Link className="text-link" href={section.ctaPrimaryUrl}>
                  {section.ctaPrimaryLabel} →
                </Link>
              ) : null}
            </article>
          ))
        ) : (
          <>
            <article className="editorial-section">
              <p className="eyebrow">Local Phase 1</p>
              <h2>Published content will appear here</h2>
              <p>
                This page is managed through the local editorial catalogue. The
                route, metadata and navigation are ready while content is
                prepared.
              </p>
            </article>
            {home ? (
              <div className="catalog-card-grid">
                <Link className="catalog-card" href="/countries">
                  <div className="catalog-card-body">
                    <h2>Countries</h2>
                    <p>Explore published destination information.</p>
                  </div>
                </Link>
                <Link className="catalog-card" href="/subjects">
                  <div className="catalog-card-body">
                    <h2>Subjects</h2>
                    <p>Find a study direction.</p>
                  </div>
                </Link>
                <Link className="catalog-card" href="/courses">
                  <div className="catalog-card-body">
                    <h2>Courses</h2>
                    <p>Browse generic course guides.</p>
                  </div>
                </Link>
                <Link className="catalog-card" href="/universities">
                  <div className="catalog-card-body">
                    <h2>Universities</h2>
                    <p>Browse university-owned offerings.</p>
                  </div>
                </Link>
                <Link className="catalog-card" href="/scholarships">
                  <div className="catalog-card-body">
                    <h2>Scholarships</h2>
                    <p>Review published funding opportunities.</p>
                  </div>
                </Link>
                <Link className="catalog-card" href="/counselling">
                  <div className="catalog-card-body">
                    <h2>Counselling</h2>
                    <p>Talk through your next step.</p>
                  </div>
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>
      <PhaseOneFooter />
    </main>
  );
}
