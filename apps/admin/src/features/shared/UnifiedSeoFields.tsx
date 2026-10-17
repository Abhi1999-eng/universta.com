'use client';

import { MediaPickerDialog } from '@/features/catalog/editorial/MediaPickerDialog';
import type { EditorialMedia, EditorialSeo } from '@/features/catalog/catalog.types';
import { FieldLabel } from './FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';

export type UnifiedSeoDraft = {
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  focusKeyword: string;
  ogTitle: string;
  ogDescription: string;
  ogMediaId: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterMediaId: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
};

export const blankUnifiedSeo: UnifiedSeoDraft = {
  seoTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  focusKeyword: '',
  ogTitle: '',
  ogDescription: '',
  ogMediaId: '',
  twitterTitle: '',
  twitterDescription: '',
  twitterMediaId: '',
  robotsIndex: true,
  robotsFollow: true,
};

const CANONICAL_MESSAGE =
  'Use a site path beginning with / or an absolute HTTP(S) URL.';

export function canonicalInputError(value: string): string | null {
  const canonical = value.trim();
  if (!canonical) return null;
  // The API rejects any interior whitespace outright, and URL parsing would
  // quietly percent-encode it here, so the two layers would disagree.
  if (/\s/.test(canonical)) return CANONICAL_MESSAGE;
  if (/^\/(?!\/)[^\s]*$/.test(canonical)) return null;
  try {
    const url = new URL(canonical);
    if (url.protocol === 'https:' || url.protocol === 'http:') return null;
  } catch {
    // The message below is intentionally actionable without exposing parser
    // implementation details.
  }
  return CANONICAL_MESSAGE;
}

/** Whether anything has been written in the SEO fields. The robots ticks
 * do not count: written text is what makes the title and the description
 * required, and the country editor saves no row without it. */
export function unifiedSeoConfigured(value: UnifiedSeoDraft): boolean {
  return Boolean(
    value.seoTitle.trim() ||
    value.metaDescription.trim() ||
    value.canonicalUrl.trim() ||
    value.focusKeyword.trim() ||
    value.ogTitle.trim() ||
    value.ogDescription.trim() ||
    value.ogMediaId ||
    value.twitterTitle.trim() ||
    value.twitterDescription.trim() ||
    value.twitterMediaId,
  );
}

/** Whether a subject, specialization, course or level page needs an SEO row
 * saved: something written, or a robots tick taken off. The API stores a row with
 * only the robots ticks -- no title or description, which then fall back as
 * if there were no row -- so unticking "Robots index" on its own keeps the
 * page out of search engines. Before, that row was never sent: nothing was
 * stored and the tick came back on reload. */
export function unifiedSeoWanted(value: UnifiedSeoDraft): boolean {
  return unifiedSeoConfigured(value) || !value.robotsIndex || !value.robotsFollow;
}

/** A stored SEO record as the fields show it; no record is the blank form. */
export function seoDraftFromRecord(record: EditorialSeo | null): UnifiedSeoDraft {
  if (!record) return blankUnifiedSeo;
  return {
    seoTitle: record.seoTitle ?? '',
    metaDescription: record.metaDescription ?? '',
    canonicalUrl: record.canonicalUrl ?? '',
    focusKeyword: record.focusKeyword ?? '',
    ogTitle: record.ogTitle ?? '',
    ogDescription: record.ogDescription ?? '',
    ogMediaId: record.ogMediaId ?? '',
    twitterTitle: record.twitterTitle ?? '',
    twitterDescription: record.twitterDescription ?? '',
    twitterMediaId: record.twitterMediaId ?? '',
    robotsIndex: record.robotsIndex,
    robotsFollow: record.robotsFollow,
  };
}

type Props = {
  value: UnifiedSeoDraft;
  onChange: (value: UnifiedSeoDraft) => void;
  media: EditorialMedia[];
  /** A line of its own under the intro, for what applies when the section
   * is left blank on this kind of record. */
  note?: string;
  /** The record the fields belong to, as the required-fields alert names it:
   * "before this subject can be saved". Every editor read "Country" before. */
  noun?: string;
};

const input = 'p-input';

