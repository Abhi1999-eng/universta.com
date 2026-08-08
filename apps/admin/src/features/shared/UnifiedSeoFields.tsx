'use client';

import { MediaPickerDialog } from '@/features/catalog/editorial/MediaPickerDialog';
import type { EditorialMedia } from '@/features/catalog/catalog.types';
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

type Props = {
  value: UnifiedSeoDraft;
  onChange: (value: UnifiedSeoDraft) => void;
  media: EditorialMedia[];
};

const input = 'mt-2 w-full rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]';

export function UnifiedSeoFields({ value, onChange, media }: Props) {
  const set = <K extends keyof UnifiedSeoDraft>(key: K, next: UnifiedSeoDraft[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <fieldset id="editor-seo" className="rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8">
      <legend className="sr-only">SEO</legend>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1657CF]">Search & sharing</p>
      <h3 className="mt-2 text-xl font-semibold text-[#101828]">SEO</h3>
      <p className="mt-2 text-sm leading-6 text-[#667085]">SEO is part of this record. There is no separate SEO save button.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="text-sm font-semibold">
          <FieldLabel label="SEO title" htmlFor="seo-title" help={commonFieldHelp.seoTitle} />
          <input id="seo-title" className={input} value={value.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
        </div>
        <div className="text-sm font-semibold">
          <FieldLabel label="Focus keyword" htmlFor="seo-focus" />
          <input id="seo-focus" className={input} value={value.focusKeyword} onChange={(e) => set('focusKeyword', e.target.value)} />
        </div>
        <div className="text-sm font-semibold sm:col-span-2">
          <FieldLabel label="Meta description" htmlFor="seo-description" help={commonFieldHelp.metaDescription} />
          <textarea id="seo-description" rows={3} className={input} value={value.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} />
        </div>
        <div className="text-sm font-semibold sm:col-span-2">
          <FieldLabel label="Canonical URL" htmlFor="seo-canonical" help={commonFieldHelp.canonicalUrl} />
          <input id="seo-canonical" type="url" className={input} value={value.canonicalUrl} onChange={(e) => set('canonicalUrl', e.target.value)} />
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
    seoTitle: value.seoTitle.trim(),
    metaDescription: value.metaDescription.trim(),
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
