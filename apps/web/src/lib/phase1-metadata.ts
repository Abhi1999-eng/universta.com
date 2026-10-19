import type { Metadata } from "next";
import type { ContentVariableContext } from "../../../../packages/content-variables";
import { plainExcerpt } from "./record-text";
import { resolvedMetadata, writtenSeo, type ResolvedSeo } from "./seo-management";

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

/** The record's own fields a description can be taken from, in order. */
const OWN_TEXT = ["shortDescription", "summary", "description", "overview", "journey", "quote"] as const;

/**
 * What an editor wrote, and nothing the resolver made up.
 *
 * The API fills every SEO gap with a fallback -- for a story, an event or a
 * role that was the site's one generic description -- and marks where each
 * value came from in `seo.source`. Only `manual` and `bulk` values are kept,
 * so the record's own summary can take the generic one's place. A stored row
 * sent without a `source` (a consultant location's) is the editor's own and
 * is kept whole.
 */
function editorSeo(seo: ResolvedSeo | null | undefined): ResolvedSeo | null {
  if (!seo) return null;
  return seo.source ? writtenSeo(seo) : seo;
}

export function phaseOneMetadata(
  record: PhaseOneMetadataRecord,
  canonical: string,
  fallbackLabel: string,
  /** The record type's content variables, so a summary's `{eventTitle}` is
   *  filled in rather than printed in a search result. */
  variables?: ContentVariableContext,
): Metadata {
  const title = record.name ?? record.title ?? fallbackLabel;
  const source = record as Record<string, unknown>;
  const own = OWN_TEXT.reduce<string | null>(
    (found, key) => found ?? plainExcerpt(source[key], 155, variables, source),
    null,
  );
  const fallbackDescription = own ?? `Published information about ${title}.`;
  return resolvedMetadata(editorSeo(record.seo), title, fallbackDescription, canonical);
}