export function UnifiedSeoFields({ value, onChange, media, note, noun = 'Country' }: Props) {
  const set = <K extends keyof UnifiedSeoDraft>(key: K, next: UnifiedSeoDraft[K]) =>
    onChange({ ...value, [key]: next });
  const configured = unifiedSeoConfigured(value);
  const canonicalError = canonicalInputError(value.canonicalUrl);
  const requiredError = configured && (!value.seoTitle.trim() || !value.metaDescription.trim());

  return (
    <fieldset id="editor-seo" className="p-panel">
      <legend className="sr-only">SEO</legend>
      <p className="p-eyebrow">Search & sharing</p>
      <h3 className="p-h3">SEO</h3>
      <p className="p-sub">SEO is part of this record. There is no separate SEO save button.</p>
      {note ? <p className="p-hint mt-2">{note}</p> : null}
      <p className="mt-2 text-xs font-medium text-[#667085]">Leave this whole section blank to use defaults. Once any SEO value is entered, <span className="p-danger">*</span> SEO title and Meta description become required.</p>
      {requiredError ? <p role="alert" className="mt-2 p-danger">SEO title and Meta description are required before this {noun} can be saved.</p> : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="text-sm font-semibold">
          <FieldLabel label="SEO title" htmlFor="seo-title" help={commonFieldHelp.seoTitle} required={configured} />
          <input id="seo-title" required={configured} aria-required={configured} className={input} value={value.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
        </div>
        <div className="text-sm font-semibold">
          <FieldLabel label="Focus keyword" htmlFor="seo-focus" />
          <input id="seo-focus" className={input} value={value.focusKeyword} onChange={(e) => set('focusKeyword', e.target.value)} />
        </div>
        <div className="text-sm font-semibold sm:col-span-2">
          <FieldLabel label="Meta description" htmlFor="seo-description" help={commonFieldHelp.metaDescription} required={configured} />
          <textarea id="seo-description" required={configured} aria-required={configured} rows={3} className={input} value={value.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
        </div>
        <div className="text-sm font-semibold sm:col-span-2">
          <FieldLabel label="Canonical URL" htmlFor="seo-canonical" help={commonFieldHelp.canonicalUrl} />
          <input id="seo-canonical" type="text" inputMode="url" aria-invalid={Boolean(canonicalError)} aria-describedby={canonicalError ? 'seo-canonical-error' : undefined} className={input} value={value.canonicalUrl} onChange={(e) => set('canonicalUrl', e.target.value)} />
          {canonicalError ? <p id="seo-canonical-error" role="alert" className="mt-1 p-danger">{canonicalError}</p> : <p className="mt-1 text-xs font-normal text-[#667085]">Use /countries/example for this site, or an absolute HTTP(S) URL.</p>}
        </div>
        <div className="text-sm font-semibold">
          <FieldLabel label="Open Graph title" htmlFor="seo-og-title" />
          <input id="seo-og-title" className={input} value={value.ogTitle} onChange={(e) => set('ogTitle', e.target.value)} />
        </div>
        <div className="text-sm font-semibold">
          <FieldLabel label="Twitter title" htmlFor="seo-twitter-title" />
          <input id="seo-twitter-title" className={input} value={value.twitterTitle} onChange={(e) => set('twitterTitle', e.target.value)} />
        </div>
        <div className="text-sm font-semibold">
          <FieldLabel label="Open Graph description" htmlFor="seo-og-description" />
          <textarea id="seo-og-description" rows={3} className={input} value={value.ogDescription} onChange={(e) => set('ogDescription', e.target.value)} />
        </div>
        <div className="text-sm font-semibold">
          <FieldLabel label="Twitter description" htmlFor="seo-twitter-description" />
          <textarea id="seo-twitter-description" rows={3} className={input} value={value.twitterDescription} onChange={(e) => set('twitterDescription', e.target.value)} />
        </div>
        <MediaPickerDialog label="Open Graph image" value={value.ogMediaId} media={media} onChange={(next) => set('ogMediaId', next)} />
        <MediaPickerDialog label="Twitter image" value={value.twitterMediaId} media={media} onChange={(next) => set('twitterMediaId', next)} />
      </div>
      <div className="mt-5 flex flex-wrap gap-4">
        <label className="flex items-center gap-3 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold">
          <input type="checkbox" checked={value.robotsIndex} onChange={(e) => set('robotsIndex', e.target.checked)} /> Robots index
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold">
          <input type="checkbox" checked={value.robotsFollow} onChange={(e) => set('robotsFollow', e.target.checked)} /> Robots follow
        </label>
      </div>
    </fieldset>
  );
}

export function seoPayload(value: UnifiedSeoDraft) {
  const optional = (input: string) => (input.trim() ? input.trim() : undefined);
  return {
    /* Left out when blank: a robots-only row has neither (see
       unifiedSeoWanted). Every other save requires both before it is sent. */
    seoTitle: optional(value.seoTitle),
    metaDescription: optional(value.metaDescription),
    canonicalUrl: optional(value.canonicalUrl),
    focusKeyword: optional(value.focusKeyword),
    ogTitle: optional(value.ogTitle),
    ogDescription: optional(value.ogDescription),
    ogMediaId: optional(value.ogMediaId),
    twitterTitle: optional(value.twitterTitle),
    twitterDescription: optional(value.twitterDescription),
    twitterMediaId: optional(value.twitterMediaId),
    robotsIndex: value.robotsIndex,
    robotsFollow: value.robotsFollow,
  };
}
