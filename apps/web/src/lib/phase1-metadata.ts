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
};

export function phaseOneMetadata(
  record: PhaseOneMetadataRecord,
  canonical: string,
  fallbackLabel: string,
): Metadata {
  const title = record.name ?? record.title ?? fallbackLabel;
  const description =
    record.shortDescription ??
    record.summary ??
    record.description ??
    record.overview ??
    record.journey ??
    record.quote ??
    `Published information about ${title}.`;

  return {
    title: `${title} | Universta`,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: canonical },
  };
}
