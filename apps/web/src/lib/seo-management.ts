import type { Metadata } from "next";
import { siteOrigin } from "./site-origin";

const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export type ResolvedSeo = {
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogMedia?: {
    url?: string | null;
    publicUrl?: string | null;
    alt?: string | null;
    altText?: string | null;
  } | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterMedia?: {
    url?: string | null;
    publicUrl?: string | null;
    alt?: string | null;
    altText?: string | null;
  } | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  titleSuffix?: string | null;
  /** Where each value came from: an editor's own record (`manual`), a bulk
   *  template (`bulk`), or what the resolver makes up (`fallback`,
   *  `default`). `canonical` is sent by newer APIs only. */
  source?: { title?: string; description?: string; canonical?: string };
};

/**
 * Only what an editor or a bulk template wrote. The resolver fills every
 * gap with its own fallback -- the record's name, the site's description,
 * the page's address -- and a page that can say more for itself than that
 * fallback (a level page's counts, say) should. So a value whose source is
 * not `manual` or `bulk` is dropped, and the page's own takes its place;
 * images, robots and the title suffix pass through as they are.
 */
export function writtenSeo(seo: ResolvedSeo | null | undefined): ResolvedSeo | null {
  if (!seo) return null;
  const own = (source?: string) => source === "manual" || source === "bulk";
  const title = own(seo.source?.title);
  const description = own(seo.source?.description);
  return {
    ...seo,
    seoTitle: title ? seo.seoTitle : undefined,
    ogTitle: title ? seo.ogTitle : null,
    twitterTitle: title ? seo.twitterTitle : null,
    metaDescription: description ? seo.metaDescription : undefined,
    ogDescription: description ? seo.ogDescription : null,
    twitterDescription: description ? seo.twitterDescription : null,
    canonicalUrl: own(seo.source?.canonical) ? seo.canonicalUrl : null,
  };
}

/**
 * A title for a route under the "%s | Universta" template. An editor who
 * typed the site name into an SEO title got it twice ("… | Universta |
 * Universta"); such a title is used as it is instead.
 */
export function templatedTitle(title: string): string | { absolute: string } {
  const trimmed = title.trim();
  return /\|\s*Universta\s*$/i.test(trimmed) ? { absolute: trimmed } : trimmed;
}

export function titleWithSuffix(title: string, seo?: ResolvedSeo | null) {
  const suffix = seo?.titleSuffix;
  if (!suffix)
    return title.endsWith("| Universta") ? title : `${title} | Universta`;
  return title.endsWith(suffix) ? title : `${title} ${suffix}`.trim();
}

/** Stored site paths are portable between environments; metadata must still
 * publish an absolute canonical URL to crawlers. */
export function absoluteCanonical(value: string, origin = siteOrigin) {
  try {
    return new URL(value, origin).toString();
  } catch {
    return new URL("/", origin).toString();
  }
}

export function resolvedMetadata(
  seo: ResolvedSeo | null | undefined,
  fallbackTitle: string,
  fallbackDescription: string,
  canonical: string,
): Metadata {
  const title = seo?.seoTitle ?? fallbackTitle;
  const description = seo?.metaDescription ?? fallbackDescription;
  const resolvedCanonical = absoluteCanonical(seo?.canonicalUrl ?? canonical);
  const image = seo?.ogMedia;
  const imageUrl = image?.url ?? image?.publicUrl;
  const imageAlt = image?.alt ?? image?.altText ?? title;
  const twitterImage = seo?.twitterMedia;
  const twitterImageUrl = twitterImage?.url ?? twitterImage?.publicUrl;
  const twitterImageAlt = twitterImage?.alt ?? twitterImage?.altText ?? title;
  return {
    title: titleWithSuffix(title, seo),
    description,
    alternates: { canonical: resolvedCanonical },
    robots: {
      index: seo?.robotsIndex ?? true,
      follow: seo?.robotsFollow ?? true,
    },
    openGraph: {
      title: seo?.ogTitle ?? title,
      description: seo?.ogDescription ?? description,
      url: resolvedCanonical,
      images: imageUrl ? [{ url: imageUrl, alt: imageAlt }] : undefined,
    },
    /* Without a Twitter block Next.js derives the card from Open Graph, so the
     * dedicated Twitter fields an editor fills in never reached the page. An
     * explicit Twitter value wins; Open Graph, then the page title, fill the
     * gap so a card is still produced when only OG is set. */
    twitter: {
      title: seo?.twitterTitle ?? seo?.ogTitle ?? title,
      description: seo?.twitterDescription ?? seo?.ogDescription ?? description,
      images: twitterImageUrl
        ? [{ url: twitterImageUrl, alt: twitterImageAlt }]
        : imageUrl
          ? [{ url: imageUrl, alt: imageAlt }]
          : undefined,
    },
  };
}

export async function siteVerificationMetadata(): Promise<Metadata> {
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/phase1/seo-management/site-verification`,
      { cache: "no-store" },
    );
    if (!response.ok) return {};
    const body = (await response.json()) as {
      data?: { google?: string | null };
    };
    return body.data?.google
      ? { verification: { google: body.data.google } }
      : {};
  } catch {
    return {};
  }
}
