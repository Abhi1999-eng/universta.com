'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSubSubject,
  createSubject,
  deleteSubSubject,
  deleteSubjectSeo,
  getSubject,
  getSubjectSeo,
  listEditorialMedia,
  listSubSubjects,
  publishSubSubject,
  publishSubject,
  saveSubjectSeo,
  unpublishSubSubject,
  unpublishSubject,
  updateSubSubject,
  updateSubject,
} from './catalog-client';
import type { CatalogMutationError, EditorialMedia, EditorialSeo, SubSubjectRecord, SubjectRecord } from './catalog.types';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';
import { UnifiedEditorActions } from '@/features/shared/UnifiedEditorActions';
import { blankUnifiedSeo, seoPayload, UnifiedSeoFields, type UnifiedSeoDraft } from '@/features/shared/UnifiedSeoFields';

type Intent = 'draft' | 'publish';
type SpecializationDraft = {
  id?: string;
  updatedAt?: string;
  name: string;
  slug: string;
  shortDescription: string;
  overview: string;
  iconMediaId: string;
  listingMediaId: string;
  isFeatured: boolean;
  displayOrder: string;
};

const blankSpecialization = (): SpecializationDraft => ({
  name: '', slug: '', shortDescription: '', overview: '', iconMediaId: '', listingMediaId: '', isFeatured: false, displayOrder: '0',
});
const inputClass = 'mt-2 w-full rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]';
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
const hasSeo = (value: UnifiedSeoDraft) => Boolean(value.seoTitle.trim() || value.metaDescription.trim() || value.canonicalUrl.trim() || value.focusKeyword.trim() || value.ogTitle.trim() || value.ogDescription.trim() || value.ogMediaId || value.twitterTitle.trim() || value.twitterDescription.trim() || value.twitterMediaId);
const seoFromRecord = (record: EditorialSeo | null): UnifiedSeoDraft => record ? {
  seoTitle: record.seoTitle ?? '', metaDescription: record.metaDescription ?? '', canonicalUrl: record.canonicalUrl ?? '', focusKeyword: record.focusKeyword ?? '', ogTitle: record.ogTitle ?? '', ogDescription: record.ogDescription ?? '', ogMediaId: record.ogMediaId ?? '', twitterTitle: record.twitterTitle ?? '', twitterDescription: record.twitterDescription ?? '', twitterMediaId: record.twitterMediaId ?? '', robotsIndex: record.robotsIndex, robotsFollow: record.robotsFollow,
} : blankUnifiedSeo;
const specializationFromRecord = (row: SubSubjectRecord): SpecializationDraft => ({
  id: row.id, updatedAt: row.updatedAt, name: row.name, slug: row.slug, shortDescription: row.shortDescription ?? '', overview: row.overview ?? '', iconMediaId: row.iconMedia?.id ?? '', listingMediaId: row.listingMedia?.id ?? '', isFeatured: row.featured, displayOrder: String(row.displayOrder),
});

