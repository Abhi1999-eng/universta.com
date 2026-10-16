'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createSpecializationFaq,
  createSpecializationSection,
  createSubSubject,
  deleteSpecializationFaq,
  deleteSpecializationSection,
  deleteSpecializationSeo,
  getSpecialization,
  getSpecializationCountries,
  getSpecializationSeo,
  listAllSubjects,
  listCountries,
  listCourseLevels,
  listEditorialMedia,
  listEvery,
  saveSpecializationCountries,
  listSpecializationFaqs,
  listSpecializationSections,
  publishSubSubject,
  saveSpecializationSeo,
  unpublishSubSubject,
  updateSpecializationFaq,
  updateSpecializationSection,
  updateSubSubject,
} from './catalog-client';
import {
  ContentSectionsCard,
  FaqsCard,
  faqBlank,
  faqFromRecord,
  faqIssues,
  faqPayload,
  faqUsed,
  sectionBlank,
  sectionFromRecord,
  sectionIssues,
  sectionPayload,
  sectionUsed,
  type FaqDraft,
  type SectionDraft,
} from './editorial/ContentBlocks';
import type { CatalogLevel, CountryRecord, EditorialMedia, EditorialSeo, MasterRecord, SubjectRecord, SubSubjectRecord } from './catalog.types';
import { DestinationTicks } from './DestinationTicks';
import { StudyLevelTicks } from './StudyLevelTicks';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';
import { UnifiedEditorActions } from '@/features/shared/UnifiedEditorActions';
import { nextAutoSlug } from '@/lib/slug';
import { blankUnifiedSeo, seoPayload, UnifiedSeoFields, type UnifiedSeoDraft } from '@/features/shared/UnifiedSeoFields';
import { catalogErrorText } from './catalog-errors';
import { EditorSectionNav } from '@/features/shared/EditorSectionNav';

type Intent = 'draft' | 'publish';

const inputClass = 'p-input';
const hasSeo = (value: UnifiedSeoDraft) => Boolean(value.seoTitle.trim() || value.metaDescription.trim() || value.canonicalUrl.trim() || value.focusKeyword.trim() || value.ogTitle.trim() || value.ogDescription.trim() || value.ogMediaId || value.twitterTitle.trim() || value.twitterDescription.trim() || value.twitterMediaId);
const seoFromRecord = (record: EditorialSeo | null): UnifiedSeoDraft => record ? {
  seoTitle: record.seoTitle ?? '', metaDescription: record.metaDescription ?? '', canonicalUrl: record.canonicalUrl ?? '', focusKeyword: record.focusKeyword ?? '', ogTitle: record.ogTitle ?? '', ogDescription: record.ogDescription ?? '', ogMediaId: record.ogMediaId ?? '', twitterTitle: record.twitterTitle ?? '', twitterDescription: record.twitterDescription ?? '', twitterMediaId: record.twitterMediaId ?? '', robotsIndex: record.robotsIndex, robotsFollow: record.robotsFollow,
} : blankUnifiedSeo;

/* What a specialization's page can carry a section about; the API keeps
   the same list. */
const SECTION_KEYS = ['what-you-study', 'curriculum', 'skills', 'career-outcomes', 'admission-requirements', 'documents', 'application-process', 'why-choose', 'top-destinations'] as const;

const blankForm = () => ({ subjectId: '', name: '', slug: '', shortDescription: '', overview: '', iconMediaId: '', listingMediaId: '', isFeatured: false, displayOrder: '0' });

/** A specialization's own editor: its fields, media and SEO saved together,
 * as a subject's or a course's are. A new one is filed under the subject
 * chosen at the top (`?subject=<id>` preselects it); an existing one stays
 * with its subject.
 *
 * The short description is optional: a specialization publishes without
 * one, and its page simply stays out of search engines until it has some
 * content of its own. */
