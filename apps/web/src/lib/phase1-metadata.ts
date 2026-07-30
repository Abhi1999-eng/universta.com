import type { Metadata } from "next";

type PhaseOneMetadataRecord = {
  name?: string;
  title?: string;
  shortDescription?: string;
  summary?: string;
  description?: string;
  overview?: string;
  journey?: string;
  quote?: string;
  seo?: {
    seoTitle?: string;
    metaDescription?: string;
    canonicalUrl?: string | null;
    robotsIndex?: boolean;
    robotsFollow?: boolean;
  } | null;
};

export function phaseOneMetadata(
  record: PhaseOneMetadataRecord,
  canonical: string,
  fallbackLabel: string,
): Metadata {
  const title = record.name ?? record.title ?? fallbackLabel;
  const fallbackDescription =
    record.shortDescription ??
    record.summary ??
    record.description ??
    record.overview ??
    record.journey ??
    record.quote ??
    `Published information about ${title}.`;
  const seo = record.seo;
  const resolvedTitle = seo?.seoTitle ?? title;
  const description = seo?.metaDescription ?? fallbackDescription;
  const resolvedCanonical = seo?.canonicalUrl ?? canonical;

  return {
    title: `${resolvedTitle} | Universta`,
    description,
    alternates: { canonical: resolvedCanonical },
    robots: {
      index: seo?.robotsIndex ?? true,
      follow: seo?.robotsFollow ?? true,
    },
    openGraph: { title: resolvedTitle, description, url: resolvedCanonical },
  };
}
