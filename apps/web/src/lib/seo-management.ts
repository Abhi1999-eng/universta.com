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
  source?: { title?: string; description?: string };
};

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
