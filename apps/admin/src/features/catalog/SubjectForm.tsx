'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createSubject,
  deleteSubjectSeo,
  getSubject,
  getSubjectCountries,
  getSubjectSeo,
  listCountries,
  listCourseLevels,
  listEditorialMedia,
  listEvery,
  saveSubjectCountries,
  listAllSubSubjects,
  publishSubSubject,
  publishSubject,
  saveSubjectSeo,
  unpublishSubSubject,
  unpublishSubject,
  updateSubject,
} from './catalog-client';
import type { CountryRecord, EditorialMedia, EditorialSeo, MasterRecord, SubSubjectRecord, SubjectRecord } from './catalog.types';
import { DestinationTicks } from './DestinationTicks';
import { StudyLevelTicks } from './StudyLevelTicks';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';
import { UnifiedEditorActions } from '@/features/shared/UnifiedEditorActions';
import { nextAutoSlug } from '@/lib/slug';
import { blankUnifiedSeo, seoPayload, UnifiedSeoFields, type UnifiedSeoDraft } from '@/features/shared/UnifiedSeoFields';
import { catalogErrorText } from './catalog-errors';

type Intent = 'draft' | 'publish';
const inputClass = 'p-input';
const hasSeo = (value: UnifiedSeoDraft) => Boolean(value.seoTitle.trim() || value.metaDescription.trim() || value.canonicalUrl.trim() || value.focusKeyword.trim() || value.ogTitle.trim() || value.ogDescription.trim() || value.ogMediaId || value.twitterTitle.trim() || value.twitterDescription.trim() || value.twitterMediaId);
const seoFromRecord = (record: EditorialSeo | null): UnifiedSeoDraft => record ? {
  seoTitle: record.seoTitle ?? '', metaDescription: record.metaDescription ?? '', canonicalUrl: record.canonicalUrl ?? '', focusKeyword: record.focusKeyword ?? '', ogTitle: record.ogTitle ?? '', ogDescription: record.ogDescription ?? '', ogMediaId: record.ogMediaId ?? '', twitterTitle: record.twitterTitle ?? '', twitterDescription: record.twitterDescription ?? '', twitterMediaId: record.twitterMediaId ?? '', robotsIndex: record.robotsIndex, robotsFollow: record.robotsFollow,
} : blankUnifiedSeo;
export function SubjectForm({ id }: { id?: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<SubjectRecord | null>(null);
  const [existingSeo, setExistingSeo] = useState<EditorialSeo | null>(null);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [levels, setLevels] = useState<MasterRecord[]>([]);
  const [levelIds, setLevelIds] = useState<string[]>([]);
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [countryIds, setCountryIds] = useState<string[]>([]);
  const [derivedCountryIds, setDerivedCountryIds] = useState<string[]>([]);
  /* A new subject starts listed for every destination, as the catalogue
     links it; the ticks show that so an editor can untick before saving. */
  const [countriesDefaulted, setCountriesDefaulted] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', shortDescription: '', overview: '', iconMediaId: '', listingMediaId: '', heroMediaId: '', isFeatured: false, displayOrder: '0' });
  const [specializations, setSpecializations] = useState<SubSubjectRecord[]>([]);
  const [seo, setSeo] = useState<UnifiedSeoDraft>(blankUnifiedSeo);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState<Intent | null>(null);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const mediaResult = await listEditorialMedia({ limit: 50 });
        if (!active) return;
        setMedia(mediaResult.data);
        /* The study levels to tick. Their list failing leaves the ticks out,
           not the editor. */
        void listCourseLevels({ status: 'ACTIVE', limit: 100 })
          .then((result) => { if (active) setLevels(result.data); })
          .catch(() => undefined);
        void listEvery(listCountries)
          .then((rows) => {
            if (!active) return;
            setCountries(rows);
            if (!id) { setCountryIds(rows.map((row) => row.id)); setCountriesDefaulted(true); }
          })
          .catch(() => undefined);
        if (!id) return;
        const [subjectResult, seoResult, subResult, countryLinks] = await Promise.all([
          getSubject(id), getSubjectSeo(id), listAllSubSubjects(id), getSubjectCountries(id),
        ]);
        if (!active) return;
        const subject = subjectResult.data;
        setRecord(subject);
        setCountryIds(countryLinks.data.map((link) => link.country.id));
        setDerivedCountryIds(countryLinks.data.filter((link) => link.source === 'DERIVED').map((link) => link.country.id));
        setLevelIds((subject.courseLevels ?? []).map((level) => level.id));
        setExistingSeo(seoResult.data);
        setSeo(seoFromRecord(seoResult.data));
        setForm({
          name: subject.name, slug: subject.slug, shortDescription: subject.shortDescription ?? '', overview: subject.overview ?? '', iconMediaId: subject.iconMedia?.id ?? '', listingMediaId: subject.listingMedia?.id ?? '', heroMediaId: subject.heroMedia?.id ?? '', isFeatured: subject.isFeatured, displayOrder: String(subject.displayOrder),
        });
        setSpecializations(subResult);
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
  const set = (key: keyof typeof form, value: string | boolean) => { if (key === 'slug') setSlugEdited(true); setForm((current) => ({ ...current, [key]: value, ...(key === 'name' ? { slug: nextAutoSlug({ sourceValue: String(value), currentSlug: current.slug, existingRecord: Boolean(id), manuallyOverridden: slugEdited }) } : {}) })); setDirty(true); setIssues([]); };
  function validate() {
    const next: string[] = [];
    if (!form.name.trim()) next.push('Subject name is required.');
    if (!form.shortDescription.trim()) next.push('Subject short description is required.');
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) next.push('Subject slug must use lowercase letters, numbers and single hyphens.');
    if (!/^\d+$/.test(form.displayOrder) || Number(form.displayOrder) > 999999) next.push('Subject display order must be a whole number from 0 to 999999.');
    if (hasSeo(seo) && (!seo.seoTitle.trim() || !seo.metaDescription.trim())) next.push('SEO title and meta description are both required when SEO is configured.');
    setIssues(next);
    return next.length === 0;
  }

  /* Publishing a specialization bumps its version, so the rows this returns
     are the ones the form must keep: writing back the pre-publish rows left
     every specialization a version behind, and the next save was refused with
     "changed in another session" for an edit nobody else had made. */
  async function applyPublication(subject: SubjectRecord, children: SubSubjectRecord[], intent: Intent) {
    const settled: SubSubjectRecord[] = [];
    if (intent === 'publish') {
      const current = subject.status === 'PUBLISHED' ? subject : (await publishSubject(subject.id, subject.updatedAt)).data;
      for (const child of children) {
        settled.push(
          child.status === 'PUBLISHED'
            ? child
            : (await publishSubSubject(current.id, child.id, child.updatedAt)).data,
        );
      }
      return { record: current, children: settled };
    }
    for (const child of children) {
      settled.push(
        child.status === 'PUBLISHED'
          ? (await unpublishSubSubject(subject.id, child.id, child.updatedAt)).data
          : child,
      );
    }
    const record = subject.status === 'PUBLISHED' ? (await unpublishSubject(subject.id, subject.updatedAt)).data : subject;
    return { record, children: settled };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent: Intent = submitter?.value === 'publish' ? 'publish' : 'draft';
    if (!validate()) return;
    setSaving(true); setSavingIntent(intent); setError('');
    try {
      const payload = {
        name: form.name.trim(), slug: form.slug.trim() || undefined, shortDescription: form.shortDescription.trim(), overview: form.overview.trim() || undefined,
        iconMediaId: form.iconMediaId || undefined, listingMediaId: form.listingMediaId || undefined, heroMediaId: form.heroMediaId || undefined,
        isFeatured: form.isFeatured, displayOrder: Number(form.displayOrder) || 0,
        courseLevelIds: levelIds,
        ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
      };
      const saved = record ? (await updateSubject(record.id, payload)).data : (await createSubject(payload)).data;
      /* The destinations, written whole after the record; a new subject's
         default of "everywhere" is what the catalogue would have linked. */
      if (record || !countriesDefaulted || countryIds.length !== countries.length) {
        const links = await saveSubjectCountries(saved.id, countryIds);
        setCountryIds(links.data.map((link) => link.country.id));
        setDerivedCountryIds(links.data.filter((link) => link.source === 'DERIVED').map((link) => link.country.id));
      }
      if (hasSeo(seo)) {
        const result = await saveSubjectSeo(saved.id, seoPayload(seo));
        setExistingSeo(result.data);
      } else if (existingSeo) {
        await deleteSubjectSeo(saved.id, existingSeo.updatedAt);
        setExistingSeo(null);
      }
      const settled = await applyPublication(saved, specializations, intent);
      setRecord(settled.record);
      setSpecializations(settled.children);
      setDirty(false);
      if (!id) router.replace(`/subjects/${settled.record.id}`);
      router.refresh();
    } catch (cause: unknown) {
      setError(catalogErrorText(cause, 'Unable to save subject'));
    } finally { setSaving(false); setSavingIntent(null); }
  }

  if (loading) return <section className="mx-auto max-w-[980px] rounded-2xl border border-[#E8ECF3] bg-white p-8"><p className="p-sub">Loading subject editor…</p></section>;

  return (
    <section className="mx-auto max-w-[1040px]" aria-labelledby="subject-form-heading">
      <Link href="/subjects" className="p-link">← Subjects</Link>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="p-eyebrow">Unified subject editor</p><h2 id="subject-form-heading" className="p-h1">{record ? 'Edit subject' : 'Create subject'}</h2><p className="p-sub">Basic information, study levels, destinations, media and SEO are saved together. Publishing the subject also publishes its draft specializations.</p></div>
        <span className="p-chip">{status}</span>
      </div>
      {error ? <p role="alert" className="p-alert p-alert--error">{error}</p> : null}
      {issues.length ? <div role="alert" className="p-alert p-alert--error"><p className="font-semibold">Fix these fields before saving:</p><ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}

      <form onSubmit={submit} className="mt-8 space-y-6">
        <fieldset className="p-panel">
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
        </fieldset>

        <StudyLevelTicks idPrefix="subject" levels={levels} value={levelIds} onChange={(next) => { setLevelIds(next); setDirty(true); }} />

        <DestinationTicks idPrefix="subject" countries={countries} value={countryIds} derived={derivedCountryIds} onChange={(next) => { setCountryIds(next); setDirty(true); }} hint={record ? undefined : 'A new subject is listed for every destination until you untick some. A country with a published course in it stays ticked on its own.'} />

        <fieldset id="editor-specializations" className="p-panel">
          <legend className="sr-only">Specializations</legend>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="p-eyebrow">Children</p>
              <h3 className="mt-2 text-xl font-semibold">Specializations</h3>
              <p className="p-sub">
                {record
                  ? 'Each specialization has an editor of its own, with its content and SEO. Publishing this subject also publishes the drafts among them.'
                  : 'Save the subject first; its specializations are then added from here, each with an editor of its own.'}
              </p>
            </div>
            {record ? (
              <Link href={`/specializations/new?subject=${record.id}`} className="p-btn p-btn--outline p-btn--sm">+ Add specialization</Link>
            ) : null}
          </div>
          {record ? (
            <div className="mt-6">
              {specializations.length === 0 ? (
                <div className="p-card p-sub">No specializations yet. Add one if this Subject needs a sub-field.</div>
              ) : (
                <ul className="divide-y divide-[#E8ECF3] rounded-xl border border-[#E8ECF3]">
                  {specializations.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <span className="font-semibold">{row.name}</span>
                        <span className="p-hint ml-2">/{row.slug}</span>
                        {row.shortDescription?.trim() ? null : (
                          <span className="p-chip ml-2 align-middle text-xs font-normal" title="Publishes without one; its page stays out of search engines until it has some content.">No short description</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`p-badge ${row.status === 'PUBLISHED' ? 'p-badge--ok' : 'p-badge--visa'}`}>{row.status}</span>
                        <Link href={`/specializations/${row.id}`} className="p-btn p-btn--ghost p-btn--sm">Edit</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </fieldset>

        <UnifiedSeoFields value={seo} onChange={(next) => { setSeo(next); setDirty(true); }} media={media} />
        <UnifiedEditorActions cancelHref="/subjects" busy={saving} savingIntent={savingIntent} published={record?.status === 'PUBLISHED'} />
      </form>
    </section>
  );
}
