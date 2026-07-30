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
  const seo = await loadStaticPageSeo(key);
  const title = seo?.seoTitle ?? fallbackTitle;
  const description = seo?.metaDescription ?? fallbackDescription;
  const canonical = seo?.canonicalUrl ?? canonicalPath;
  return {
    title: `${title} | Universta`,
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
