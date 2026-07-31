/** Editorial framing for a code-composed listing route.
 *
 * A listing page's rows always come from the real entity records -- that is the
 * whole point of a listing, and nothing here touches them. What an admin can
 * change is the framing around those rows: the hero heading and intro, and the
 * closing CTA band.
 *
 * The Page record that supplies this is a content record, not a route. Nothing
 * resolves a URL by page slug, so registering `universities-listing` adds no
 * public URL: `/universities` remains the one and only listing route.
 *
 * Every field is optional. When the managed Page is absent, empty, or the API
 * is down, the route keeps its built-in copy, so registration can never leave a
 * listing page blank. */

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export type ListingPageContent = {
  heading?: string;
  lede?: string;
  ctaHeading?: string;
  ctaBody?: string;
};

type Section = {
  sectionKey?: string;
  sectionType?: string;
  heading?: string | null;
  subheading?: string | null;
  status?: string | null;
};

type PageRecord = {
  title?: string | null;
  shortDescription?: string | null;
  sections?: Section[] | null;
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function getListingPageContent(
  slug: string,
): Promise<ListingPageContent> {
  try {
    const response = await fetch(
      new URL(`/api/v1/phase1/pages/${encodeURIComponent(slug)}`, baseUrl),
      { cache: "no-store", headers: { accept: "application/json" } },
    );
    if (!response.ok) return {};
    const body = (await response.json()) as { data: PageRecord | null };
    const page = body.data;
    if (!page) return {};

    // Keyed on the structured "Block type" the admin picks in the Builder, not
    // on a magic section key. Requiring someone to type `hero` into a slug
    // field to make their heading appear would be exactly the hidden contract
    // this system exists to remove.
    //
    // The first section falls back to the hero slot regardless of type, so an
    // admin who adds one block and writes a heading sees it without having to
    // learn which type unlocks which slot.
    const sections = (page.sections ?? []).filter(
      (section) => (section.status ?? "ACTIVE").toUpperCase() === "ACTIVE",
    );
    const byType = (type: string) =>
      sections.find(
        (section) => (section.sectionType ?? "").toUpperCase() === type,
      );
    // `stats-pill` is a utility block whose title describes the Builder
    // control, not public hero copy. It can be the first (or only) registered
    // section on listing pages, so never use it as the editorial fallback.
    const hero =
      byType("HERO") ??
      sections.find((section) => section.sectionKey !== "stats-pill");
    const cta = byType("CTA");

    return {
      // The hero section wins over the page's own title, because a listing's
      // Page title is also its label in the Admin selector and an admin
      // renaming it there should not silently retitle the public page.
      heading: text(hero?.heading),
      lede: text(hero?.subheading) ?? text(page.shortDescription),
      ctaHeading: text(cta?.heading),
      ctaBody: text(cta?.subheading),
    };
  } catch {
    // Framing is decoration; a chrome/API outage must not take the listing down.
    return {};
  }
}
