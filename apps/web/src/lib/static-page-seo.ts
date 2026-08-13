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
    const response = await fetch(
      `${baseUrl}/api/v1/phase1/static-page-seo/${key}`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: StaticSeoRecord };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** Shared public defaults for code-defined pages. Entity pages resolve the
 * same settings through SeoManagementService; static pages load this small
 * public projection because they have no entity record to send to the API. */
async function loadDefaultSeoSettings(): Promise<{
  defaultTitleSuffix: string;
  defaultDescription: string | null;
  defaultRobotsIndex: boolean;
  defaultRobotsFollow: boolean;
  defaultOgImage: { url: string; alt: string | null } | null;
} | null> {
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/phase1/seo-management/defaults`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      data?: {
        defaultTitleSuffix?: string;
        defaultDescription?: string | null;
        defaultRobotsIndex?: boolean;
        defaultRobotsFollow?: boolean;
        defaultOgImage?: { url: string; alt: string | null } | null;
      };
    };
    return body.data
      ? {
          defaultTitleSuffix: body.data.defaultTitleSuffix ?? "",
          defaultDescription: body.data.defaultDescription ?? null,
          defaultRobotsIndex: body.data.defaultRobotsIndex !== false,
          defaultRobotsFollow: body.data.defaultRobotsFollow !== false,
          defaultOgImage: body.data.defaultOgImage ?? null,
        }
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
  const description =
    seo?.metaDescription ?? defaults?.defaultDescription ?? fallbackDescription;
  const canonical = seo?.canonicalUrl ?? canonicalPath;
  return {
    title: `${title} ${titleSuffix}`,
    description,
    alternates: { canonical },
    robots: {
      // Comparison pages have an explicit route-level noindex rule. Global
      // defaults apply to ordinary indexable static pages but never turn a
      // comparison route indexable merely because no row has been saved.
      index:
        seo?.robotsIndex ??
        (defaultRobotsIndex ? (defaults?.defaultRobotsIndex ?? true) : false),
      follow: seo?.robotsFollow ?? defaults?.defaultRobotsFollow ?? true,
    },
    openGraph: {
      title: seo?.ogTitle ?? title,
      description: seo?.ogDescription ?? description,
      url: canonical,
      images: seo?.ogMedia
        ? [{ url: seo.ogMedia.url, alt: seo.ogMedia.alt ?? title }]
        : defaults?.defaultOgImage
          ? [
              {
                url: defaults.defaultOgImage.url,
                alt: defaults.defaultOgImage.alt ?? title,
              },
            ]
          : undefined,
    },
  };
}
