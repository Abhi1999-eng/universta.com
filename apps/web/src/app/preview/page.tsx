import type { Metadata } from "next";
import { PageSectionRenderer } from "@/components/phase1/PageSectionRenderer";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";

/** Draft preview target for the Admin Website Builder.
 *
 * This route is deliberately unlike every other public route:
 *
 *  - it is never linked from the site, never listed in the sitemap, and
 *    `robots.ts` disallows /preview, so it cannot be crawled into;
 *  - `robots: noindex, nofollow` is set here too, so even a shared URL cannot
 *    be indexed;
 *  - it renders nothing at all without a valid signed token. Draft content is
 *    returned only by the API, only for a token issued to an authenticated
 *    Super Admin, scoped to this exact page, and expiring in 30 minutes.
 *
 * Canonical metadata is deliberately absent: a preview URL must never appear as
 * the canonical of anything. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false, nocache: true },
};

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

/** The preview payload carries fields the public page type does not expose --
 * notably `status`, since a draft page is exactly what preview exists to show. */
type PreviewPage = {
  title?: string | null;
  slug?: string | null;
  shortDescription?: string | null;
  status?: string | null;
  sections?: AnyRecord[] | null;
};

async function loadDraft(slug: string, token: string) {
  const url = new URL("/api/v1/phase1/preview/page", baseUrl);
  url.searchParams.set("slug", slug);
  url.searchParams.set("token", token);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const body = (await response.json()) as {
    data: PreviewPage | null;
    error: { code: string; message: string } | null;
  };
  if (!response.ok || body.error || !body.data)
    return { page: null, message: body.error?.message ?? "This preview could not be loaded." };
  return { page: body.data, message: null };
}

function PreviewNotice({ title, body }: { title: string; body: string }) {
  return (
    <main className="usta-preview-shell">
      <div className="usta-preview-empty" role="alert">
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </main>
  );
}

export default async function PreviewRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const slug = one("slug") ?? "";
  const token = one("token") ?? "";

  if (!slug || !token)
    return (
      <PreviewNotice
        title="Preview link incomplete"
        body="Open the preview from the Website Builder so it can issue a valid preview link."
      />
    );

  const { page, message } = await loadDraft(slug, token);
  if (!page)
    return (
      <PreviewNotice
        title="Preview unavailable"
        body={`${message} Preview links expire after 30 minutes — reopen Preview in the Website Builder to get a fresh one.`}
      />
    );

  const sections = page.sections ?? [];
  const status = String(page.status ?? "").toUpperCase() || "DRAFT";
  // A published page can still hold draft sections, so say which of the two is
  // actually being shown rather than just echoing the page status.
  const draftSections = sections.filter(
    (section) =>
      String((section as { status?: string }).status ?? "").toUpperCase() !== "PUBLISHED",
  ).length;

  return (
    <main className="usta-preview-shell">
      <p className="usta-preview-banner">
        Preview · page is <b>{status}</b>
        {draftSections
          ? ` · including ${draftSections} unpublished section${draftSections === 1 ? "" : "s"}`
          : ""}{" "}
        · not visible to the public
      </p>
      <section className="listing-hero">
        <div className="shell">
          <p className="eyebrow">Preview</p>
          <h1>{String(page.title ?? page.slug ?? "Untitled page")}</h1>
          {page.shortDescription ? <p>{String(page.shortDescription)}</p> : null}
        </div>
      </section>
      <section className="shell phase1-editorial">
        {sections.length ? (
          sections.map((section) => <PageSectionRenderer section={section} key={String(section.id)} />)
        ) : (
          <article className="editorial-section">
            <h2>No sections yet</h2>
            <p>Add a section in the Website Builder and the preview will show it here.</p>
          </article>
        )}
      </section>
    </main>
  );
}