export function SpecializationForm({ id }: { id?: string }) {
  const router = useRouter();
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null);
  const preselectedSubject = useSearchParams().get('subject') ?? '';
  const [record, setRecord] = useState<SubSubjectRecord | null>(null);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [levels, setLevels] = useState<MasterRecord[]>([]);
  const [levelIds, setLevelIds] = useState<string[]>([]);
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [countryIds, setCountryIds] = useState<string[]>([]);
  const [derivedCountryIds, setDerivedCountryIds] = useState<string[]>([]);
  const [impliedLevels, setImpliedLevels] = useState<CatalogLevel[]>([]);
  const [sections, setSections] = useState<SectionDraft[]>(() => [sectionBlank(SECTION_KEYS[0])]);
  const [faqs, setFaqs] = useState<FaqDraft[]>(() => [faqBlank()]);
  const [removedSections, setRemovedSections] = useState<SectionDraft[]>([]);
  const [removedFaqs, setRemovedFaqs] = useState<FaqDraft[]>([]);
  const [existingSeo, setExistingSeo] = useState<EditorialSeo | null>(null);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [form, setForm] = useState({ ...blankForm(), subjectId: preselectedSubject });
  const [seo, setSeo] = useState<UnifiedSeoDraft>(blankUnifiedSeo);
  const [loading, setLoading] = useState(true);
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
        const [mediaResult, subjectRows, levelRows] = await Promise.all([
          listEditorialMedia({ limit: 50 }),
          listAllSubjects(),
          listCourseLevels({ status: 'ACTIVE', limit: 100 }),
        ]);
        if (!active) return;
        setMedia(mediaResult.data);
        setSubjects(subjectRows);
        setLevels(levelRows.data);
        void listEvery(listCountries).then((rows) => { if (active) setCountries(rows); }).catch(() => undefined);
        if (!id) return;
        const [recordResult, seoResult, sectionRows, faqRows, countryLinks] = await Promise.all([
          getSpecialization(id),
          getSpecializationSeo(id),
          listSpecializationSections(id),
          listSpecializationFaqs(id),
          getSpecializationCountries(id),
        ]);
        if (!active) return;
        const row = recordResult.data;
        setRecord(row);
        setCountryIds(countryLinks.data.map((link) => link.country.id));
        setDerivedCountryIds(countryLinks.data.filter((link) => link.source === 'DERIVED').map((link) => link.country.id));
        const loadedSections = sectionRows.data.map(sectionFromRecord);
        const loadedFaqs = faqRows.data.map(faqFromRecord);
        setSections(loadedSections.length ? loadedSections : [sectionBlank(SECTION_KEYS[0])]);
        setFaqs(loadedFaqs.length ? loadedFaqs : [faqBlank()]);
        setLevelIds((row.courseLevels ?? []).map((level) => level.id));
        setImpliedLevels(row.impliedCourseLevels ?? []);
        setExistingSeo(seoResult.data);
        setSeo(seoFromRecord(seoResult.data));
        setForm({
          subjectId: row.subject.id, name: row.name, slug: row.slug, shortDescription: row.shortDescription ?? '', overview: row.overview ?? '', iconMediaId: row.iconMedia?.id ?? '', listingMediaId: row.listingMedia?.id ?? '', isFeatured: row.featured, displayOrder: String(row.displayOrder),
        });
      } catch (cause: unknown) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load specialization editor');
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
  const subject = record?.subject ?? subjects.find((row) => row.id === form.subjectId) ?? null;
  const set = (key: keyof typeof form, value: string | boolean) => { if (key === 'slug') setSlugEdited(true); setForm((current) => ({ ...current, [key]: value, ...(key === 'name' ? { slug: nextAutoSlug({ sourceValue: String(value), currentSlug: current.slug, existingRecord: Boolean(id), manuallyOverridden: slugEdited }) } : {}) })); setDirty(true); setIssues([]); };

  const updateSection = (index: number, patch: Partial<SectionDraft>) => { setSections((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row))); setDirty(true); setIssues([]); };
  const updateFaq = (index: number, patch: Partial<FaqDraft>) => { setFaqs((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row))); setDirty(true); setIssues([]); };
  const removeSection = (index: number) => { const row = sections[index]; if (row.id) setRemovedSections((old) => [...old, row]); setSections((rows) => { const next = rows.filter((_, i) => i !== index); return next.length ? next : [sectionBlank(SECTION_KEYS[0])]; }); setDirty(true); };
  const removeFaq = (index: number) => { const row = faqs[index]; if (row.id) setRemovedFaqs((old) => [...old, row]); setFaqs((rows) => { const next = rows.filter((_, i) => i !== index); return next.length ? next : [faqBlank()]; }); setDirty(true); };

  /* Each row is written on its own after the record is saved, as the course
     editor does; the rows that come back are the ones kept, versions and all. */
  async function syncContent(specializationId: string) {
    for (const row of removedSections) if (row.id) await deleteSpecializationSection(specializationId, row.id, row.updatedAt);
    const savedSections: SectionDraft[] = [];
    for (const row of sections.filter(sectionUsed)) {
      const result = row.id
        ? await updateSpecializationSection(specializationId, row.id, sectionPayload(row))
        : await createSpecializationSection(specializationId, sectionPayload(row));
      savedSections.push(sectionFromRecord(result.data));
    }
    setSections(savedSections.length ? savedSections : [sectionBlank(SECTION_KEYS[0])]);
    setRemovedSections([]);
    for (const row of removedFaqs) if (row.id) await deleteSpecializationFaq(specializationId, row.id, row.updatedAt);
    const savedFaqs: FaqDraft[] = [];
    for (const row of faqs.filter(faqUsed)) {
      const result = row.id
        ? await updateSpecializationFaq(specializationId, row.id, faqPayload(row))
        : await createSpecializationFaq(specializationId, faqPayload(row));
      savedFaqs.push(faqFromRecord(result.data));
    }
    setFaqs(savedFaqs.length ? savedFaqs : [faqBlank()]);
    setRemovedFaqs([]);
  }

  function validate() {
    const next: string[] = [];
    next.push(...sectionIssues(sections, SECTION_KEYS), ...faqIssues(faqs));
    if (!form.subjectId) next.push('Choose the subject this specialization belongs to.');
    if (!form.name.trim()) next.push('Specialization name is required.');
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) next.push('Slug must use lowercase letters, numbers and single hyphens.');
    if (!/^\d+$/.test(form.displayOrder) || Number(form.displayOrder) > 999999) next.push('Display order must be a whole number from 0 to 999999.');
    if (hasSeo(seo) && (!seo.seoTitle.trim() || !seo.metaDescription.trim())) next.push('SEO title and meta description are both required when SEO is configured.');
    setIssues(next);
    return next.length === 0;
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
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        /* Blank clears a description that was written before; the API files
           an empty string as none. */
        shortDescription: form.shortDescription.trim(),
        overview: form.overview.trim(),
        iconMediaId: form.iconMediaId || undefined,
        listingMediaId: form.listingMediaId || undefined,
        isFeatured: form.isFeatured,
        displayOrder: Number(form.displayOrder) || 0,
        courseLevelIds: levelIds,
        ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
      };
      const subjectId = record?.subject.id ?? form.subjectId;
      let saved = record
        ? (await updateSubSubject(subjectId, record.id, payload)).data
        : (await createSubSubject(subjectId, payload)).data;
      await syncContent(saved.id);
      if (record || countryIds.length) {
        const links = await saveSpecializationCountries(saved.id, countryIds);
        setCountryIds(links.data.map((link) => link.country.id));
        setDerivedCountryIds(links.data.filter((link) => link.source === 'DERIVED').map((link) => link.country.id));
      }
      if (hasSeo(seo)) {
        const result = await saveSpecializationSeo(saved.id, seoPayload(seo));
        setExistingSeo(result.data);
      } else if (existingSeo) {
        await deleteSpecializationSeo(saved.id, existingSeo.updatedAt);
        setExistingSeo(null);
      }
      /* Publishing moves the version on, so the row it returns is the one to
         keep; the next save would otherwise be refused as stale. */
      if (intent === 'publish' && saved.status !== 'PUBLISHED')
        saved = (await publishSubSubject(subjectId, saved.id, saved.updatedAt)).data;
      if (intent === 'draft' && saved.status === 'PUBLISHED')
        saved = (await unpublishSubSubject(subjectId, saved.id, saved.updatedAt)).data;
      setRecord(saved);
      setLevelIds((saved.courseLevels ?? []).map((level) => level.id));
      setForm((current) => ({ ...current, slug: saved.slug, shortDescription: saved.shortDescription ?? '', overview: saved.overview ?? '' }));
      setDirty(false);
      if (!id) router.replace(`/specializations/${saved.id}`);
      router.refresh();
    } catch (cause: unknown) {
      setError(catalogErrorText(cause, 'Unable to save specialization'));
    } finally { setSaving(false); setSavingIntent(null); }
  }

  if (loading) return <section className="mx-auto w-full max-w-[980px] rounded-2xl border border-[#E8ECF3] bg-white p-8"><p className="p-sub">Loading specialization editor…</p></section>;

  return (
    <section className="mx-auto w-full max-w-[1040px]" aria-labelledby="specialization-form-heading">
      <Link href="/specializations" className="p-link">← Specializations</Link>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="p-eyebrow">Specialization</p>
          <h2 id="specialization-form-heading" className="p-h1">{record ? 'Edit specialization' : 'Create specialization'}</h2>
          <p className="p-sub">Basic information, study levels, content sections, FAQs and SEO are saved together.{subject ? <> Belongs to <Link href={`/subjects/${subject.id}`} className="p-link">{subject.name}</Link>.</> : null}</p>
        </div>
        <span className="p-chip">{status}</span>
      </div>
      {error ? <p role="alert" className="p-alert p-alert--error">{error}</p> : null}
      {issues.length ? <div role="alert" className="p-alert p-alert--error"><p className="font-semibold">Fix these fields before saving:</p><ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}

      <EditorSectionNav root={formEl} />
      <form ref={setFormEl} onSubmit={submit} className="mt-8 space-y-6">
        <fieldset className="p-panel">
          <legend className="sr-only">Specialization information</legend>
          <h3 className="text-xl font-semibold">Specialization information</h3>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {record ? (
              <div className="text-sm font-semibold sm:col-span-2">
                <FieldLabel label="Subject" htmlFor="specialization-subject" />
                <input id="specialization-subject" className={inputClass} value={record.subject.name} readOnly aria-readonly="true" />
                <p className="p-hint">A specialization stays with the subject it was created under.</p>
              </div>
            ) : (
              <div className="text-sm font-semibold sm:col-span-2">
                <FieldLabel label="Subject" htmlFor="specialization-subject" required />
                <select id="specialization-subject" className={inputClass} value={form.subjectId} onChange={(e) => set('subjectId', e.target.value)}>
                  <option value="">Choose a subject</option>
                  {subjects.map((row) => <option key={row.id} value={row.id}>{row.name}{row.status === 'PUBLISHED' ? '' : ' (draft)'}</option>)}
                </select>
                <p className="p-hint">Publishing a specialization needs its subject to be published first.</p>
              </div>
            )}
            <div className="text-sm font-semibold"><FieldLabel label="Name" htmlFor="specialization-name" required help={commonFieldHelp.name} /><input id="specialization-name" className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="text-sm font-semibold"><FieldLabel label="Slug" htmlFor="specialization-slug" help={commonFieldHelp.slug} /><input id="specialization-slug" className={inputClass} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="Generated from name" /></div>
            <div className="text-sm font-semibold sm:col-span-2"><FieldLabel label="Short description" htmlFor="specialization-short" help={commonFieldHelp.shortDescription} /><textarea id="specialization-short" rows={3} className={inputClass} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} /><p className="p-hint">Optional. Without one, its page publishes but stays out of search engines until it has some content.</p></div>
            <div className="text-sm font-semibold sm:col-span-2"><FieldLabel label="Overview" htmlFor="specialization-overview" help={commonFieldHelp.overview} /><textarea id="specialization-overview" rows={6} className={inputClass} value={form.overview} onChange={(e) => set('overview', e.target.value)} /></div>
            <MediaPickerDialog label="Icon media" value={form.iconMediaId} media={media} onChange={(value) => set('iconMediaId', value)} />
            <MediaPickerDialog label="Listing media" value={form.listingMediaId} media={media} onChange={(value) => set('listingMediaId', value)} />
            <div className="text-sm font-semibold"><FieldLabel label="Display order" htmlFor="specialization-order" help={commonFieldHelp.displayOrder} /><input id="specialization-order" type="number" min="0" max="999999" className={inputClass} value={form.displayOrder} onChange={(e) => set('displayOrder', e.target.value)} /></div>
            <label className="p-btn p-btn--ghost self-end"><input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> Featured specialization</label>
          </div>
        </fieldset>

        <StudyLevelTicks idPrefix="specialization" levels={levels} value={levelIds} implied={impliedLevels} onChange={(next) => { setLevelIds(next); setDirty(true); }} />

        <DestinationTicks idPrefix="specialization" countries={countries} value={countryIds} derived={derivedCountryIds} onChange={(next) => { setCountryIds(next); setDirty(true); }} />

        <ContentSectionsCard idPrefix="specialization" rows={sections} keys={SECTION_KEYS} media={media} onChange={updateSection} onAdd={() => { setSections((rows) => [...rows, sectionBlank('')]); setDirty(true); }} onRemove={removeSection} />

        <FaqsCard idPrefix="specialization" rows={faqs} onChange={updateFaq} onAdd={() => { setFaqs((rows) => [...rows, faqBlank()]); setDirty(true); }} onRemove={removeFaq} />

        <UnifiedSeoFields value={seo} onChange={(next) => { setSeo(next); setDirty(true); }} media={media} />
        <UnifiedEditorActions cancelHref="/specializations" busy={saving} savingIntent={savingIntent} published={record?.status === 'PUBLISHED'} />
      </form>
    </section>
  );
}
