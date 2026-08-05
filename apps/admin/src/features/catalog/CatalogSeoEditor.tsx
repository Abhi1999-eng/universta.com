'use client';

import { useEffect, useId, useState } from 'react';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import type { EditorialMedia, EditorialSeo } from './catalog.types';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';
import type { FieldHelpContent } from '@/lib/field-help/types';

export type CatalogSeoDraft = { seoTitle: string; metaDescription: string; canonicalUrl: string; focusKeyword: string; ogTitle: string; ogDescription: string; ogMediaId: string; twitterTitle: string; twitterDescription: string; twitterMediaId: string; robotsIndex: boolean; robotsFollow: boolean; schemaJson: string; hreflangJson: string };
export const emptyCatalogSeo: CatalogSeoDraft = { seoTitle: '', metaDescription: '', canonicalUrl: '', focusKeyword: '', ogTitle: '', ogDescription: '', ogMediaId: '', twitterTitle: '', twitterDescription: '', twitterMediaId: '', robotsIndex: true, robotsFollow: true, schemaJson: '', hreflangJson: '' };
export function seoDraft(row: EditorialSeo | null): CatalogSeoDraft { return row ? { seoTitle: row.seoTitle, metaDescription: row.metaDescription, canonicalUrl: row.canonicalUrl ?? '', focusKeyword: row.focusKeyword ?? '', ogTitle: row.ogTitle ?? '', ogDescription: row.ogDescription ?? '', ogMediaId: row.ogMediaId ?? '', twitterTitle: row.twitterTitle ?? '', twitterDescription: row.twitterDescription ?? '', twitterMediaId: row.twitterMediaId ?? '', robotsIndex: row.robotsIndex, robotsFollow: row.robotsFollow, schemaJson: row.schemaJson ? JSON.stringify(row.schemaJson, null, 2) : '', hreflangJson: row.hreflangJson ? JSON.stringify(row.hreflangJson, null, 2) : '' } : emptyCatalogSeo; }

const schemaJsonHelp: FieldHelpContent = {
  purpose: 'Raw structured-data (JSON-LD) markup for this page, for search engines that support it.',
  input: 'A single valid JSON object, or leave blank to use no custom schema.',
  dataType: 'JSON (object)',
  required: 'Optional.',
  format: 'Must parse as a JSON object — not an array or a bare value.',
  example: '{ "@type": "Course", "name": "..." }',
  frontendEffect: 'This value is stored, but no public visual effect is currently verified — confirm the current page template actually renders custom schema before relying on it.',
  caution: 'Invalid JSON blocks saving. Do not paste content you have not validated.',
};
const hreflangJsonHelp: FieldHelpContent = {
  purpose: 'Alternate-language URLs for this page, for search engines that support hreflang.',
  input: 'A single valid JSON object mapping locale codes to URLs, or leave blank.',
  dataType: 'JSON (object)',
  required: 'Optional.',
  format: 'Must parse as a JSON object — not an array or a bare value.',
  example: '{ "en-GB": "https://.../uk/course" }',
  frontendEffect: 'This value is stored, but no public visual effect is currently verified.',
  caution: 'Invalid JSON blocks saving.',
};

