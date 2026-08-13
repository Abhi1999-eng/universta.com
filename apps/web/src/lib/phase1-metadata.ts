import type { Metadata } from "next";
import { resolvedMetadata, type ResolvedSeo } from "./seo-management";

type PhaseOneMetadataRecord = {
  name?: string;
  title?: string;
  shortDescription?: string;
  summary?: string;
  description?: string;
  overview?: string;
  journey?: string;
  quote?: string;
  seo?: ResolvedSeo | null;
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
  return resolvedMetadata(record.seo, title, fallbackDescription, canonical);
}