export function SubjectForm({ id }: { id?: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<SubjectRecord | null>(null);
  const [existingSeo, setExistingSeo] = useState<EditorialSeo | null>(null);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', shortDescription: '', overview: '', iconMediaId: '', listingMediaId: '', heroMediaId: '', isFeatured: false, displayOrder: '0' });
  const [specializations, setSpecializations] = useState<SpecializationDraft[]>([]);
  const [removedSpecializations, setRemovedSpecializations] = useState<SpecializationDraft[]>([]);
  const [seo, setSeo] = useState<UnifiedSeoDraft>(blankUnifiedSeo);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState<Intent | null>(null);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const mediaResult = await listEditorialMedia({ limit: 50 });
        if (!active) return;
        setMedia(mediaResult.data);
        if (!id) return;
        const [subjectResult, seoResult, subResult] = await Promise.all([
          getSubject(id), getSubjectSeo(id), listSubSubjects(id, { limit: 50 }),
        ]);
        if (!active) return;
        const subject = subjectResult.data;
        setRecord(subject);
        setExistingSeo(seoResult.data);
        setSeo(seoFromRecord(seoResult.data));
        setForm({
          name: subject.name, slug: subject.slug, shortDescription: subject.shortDescription ?? '', overview: subject.overview ?? '', iconMediaId: subject.iconMedia?.id ?? '', listingMediaId: subject.listingMedia?.id ?? '', heroMediaId: subject.heroMedia?.id ?? '', isFeatured: subject.isFeatured, displayOrder: String(subject.displayOrder),
        });
        setSpecializations(subResult.data.map(specializationFromRecord));
      } catch (cause: unknown) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load subject editor');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const status = record?.status ?? 'DRAFT';
  const set = (key: keyof typeof form, value: string | boolean) => { setForm((current) => ({ ...current, [key]: value })); setDirty(true); setIssues([]); };
  const updateSpecialization = (index: number, patch: Partial<SpecializationDraft>) => { setSpecializations((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); setDirty(true); };
  const removeSpecialization = (index: number) => { const row = specializations[index]; if (row?.id) setRemovedSpecializations((current) => [...current, row]); setSpecializations((rows) => rows.filter((_, i) => i !== index)); setDirty(true); };

  const normalizedSpecializations = useMemo(() => specializations.filter((row) => row.id || row.name.trim() || row.slug.trim() || row.shortDescription.trim() || row.overview.trim()), [specializations]);

  function validate(intent: Intent) {
    const next: string[] = [];
    if (!form.name.trim()) next.push('Subject name is required.');
    if (!form.shortDescription.trim()) next.push('Subject short description is required.');
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) next.push('Subject slug must use lowercase letters, numbers and single hyphens.');
    if (!/^\d+$/.test(form.displayOrder) || Number(form.displayOrder) > 999999) next.push('Subject display order must be a whole number from 0 to 999999.');
    normalizedSpecializations.forEach((row, index) => {
      const label = `Specialization ${index + 1}`;
      if (!row.name.trim()) next.push(`${label}: name is required.`);
      if (row.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)) next.push(`${label}: slug format is invalid.`);
      if (intent === 'publish' && !row.shortDescription.trim()) next.push(`${label}: short description is required before publishing.`);
      if (!/^\d+$/.test(row.displayOrder) || Number(row.displayOrder) > 999999) next.push(`${label}: display order must be 0-999999.`);
    });
    if (hasSeo(seo) && (!seo.seoTitle.trim() || !seo.metaDescription.trim())) next.push('SEO title and meta description are both required when SEO is configured.');
    setIssues(next);
    return next.length === 0;
  }

  async function persistSpecializations(subject: SubjectRecord) {
    for (const removed of removedSpecializations) {
      if (removed.id) await deleteSubSubject(subject.id, removed.id, removed.updatedAt);
    }
    const savedRows: SubSubjectRecord[] = [];
    for (const row of normalizedSpecializations) {
      const payload = {
        name: row.name.trim(),
        slug: row.slug.trim() || slugify(row.name),
        shortDescription: row.shortDescription.trim() || undefined,
        overview: row.overview.trim() || undefined,
        iconMediaId: row.iconMediaId || undefined,
        listingMediaId: row.listingMediaId || undefined,
        isFeatured: row.isFeatured,
        displayOrder: Number(row.displayOrder) || 0,
        ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}),
      };
      const result = row.id ? await updateSubSubject(subject.id, row.id, payload) : await createSubSubject(subject.id, payload);
      savedRows.push(result.data);
    }
    setSpecializations(savedRows.map(specializationFromRecord));
    setRemovedSpecializations([]);
    return savedRows;
  }

  async function applyPublication(subject: SubjectRecord, children: SubSubjectRecord[], intent: Intent) {
    if (intent === 'publish') {
      let current = subject.status === 'PUBLISHED' ? subject : (await publishSubject(subject.id, subject.updatedAt)).data;
      for (const child of children) if (child.status !== 'PUBLISHED') await publishSubSubject(current.id, child.id, child.updatedAt);
      return current;
    }
    for (const child of children) if (child.status === 'PUBLISHED') await unpublishSubSubject(subject.id, child.id, child.updatedAt);
    return subject.status === 'PUBLISHED' ? (await unpublishSubject(subject.id, subject.updatedAt)).data : subject;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent: Intent = submitter?.value === 'publish' ? 'publish' : 'draft';
    if (!validate(intent)) return;
    setSaving(true); setSavingIntent(intent); setError('');
    try {
      const payload = {
        name: form.name.trim(), slug: form.slug.trim() || undefined, shortDescription: form.shortDescription.trim(), overview: form.overview.trim() || undefined,
        iconMediaId: form.iconMediaId || undefined, listingMediaId: form.listingMediaId || undefined, heroMediaId: form.heroMediaId || undefined,
        isFeatured: form.isFeatured, displayOrder: Number(form.displayOrder) || 0,
        ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
      };
      const saved = record ? (await updateSubject(record.id, payload)).data : (await createSubject(payload)).data;
      const children = await persistSpecializations(saved);
      if (hasSeo(seo)) {
        const result = await saveSubjectSeo(saved.id, seoPayload(seo));
        setExistingSeo(result.data);
      } else if (existingSeo) {
        await deleteSubjectSeo(saved.id, existingSeo.updatedAt);
        setExistingSeo(null);
      }
      const finalRecord = await applyPublication(saved, children, intent);
      setRecord(finalRecord); setDirty(false);
      if (!id) router.replace(`/subjects/${finalRecord.id}`);
      router.refresh();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(typed.message ?? (cause instanceof Error ? cause.message : 'Unable to save subject'));
    } finally { setSaving(false); setSavingIntent(null); }
  }

  if (loading) return <section className="mx-auto max-w-[980px] rounded-2xl border border-[#E8ECF3] bg-white p-8"><p className="text-sm text-[#667085]">Loading subject editor…</p></section>;

  return (
    <section className="mx-auto max-w-[1040px]" aria-labelledby="subject-form-heading">
      <Link href="/subjects" className="text-sm font-semibold text-[#1657CF]">← Subjects</Link>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Unified subject editor</p><h2 id="subject-form-heading" className="mt-2 text-3xl font-semibold">{record ? 'Edit subject' : 'Create subject'}</h2><p className="mt-2 text-sm text-[#667085]">Basic information, specializations, media and SEO are saved together.</p></div>
        <span className="rounded-full border border-[#D9E0EA] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">{status}</span>
      </div>
      {error ? <p role="alert" className="mt-5 rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}
      {issues.length ? <div role="alert" className="mt-5 rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] p-4 text-sm text-[#B42318]"><p className="font-semibold">Fix these fields before saving:</p><ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}

      <form onSubmit={submit} className="mt-8 space-y-6">
        <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8">
          <legend className="sr-only">Subject information</legend>
          <h3 className="text-xl font-semibold">Subject information</h3>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="text-sm font-semibold"><FieldLabel label="Name" htmlFor="subject-name" required help={commonFieldHelp.name} /><input id="subject-name" className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="text-sm font-semibold"><FieldLabel label="Slug" htmlFor="subject-slug" help={commonFieldHelp.slug} /><input id="subject-slug" className={inputClass} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="Generated from name" /></div>
            <div className="text-sm font-semibold sm:col-span-2"><FieldLabel label="Short description" htmlFor="subject-short" required help={commonFieldHelp.shortDescription} /><textarea id="subject-short" rows={3} className={inputClass} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} /></div>
            <div className="text-sm font-semibold sm:col-span-2"><FieldLabel label="Overview" htmlFor="subject-overview" help={commonFieldHelp.overview} /><textarea id="subject-overview" rows={6} className={inputClass} value={form.overview} onChange={(e) => set('overview', e.target.value)} /></div>
            <MediaPickerDialog label="Icon media" value={form.iconMediaId} media={media} onChange={(value) => set('iconMediaId', value)} />
            <MediaPickerDialog label="Listing media" value={form.listingMediaId} media={media} onChange={(value) => set('listingMediaId', value)} />
            <MediaPickerDialog label="Hero media" value={form.heroMediaId} media={media} onChange={(value) => set('heroMediaId', value)} />
            <div className="text-sm font-semibold"><FieldLabel label="Display order" htmlFor="subject-order" help={commonFieldHelp.displayOrder} /><input id="subject-order" type="number" min="0" max="999999" className={inputClass} value={form.displayOrder} onChange={(e) => set('displayOrder', e.target.value)} /></div>
          </div>
          <label className="mt-5 flex items-center gap-3 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> Featured subject</label>
        </fieldset>

        <fieldset id="editor-specializations" className="rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8">
          <legend className="sr-only">Specializations</legend>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1657CF]">Children</p><h3 className="mt-2 text-xl font-semibold">Specializations</h3><p className="mt-2 text-sm text-[#667085]">Create or edit specializations here. They are persisted only when the Subject is saved.</p></div><button type="button" onClick={() => { setSpecializations((rows) => [...rows, blankSpecialization()]); setDirty(true); }} className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]">+ Add specialization</button></div>
          <div className="mt-6 space-y-5">
            {specializations.length === 0 ? <div className="rounded-xl bg-[#F8FAFC] p-5 text-sm text-[#667085]">No specializations yet. Add one if this Subject needs a sub-field.</div> : specializations.map((row, index) => (
              <div key={row.id ?? `new-${index}`} className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5">
                <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">Specialization {index + 1}</h4><button type="button" onClick={() => removeSpecialization(index)} className="text-sm font-semibold text-[#B42318]">Remove</button></div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="text-sm font-semibold"><FieldLabel label="Name" htmlFor={`spec-name-${index}`} /><input id={`spec-name-${index}`} className={inputClass} value={row.name} onChange={(e) => updateSpecialization(index, { name: e.target.value, slug: row.slug || slugify(e.target.value) })} /></div>
                  <div className="text-sm font-semibold"><FieldLabel label="Slug" htmlFor={`spec-slug-${index}`} /><input id={`spec-slug-${index}`} className={inputClass} value={row.slug} onChange={(e) => updateSpecialization(index, { slug: e.target.value })} /></div>
                  <div className="text-sm font-semibold sm:col-span-2"><FieldLabel label="Short description" htmlFor={`spec-short-${index}`} /><textarea id={`spec-short-${index}`} rows={3} className={inputClass} value={row.shortDescription} onChange={(e) => updateSpecialization(index, { shortDescription: e.target.value })} /></div>
                  <div className="text-sm font-semibold sm:col-span-2"><FieldLabel label="Overview" htmlFor={`spec-overview-${index}`} /><textarea id={`spec-overview-${index}`} rows={4} className={inputClass} value={row.overview} onChange={(e) => updateSpecialization(index, { overview: e.target.value })} /></div>
                  <MediaPickerDialog label="Icon media" value={row.iconMediaId} media={media} onChange={(value) => updateSpecialization(index, { iconMediaId: value })} />
                  <MediaPickerDialog label="Listing media" value={row.listingMediaId} media={media} onChange={(value) => updateSpecialization(index, { listingMediaId: value })} />
                  <div className="text-sm font-semibold"><FieldLabel label="Display order" htmlFor={`spec-order-${index}`} /><input id={`spec-order-${index}`} type="number" min="0" max="999999" className={inputClass} value={row.displayOrder} onChange={(e) => updateSpecialization(index, { displayOrder: e.target.value })} /></div>
                  <label className="flex items-center gap-3 self-end rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={row.isFeatured} onChange={(e) => updateSpecialization(index, { isFeatured: e.target.checked })} /> Featured specialization</label>
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <UnifiedSeoFields value={seo} onChange={(next) => { setSeo(next); setDirty(true); }} media={media} />
        <UnifiedEditorActions cancelHref="/subjects" busy={saving} savingIntent={savingIntent} published={record?.status === 'PUBLISHED'} />
      </form>
    </section>
  );
}