export function CatalogSeoEditor({ seo, media, busy, onSave, onDelete, onError }: { seo: EditorialSeo | null; media: EditorialMedia[]; busy?: boolean; onSave: (data: Record<string, unknown>) => Promise<void>; onDelete?: () => void; onError: (message: string) => void }) {
  const [draft, setDraft] = useState<CatalogSeoDraft>(() => seoDraft(seo));
  useEffect(() => { const timer = window.setTimeout(() => setDraft(seoDraft(seo)), 0); return () => window.clearTimeout(timer); }, [seo]);
  async function save() { try { if (!draft.seoTitle.trim() || !draft.metaDescription.trim()) throw new Error('SEO title and meta description are required.'); const parse = (value: string, label: string) => { if (!value.trim()) return undefined; const parsed: unknown = JSON.parse(value); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object.`); return parsed; }; await onSave({ ...draft, schemaJson: parse(draft.schemaJson, 'Schema JSON'), hreflangJson: parse(draft.hreflangJson, 'Hreflang JSON'), ...(seo ? { expectedUpdatedAt: seo.updatedAt } : {}) }); } catch (cause: unknown) { onError(cause instanceof Error ? cause.message : 'Unable to save SEO metadata'); } }
  return (
    <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-6">
      <legend className="sr-only">SEO metadata</legend>
      <h3 className="text-xl font-semibold">SEO metadata and previews</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="SEO title" required value={draft.seoTitle} onChange={(value) => setDraft({ ...draft, seoTitle: value })} help={commonFieldHelp.seoTitle} />
        <Field label="Meta description" required textarea value={draft.metaDescription} onChange={(value) => setDraft({ ...draft, metaDescription: value })} help={commonFieldHelp.metaDescription} />
        <Field label="Canonical URL (HTTPS)" value={draft.canonicalUrl} onChange={(value) => setDraft({ ...draft, canonicalUrl: value })} help={commonFieldHelp.canonicalUrl} />
        <Field label="Focus keyword" value={draft.focusKeyword} onChange={(value) => setDraft({ ...draft, focusKeyword: value })} help={commonFieldHelp.focusKeyword} />
        <Field label="Open Graph title" value={draft.ogTitle} onChange={(value) => setDraft({ ...draft, ogTitle: value })} help={commonFieldHelp.ogTitle} />
        <Field label="Open Graph description" textarea value={draft.ogDescription} onChange={(value) => setDraft({ ...draft, ogDescription: value })} help={commonFieldHelp.ogDescription} />
        <MediaPickerDialog label="Open Graph media" value={draft.ogMediaId} media={media} onChange={(value) => setDraft({ ...draft, ogMediaId: value })} help={commonFieldHelp.ogMedia} />
        <Field label="Twitter title" value={draft.twitterTitle} onChange={(value) => setDraft({ ...draft, twitterTitle: value })} help={commonFieldHelp.twitterTitle} />
        <Field label="Twitter description" textarea value={draft.twitterDescription} onChange={(value) => setDraft({ ...draft, twitterDescription: value })} help={commonFieldHelp.twitterDescription} />
        <MediaPickerDialog
          label="Twitter media"
          value={draft.twitterMediaId}
          media={media}
          onChange={(value) => setDraft({ ...draft, twitterMediaId: value })}
          help={{ ...commonFieldHelp.ogMedia, purpose: 'The image shown when this page is shared on X/Twitter.', frontendEffect: 'X/Twitter share card image.' }}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Schema JSON object" textarea value={draft.schemaJson} onChange={(value) => setDraft({ ...draft, schemaJson: value })} help={schemaJsonHelp} />
        <Field label="Hreflang JSON object" textarea value={draft.hreflangJson} onChange={(value) => setDraft({ ...draft, hreflangJson: value })} help={hreflangJsonHelp} />
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-sm font-semibold">
        <div>
          <input id="seo-robots-index" type="checkbox" checked={draft.robotsIndex} onChange={(event) => setDraft({ ...draft, robotsIndex: event.target.checked })} /> <FieldLabel label="Allow indexing" htmlFor="seo-robots-index" help={commonFieldHelp.robotsIndex} />
        </div>
        <div>
          <input id="seo-robots-follow" type="checkbox" checked={draft.robotsFollow} onChange={(event) => setDraft({ ...draft, robotsFollow: event.target.checked })} /> <FieldLabel label="Allow following" htmlFor="seo-robots-follow" help={commonFieldHelp.robotsFollow} />
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Preview title="SERP preview" titleText={draft.seoTitle} description={draft.metaDescription} />
        <Preview title="Open Graph preview" titleText={draft.ogTitle || draft.seoTitle} description={draft.ogDescription || draft.metaDescription} />
        <Preview title="Twitter preview" titleText={draft.twitterTitle || draft.seoTitle} description={draft.twitterDescription || draft.metaDescription} />
      </div>
      <div className="mt-5 flex gap-3">
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save SEO'}</button>
        {seo && onDelete ? <button type="button" disabled={busy} onClick={onDelete} className="rounded-xl border border-[#B42318] px-4 py-2 text-sm font-semibold text-[#B42318] disabled:opacity-40">Remove SEO</button> : null}
      </div>
    </fieldset>
  );
}

function Field({ label, value, onChange, textarea = false, required = false, help }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean; required?: boolean; help?: FieldHelpContent }) {
  // Explicit id/htmlFor, not a wrapping <label> — FieldLabel's help-icon
  // <button> breaks an implicitly-wrapping label's accessible-name link.
  const fieldId = useId();
  return (
    <div className="block text-sm font-semibold">
      <FieldLabel label={label} htmlFor={fieldId} required={required} help={help} />
      {textarea ? (
        <textarea id={fieldId} required={required} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2 font-normal" />
      ) : (
        <input id={fieldId} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2 font-normal" />
      )}
    </div>
  );
}
function Preview({ title, titleText, description }: { title: string; titleText: string; description: string }) { return <div className="rounded-xl border border-[#E8ECF3] p-3"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#828B9B]">{title}</p><strong className="mt-3 block truncate text-[#1657CF]">{titleText || 'Untitled page'}</strong><p className="mt-2 line-clamp-3 text-xs leading-5 text-[#667085]">{description || 'No description yet.'}</p></div>; }
