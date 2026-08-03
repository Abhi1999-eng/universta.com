import type { Metadata } from "next";

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

type StaticSeoRecord = {
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogMedia: { url: string; alt: string | null } | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
} | null;

async function loadStaticPageSeo(key: string): Promise<StaticSeoRecord> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/phase1/static-page-seo/${key}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: StaticSeoRecord };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** ISS-038. The admin's "Default SEO" settings screen's "Default title
 * suffix" field promises a fallback value "used when a page has no SEO of
 * its own", but nothing anywhere ever read it -- every page hardcoded
 * "| Universta" as its title suffix regardless of this setting. Only the
 * title suffix is wired here. `defaultDescription` is left for a future
 * fix: every current caller already supplies its own `fallbackDescription`,
 * so making that parameter optional (to give the global default an actual
 * path to matter) is a wider, separate change than this one. Robots
 * defaults are deliberately left alone too, since callers already pass a
 * route-specific default for good reason (e.g. comparison pages defaulting
 * to noindex), and inserting a global tier between them and the per-page SEO
 * record could silently override that. */
async function loadDefaultSeoSettings(): Promise<{
  defaultTitleSuffix: string;
} | null> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/phase1/settings`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: { seo?: { defaultTitleSuffix?: string } };
    };
    return body.data?.seo
      ? { defaultTitleSuffix: body.data.seo.defaultTitleSuffix ?? "" }
      : null;
  } catch {
    return null;
  }
}

/** For code-defined (not database-record) public routes: Home, listings,
 * FAQ, comparison pages. `defaultRobotsIndex` matches this key's registry
 * default on the backend (comparison pages default to false) so the
 * fallback here never accidentally advertises a comparison page as
 * indexable before an admin has set anything. */
export async function staticPageMetadata(
  key: string,
  fallbackTitle: string,
  fallbackDescription: string,
  canonicalPath: string,
  defaultRobotsIndex = true,
): Promise<Metadata> {
  const [seo, defaults] = await Promise.all([
    loadStaticPageSeo(key),
    loadDefaultSeoSettings(),
  ]);
  const title = seo?.seoTitle ?? fallbackTitle;
  const titleSuffix = defaults?.defaultTitleSuffix?.trim() || "| Universta";
  const description = seo?.metaDescription ?? fallbackDescription;
  const canonical = seo?.canonicalUrl ?? canonicalPath;
  return {
    title: `${title} ${titleSuffix}`,
    description,
    alternates: { canonical },
    robots: {
      index: seo?.robotsIndex ?? defaultRobotsIndex,
      follow: seo?.robotsFollow ?? true,
    },
    openGraph: {
      title: seo?.ogTitle ?? title,
      description: seo?.ogDescription ?? description,
      url: canonical,
      images: seo?.ogMedia ? [{ url: seo.ogMedia.url, alt: seo.ogMedia.alt ?? title }] : undefined,
    },
  };
}
