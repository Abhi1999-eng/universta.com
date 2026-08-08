'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createConsultantCard,
  createCountry,
  createCountryFaq,
  createEditorialSection,
  deleteConsultantCard,
  deleteCountryFaq,
  deleteCountryProfile,
  deleteCountrySeo,
  deleteEditorialSection,
  getCountry,
  getCountryEditorial,
  getCountryProfiles,
  listContinents,
  listEditorialMedia,
  listIntakeOptions,
  publishCountry,
  putCountryProfile,
  saveCountrySeo,
  unpublishCountry,
  updateConsultantCard,
  updateCountry,
  updateCountryFaq,
  updateEditorialSection,
} from './catalog-client';
import type {
  CatalogMutationError,
  ContinentRecord,
  CountryEditorialBundle,
  CountryProfileBundle,
  CountryRecord,
  EditorialCard,
  EditorialFaq,
  EditorialMedia,
  EditorialSection,
  EditorialSeo,
  IntakeOption,
} from './catalog.types';
import { MediaPickerDialog } from './editorial/MediaPickerDialog';
import { TypedBodyEditor } from './editorial/TypedBodyEditor';
import {
  SECTION_KEYS,
  SECTION_TYPES,
  blankSection,
  bodyForApi,
  draftFromSection,
  type SectionDraft,
  type SectionType,
} from './editorial/editor-types';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { UnifiedEditorActions } from '@/features/shared/UnifiedEditorActions';
import { blankUnifiedSeo, seoPayload, UnifiedSeoFields, type UnifiedSeoDraft } from '@/features/shared/UnifiedSeoFields';

type Intent = 'draft' | 'publish';
type Core = { continentId: string; name: string; slug: string; iso2Code: string; iso3Code: string; pageHeading: string; shortDescription: string; isFeatured: boolean; displayOrder: string };
type ProfileKind = 'cost' | 'work' | 'language' | 'statistics';
type ProfileValues = Record<string, string | boolean>;
type SectionRow = SectionDraft & { id?: string; updatedAt?: string };
type FaqRow = { id?: string; updatedAt?: string; question: string; answer: string; category: string; isFeatured: boolean; status: string; displayOrder: string };
type CardRow = { id?: string; updatedAt?: string; title: string; slug: string; shortDescription: string; overview: string; iconMediaId: string; featuredMediaId: string; isFreeConsultation: boolean; ctaLabel: string; ctaUrl: string; status: string; isFeatured: boolean; displayOrder: string };

const blankCore: Core = { continentId: '', name: '', slug: '', iso2Code: '', iso3Code: '', pageHeading: '', shortDescription: '', isFeatured: false, displayOrder: '0' };
const input = 'mt-2 w-full rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]';
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
const optional = (value: string) => value.trim() ? value.trim() : undefined;
const hasSeo = (value: UnifiedSeoDraft) => Boolean(value.seoTitle.trim() || value.metaDescription.trim() || value.canonicalUrl.trim() || value.focusKeyword.trim() || value.ogTitle.trim() || value.ogDescription.trim() || value.ogMediaId || value.twitterTitle.trim() || value.twitterDescription.trim() || value.twitterMediaId);

const profileFields: Record<ProfileKind, Array<[string, string]>> = {
  cost: [['currencyCode','Currency code'],['currencySymbol','Currency symbol'],['tuitionMin','Tuition minimum'],['tuitionMax','Tuition maximum'],['tuitionPeriod','Tuition period'],['budgetBand','Budget band'],['livingCostMin','Living cost minimum'],['livingCostMax','Living cost maximum'],['applicableYear','Applicable year'],['sourceReference','Source URL'],['verifiedAt','Verified at']],
  work: [['partTimeHoursPerWeek','Part-time hours/week'],['postStudyWorkMinMonths','Post-study months minimum'],['postStudyWorkMaxMonths','Post-study months maximum'],['immigrationPathwayStrength','Pathway strength'],['visaSuccessBand','Visa success band'],['visaSuccessPercentage','Visa success percentage'],['sourceReference','Source URL'],['verifiedAt','Verified at']],
  language: [['ieltsRequirement','IELTS requirement'],['ieltsMinScore','IELTS minimum score'],['pteRequirement','PTE requirement'],['pteMinScore','PTE minimum score'],['toeflRequirement','TOEFL requirement'],['toeflMinScore','TOEFL minimum score'],['duolingoRequirement','Duolingo requirement'],['duolingoMinScore','Duolingo minimum score'],['sourceReference','Source URL'],['verifiedAt','Verified at']],
  statistics: [['universitiesCount','Universities'],['publicUniversitiesCount','Public universities'],['coursesCount','Courses'],['ugCoursesCount','UG courses'],['pgCoursesCount','PG courses'],['topRankedUniversitiesCount','Top-ranked universities'],['sourceReference','Source URL'],['verifiedAt','Verified at']],
};
const profileDefaults: Record<ProfileKind, ProfileValues> = {
  cost: { currencyCode: 'CAD', currencySymbol: '$', tuitionPeriod: 'PER_YEAR', budgetBand: 'MID_RANGE' },
  work: { partTimeAllowed: false, postStudyWorkAvailable: false, immigrationPathwayStrength: 'NOT_PUBLISHED', visaSuccessBand: 'NOT_PUBLISHED' },
  language: { ieltsRequirement: 'VARIES', pteRequirement: 'VARIES', toeflRequirement: 'VARIES', duolingoRequirement: 'VARIES', languageWaiverAvailable: false },
  statistics: { sourceMode: 'MANUAL' },
};
const blankFaq = (): FaqRow => ({ question: '', answer: '', category: '', isFeatured: false, status: 'ACTIVE', displayOrder: '0' });
const blankCard = (): CardRow => ({ title: '', slug: '', shortDescription: '', overview: '', iconMediaId: '', featuredMediaId: '', isFreeConsultation: true, ctaLabel: 'View consultants', ctaUrl: '', status: 'DRAFT', isFeatured: false, displayOrder: '0' });
const seoFromRecord = (row: EditorialSeo | null): UnifiedSeoDraft => row ? { seoTitle: row.seoTitle ?? '', metaDescription: row.metaDescription ?? '', canonicalUrl: row.canonicalUrl ?? '', focusKeyword: row.focusKeyword ?? '', ogTitle: row.ogTitle ?? '', ogDescription: row.ogDescription ?? '', ogMediaId: row.ogMediaId ?? '', twitterTitle: row.twitterTitle ?? '', twitterDescription: row.twitterDescription ?? '', twitterMediaId: row.twitterMediaId ?? '', robotsIndex: row.robotsIndex, robotsFollow: row.robotsFollow } : blankUnifiedSeo;

export function CountryForm({ countryId }: { countryId?: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<CountryRecord | null>(null);
  const [continents, setContinents] = useState<ContinentRecord[]>([]);
  const [core, setCore] = useState<Core>(blankCore);
  const [profiles, setProfiles] = useState<Record<ProfileKind, ProfileValues>>({ ...profileDefaults });
  const [profileVersions, setProfileVersions] = useState<Record<ProfileKind, string | undefined>>({ cost: undefined, work: undefined, language: undefined, statistics: undefined });
  const [intakeOptions, setIntakeOptions] = useState<IntakeOption[]>([]);
  const [selectedIntakes, setSelectedIntakes] = useState<Record<string, boolean>>({});
  const [intakeVersion, setIntakeVersion] = useState<string | undefined>();
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [removedSections, setRemovedSections] = useState<SectionRow[]>([]);
  const [removedFaqs, setRemovedFaqs] = useState<FaqRow[]>([]);
  const [removedCards, setRemovedCards] = useState<CardRow[]>([]);
  const [existingSeo, setExistingSeo] = useState<EditorialSeo | null>(null);
  const [seo, setSeo] = useState<UnifiedSeoDraft>(blankUnifiedSeo);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState<Intent | null>(null);
  const [error, setError] = useState('');
  const [issues, setIssues] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [continentResult, mediaResult, intakeResult] = await Promise.all([listContinents({ limit: 100 }), listEditorialMedia({ limit: 50 }), listIntakeOptions()]);
        if (!active) return;
        setContinents(continentResult.data); setMedia(mediaResult.data); setIntakeOptions(intakeResult.data);
        if (!countryId) return;
        const [countryResult, profileResult, editorialResult] = await Promise.all([getCountry(countryId), getCountryProfiles(countryId), getCountryEditorial(countryId)]);
        if (!active) return;
        hydrateCore(countryResult.data); hydrateProfiles(profileResult.data); hydrateEditorial(editorialResult.data);
      } catch (cause: unknown) { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load country editor'); }
      finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [countryId]);

  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);

  function hydrateCore(row: CountryRecord) { setRecord(row); setCore({ continentId: row.continent.id, name: row.name, slug: row.slug, iso2Code: row.iso2Code ?? '', iso3Code: row.iso3Code ?? '', pageHeading: row.pageHeading, shortDescription: row.shortDescription, isFeatured: row.featured, displayOrder: String(row.displayOrder) }); }
  function hydrateProfiles(bundle: CountryProfileBundle) {
    const next = { ...profileDefaults } as Record<ProfileKind, ProfileValues>;
    (['cost','work','language','statistics'] as ProfileKind[]).forEach((kind) => { const raw = bundle[kind]; next[kind] = { ...profileDefaults[kind] }; if (raw) Object.entries(raw).forEach(([key, value]) => { if (typeof value === 'boolean') next[kind][key] = value; else if (value !== null && value !== undefined && !['id','countryId','createdAt','updatedAt'].includes(key)) next[kind][key] = String(value).replace(/T.*$/, key === 'verifiedAt' ? '' : '$&'); }); });
    setProfiles(next); setProfileVersions({ cost: bundle.cost?.updatedAt as string | undefined, work: bundle.work?.updatedAt as string | undefined, language: bundle.language?.updatedAt as string | undefined, statistics: bundle.statistics?.updatedAt as string | undefined });
    const checked: Record<string, boolean> = {}; bundle.intakes.forEach((raw) => { const intakeId = typeof raw.intakeId === 'string' ? raw.intakeId : ''; if (intakeId) checked[intakeId] = true; }); setSelectedIntakes(checked); setIntakeVersion(bundle.intakes.map((raw) => typeof raw.updatedAt === 'string' ? raw.updatedAt : '').filter(Boolean).sort().at(-1));
  }
  function hydrateEditorial(bundle: CountryEditorialBundle) {
    setSections(bundle.sections.map((row) => ({ ...draftFromSection(row), id: row.id, updatedAt: row.updatedAt })));
    setFaqs(bundle.faqs.map((row) => ({ id: row.id, updatedAt: row.updatedAt, question: row.question, answer: row.answer, category: row.category ?? '', isFeatured: row.isFeatured, status: row.status, displayOrder: String(row.displayOrder) })));
    setCards(bundle.consultantCards.map((row) => ({ id: row.id, updatedAt: row.updatedAt, title: row.title, slug: row.slug, shortDescription: row.shortDescription, overview: row.overview ?? '', iconMediaId: row.iconMediaId ?? '', featuredMediaId: row.featuredMediaId ?? '', isFreeConsultation: row.isFreeConsultation, ctaLabel: row.ctaLabel, ctaUrl: row.ctaUrl ?? '', status: row.status, isFeatured: row.isFeatured, displayOrder: String(row.displayOrder) })));
    setExistingSeo(bundle.seo); setSeo(seoFromRecord(bundle.seo));
  }

  const setCoreField = <K extends keyof Core>(key: K, value: Core[K]) => { setCore((current) => ({ ...current, [key]: value })); setDirty(true); setIssues([]); };
  const setProfile = (kind: ProfileKind, key: string, value: string | boolean) => { setProfiles((current) => ({ ...current, [kind]: { ...current[kind], [key]: value } })); setDirty(true); };
  const updateSection = (index: number, patch: Partial<SectionRow>) => { setSections((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); setDirty(true); };
  const updateFaq = (index: number, patch: Partial<FaqRow>) => { setFaqs((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); setDirty(true); };
  const updateCard = (index: number, patch: Partial<CardRow>) => { setCards((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); setDirty(true); };
  const removeSection = (index: number) => { const row = sections[index]; if (row.id) setRemovedSections((old) => [...old,row]); setSections((rows) => rows.filter((_,i) => i !== index)); setDirty(true); };
  const removeFaq = (index: number) => { const row = faqs[index]; if (row.id) setRemovedFaqs((old) => [...old,row]); setFaqs((rows) => rows.filter((_,i) => i !== index)); setDirty(true); };
  const removeCard = (index: number) => { const row = cards[index]; if (row.id) setRemovedCards((old) => [...old,row]); setCards((rows) => rows.filter((_,i) => i !== index)); setDirty(true); };

  const activeSections = useMemo(() => sections.filter((row) => row.id || row.heading.trim() || row.eyebrow.trim()), [sections]);
  const activeFaqs = useMemo(() => faqs.filter((row) => row.id || row.question.trim() || row.answer.trim()), [faqs]);
  const activeCards = useMemo(() => cards.filter((row) => row.id || row.title.trim() || row.shortDescription.trim()), [cards]);

  function validate(intent: Intent) {
    const next: string[] = [];
    if (!core.continentId) next.push('Continent is required.'); if (!core.name.trim()) next.push('Country name is required.'); if (!core.slug.trim()) next.push('Slug is required.'); if (!/^[A-Z]{2}$/.test(core.iso2Code.trim().toUpperCase())) next.push('ISO alpha-2 must contain two letters.'); if (!/^[A-Z]{3}$/.test(core.iso3Code.trim().toUpperCase())) next.push('ISO alpha-3 must contain three letters.'); if (!core.pageHeading.trim()) next.push('Page heading is required.'); if (!core.shortDescription.trim()) next.push('Short description is required.');
    activeSections.forEach((row,index) => { if (!row.heading.trim()) next.push(`Content section ${index + 1}: heading is required.`); if (row.ctaUrl && !/^\/(?!\/)|^#[a-zA-Z0-9_-]+$|^https:\/\//.test(row.ctaUrl)) next.push(`Content section ${index + 1}: CTA URL is invalid.`); });
    activeFaqs.forEach((row,index) => { if (!row.question.trim() || !row.answer.trim()) next.push(`FAQ ${index + 1}: question and answer are required.`); });
    activeCards.forEach((row,index) => { if (!row.title.trim() || !row.shortDescription.trim()) next.push(`Guidance card ${index + 1}: title and short description are required.`); });
    if (hasSeo(seo) && (!seo.seoTitle.trim() || !seo.metaDescription.trim())) next.push('SEO title and meta description are required when SEO is configured.');
    if (intent === 'publish') {
      for (const kind of ['cost','work','language'] as ProfileKind[]) { const source = String(profiles[kind].sourceReference ?? ''); const verified = String(profiles[kind].verifiedAt ?? ''); if ((source || verified) && (!/^https:\/\//i.test(source) || !verified)) next.push(`${kind} profile: verified facts require an HTTPS source and verified date.`); }
    }
    setIssues(next); return next.length === 0;
  }

  async function syncProfiles(id: string) {
    for (const kind of ['cost','work','language','statistics'] as ProfileKind[]) {
      const data = profiles[kind]; const meaningful = Object.values(data).some((value) => value !== '' && value !== false && value !== undefined);
      if (meaningful) { const result = await putCountryProfile(id, kind, { ...data, expectedUpdatedAt: profileVersions[kind] }); const raw = result.data as Record<string, unknown>; setProfileVersions((current) => ({ ...current, [kind]: typeof raw.updatedAt === 'string' ? raw.updatedAt : current[kind] })); }
      else if (profileVersions[kind]) { await deleteCountryProfile(id, kind, profileVersions[kind]); setProfileVersions((current) => ({ ...current, [kind]: undefined })); }
    }
    const result = await putCountryProfile(id, 'intakes', { expectedUpdatedAt: intakeVersion, intakes: Object.entries(selectedIntakes).filter(([,checked]) => checked).map(([intakeId]) => ({ intakeId, isMajor: true, availabilityStatus: 'AVAILABLE' })) }); const returned = result.data as { intakes?: Array<Record<string, unknown>> }; setIntakeVersion(returned.intakes?.map((raw) => typeof raw.updatedAt === 'string' ? raw.updatedAt : '').filter(Boolean).sort().at(-1));
  }
  async function syncEditorial(id: string) {
    for (const row of removedSections) if (row.id) await deleteEditorialSection(id, row.id, row.updatedAt);
    const nextSections: SectionRow[] = [];
    for (const row of activeSections) { const payload = { sectionKey: row.sectionKey, sectionType: row.sectionType, eyebrow: optional(row.eyebrow), heading: row.heading.trim(), subheading: optional(row.subheading), bodyJson: bodyForApi(row), primaryMediaId: row.primaryMediaId || undefined, secondaryMediaId: row.secondaryMediaId || undefined, ctaLabel: optional(row.ctaLabel), ctaUrl: optional(row.ctaUrl), displayOrder: row.displayOrder, status: row.status, ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}) }; const result = row.id ? await updateEditorialSection(id,row.id,payload) : await createEditorialSection(id,payload); nextSections.push({ ...draftFromSection(result.data), id: result.data.id, updatedAt: result.data.updatedAt }); }
    setSections(nextSections); setRemovedSections([]);
    for (const row of removedFaqs) if (row.id) await deleteCountryFaq(id,row.id,row.updatedAt);
    const nextFaqs: FaqRow[] = [];
    for (const row of activeFaqs) { const payload = { question: row.question.trim(), answer: row.answer.trim(), category: optional(row.category), isFeatured: row.isFeatured, status: row.status, displayOrder: Number(row.displayOrder) || 0, ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}) }; const result = row.id ? await updateCountryFaq(id,row.id,payload) : await createCountryFaq(id,payload); nextFaqs.push({ id: result.data.id, updatedAt: result.data.updatedAt, question: result.data.question, answer: result.data.answer, category: result.data.category ?? '', isFeatured: result.data.isFeatured, status: result.data.status, displayOrder: String(result.data.displayOrder) }); }
    setFaqs(nextFaqs); setRemovedFaqs([]);
    for (const row of removedCards) if (row.id) await deleteConsultantCard(id,row.id,row.updatedAt);
    const nextCards: CardRow[] = [];
    for (const row of activeCards) { const payload = { title: row.title.trim(), slug: row.slug.trim() || slugify(row.title), shortDescription: row.shortDescription.trim(), overview: optional(row.overview), iconMediaId: row.iconMediaId || undefined, featuredMediaId: row.featuredMediaId || undefined, isFreeConsultation: row.isFreeConsultation, ctaLabel: row.ctaLabel.trim() || 'View consultants', ctaUrl: optional(row.ctaUrl), status: row.status, isFeatured: row.isFeatured, displayOrder: Number(row.displayOrder) || 0, ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}) }; const result = row.id ? await updateConsultantCard(id,row.id,payload) : await createConsultantCard(id,payload); const saved = result.data; nextCards.push({ id: saved.id, updatedAt: saved.updatedAt, title: saved.title, slug: saved.slug, shortDescription: saved.shortDescription, overview: saved.overview ?? '', iconMediaId: saved.iconMediaId ?? '', featuredMediaId: saved.featuredMediaId ?? '', isFreeConsultation: saved.isFreeConsultation, ctaLabel: saved.ctaLabel, ctaUrl: saved.ctaUrl ?? '', status: saved.status, isFeatured: saved.isFeatured, displayOrder: String(saved.displayOrder) }); }
    setCards(nextCards); setRemovedCards([]);
    if (hasSeo(seo)) { const result = await saveCountrySeo(id, { ...seoPayload(seo), ...(existingSeo?.schemaJson ? { schemaJson: existingSeo.schemaJson } : {}), ...(existingSeo?.hreflangJson ? { hreflangJson: existingSeo.hreflangJson } : {}) }); setExistingSeo(result.data); } else if (existingSeo) { await deleteCountrySeo(id, existingSeo.updatedAt); setExistingSeo(null); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null; const intent: Intent = submitter?.value === 'publish' ? 'publish' : 'draft'; if (!validate(intent)) return;
    setSaving(true); setSavingIntent(intent); setError('');
    try {
      const payload = { continentId: core.continentId, name: core.name.trim(), slug: core.slug.trim() || slugify(core.name), iso2Code: core.iso2Code.trim().toUpperCase(), iso3Code: core.iso3Code.trim().toUpperCase(), pageHeading: core.pageHeading.trim(), shortDescription: core.shortDescription.trim(), isFeatured: core.isFeatured, displayOrder: Number(core.displayOrder) || 0, ...(record ? { expectedUpdatedAt: record.updatedAt } : {}) };
      let saved = record ? (await updateCountry(record.id,payload)).data : (await createCountry(payload)).data;
      await syncProfiles(saved.id); await syncEditorial(saved.id);
      const refreshed = (await getCountry(saved.id)).data;
      saved = intent === 'publish' ? (refreshed.status === 'PUBLISHED' ? refreshed : (await publishCountry(refreshed.id,refreshed.updatedAt)).data) : (refreshed.status === 'PUBLISHED' ? (await unpublishCountry(refreshed.id,refreshed.updatedAt)).data : refreshed);
      setRecord(saved); setDirty(false); if (!countryId) router.replace(`/countries/${saved.id}`); router.refresh();
    } catch (cause: unknown) { const typed = cause as Partial<CatalogMutationError>; setError(typed.message ?? (cause instanceof Error ? cause.message : 'Unable to save country')); }
    finally { setSaving(false); setSavingIntent(null); }
  }

  if (loading) return <section className="mx-auto max-w-[1100px] rounded-2xl border border-[#E8ECF3] bg-white p-8"><p className="text-sm text-[#667085]">Loading complete country editor…</p></section>;

  return <section className="mx-auto max-w-[1180px]" aria-labelledby="country-form-heading"><Link href="/countries" className="text-sm font-semibold text-[#1657CF]">← Countries</Link><div className="mt-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Unified country editor</p><h2 id="country-form-heading" className="mt-2 text-3xl font-semibold">{record ? 'Edit country' : 'Create country'}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">Identity, profiles, intakes, editorial sections, FAQs, guidance cards and SEO are one record workflow.</p></div><span className="rounded-full border border-[#D9E0EA] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">{record?.status ?? 'DRAFT'}</span></div>{error ? <p role="alert" className="mt-5 rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] px-4 py-3 text-sm font-semibold text-[#B42318]">{error}</p> : null}{issues.length ? <div role="alert" className="mt-5 rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] p-4 text-sm text-[#B42318]"><p className="font-semibold">Fix these fields:</p><ul className="mt-2 list-disc space-y-1 pl-5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : null}
    <form onSubmit={submit} className="mt-8 space-y-6">
      <Card eyebrow="Country" title="Identity & listing" description="Core catalogue identity and public listing content."><div className="grid gap-5 sm:grid-cols-2"><Select label="Continent" value={core.continentId} onChange={(value) => setCoreField('continentId',value)} options={continents.filter((row) => row.status === 'ACTIVE').map((row) => ({ id: row.id,label: row.name }))} /><Input label="Country name" value={core.name} onChange={(value) => setCoreField('name',value)} /><Input label="Slug" value={core.slug} onChange={(value) => setCoreField('slug',value)} /><Input label="ISO alpha-2" value={core.iso2Code} onChange={(value) => setCoreField('iso2Code',value.toUpperCase())} /><Input label="ISO alpha-3" value={core.iso3Code} onChange={(value) => setCoreField('iso3Code',value.toUpperCase())} /><Input label="Display order" value={core.displayOrder} onChange={(value) => setCoreField('displayOrder',value)} type="number" /><Input label="Page heading" value={core.pageHeading} onChange={(value) => setCoreField('pageHeading',value)} span /><Input label="Short description" value={core.shortDescription} onChange={(value) => setCoreField('shortDescription',value)} textarea span rows={4} /></div><label className="mt-5 flex items-center gap-3 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={core.isFeatured} onChange={(event) => setCoreField('isFeatured',event.target.checked)} /> Featured country</label></Card>
      <Card eyebrow="Structured data" title="Country profiles" description="Verified cost, work, language and statistics data all save with the country."><div className="space-y-5">{(['cost','work','language','statistics'] as ProfileKind[]).map((kind) => <div key={kind} className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"><h4 className="font-semibold capitalize">{kind} profile</h4><div className="mt-4 grid gap-4 sm:grid-cols-2">{kind === 'work' ? ['partTimeAllowed','postStudyWorkAvailable'].map((key) => <BooleanField key={key} label={key === 'partTimeAllowed' ? 'Part-time allowed' : 'Post-study work available'} checked={Boolean(profiles[kind][key])} onChange={(checked) => setProfile(kind,key,checked)} />) : null}{kind === 'language' ? <BooleanField label="Language waiver available" checked={Boolean(profiles[kind].languageWaiverAvailable)} onChange={(checked) => setProfile(kind,'languageWaiverAvailable',checked)} /> : null}{profileFields[kind].map(([key,label]) => <Input key={key} label={label} value={String(profiles[kind][key] ?? '')} onChange={(value) => setProfile(kind,key,value)} type={key === 'verifiedAt' ? 'date' : key === 'sourceReference' ? 'url' : 'text'} />)}</div></div>)}</div></Card>
      <Card eyebrow="Admissions" title="Intakes" description="Select the intakes published for this destination."><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{intakeOptions.map((item) => <label key={item.id} className="flex items-center gap-3 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(selectedIntakes[item.id])} onChange={(event) => { setSelectedIntakes((current) => ({ ...current,[item.id]: event.target.checked })); setDirty(true); }} /> {item.name}</label>)}</div></Card>
      <Card eyebrow="Editorial" title="Content sections" description="All public country sections are edited here; no separate section save."><div className="flex justify-end"><button type="button" onClick={() => { setSections((rows) => [...rows,{ ...blankSection }]); setDirty(true); }} className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]">+ Add section</button></div><div className="mt-5 space-y-5">{sections.length === 0 ? <Empty text="No editorial sections yet." /> : sections.map((row,index) => <CountrySection key={row.id ?? `section-${index}`} index={index} row={row} media={media} onChange={(patch) => updateSection(index,patch)} onRemove={() => removeSection(index)} />)}</div></Card>
      <Card eyebrow="Questions" title="FAQs" description="FAQs are part of the country save flow."><div className="flex justify-end"><button type="button" onClick={() => { setFaqs((rows) => [...rows,blankFaq()]); setDirty(true); }} className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]">+ Add FAQ</button></div><div className="mt-5 space-y-4">{faqs.length === 0 ? <Empty text="No FAQs yet." /> : faqs.map((row,index) => <div key={row.id ?? `faq-${index}`} className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"><div className="flex justify-between"><h4 className="font-semibold">FAQ {index + 1}</h4><button type="button" onClick={() => removeFaq(index)} className="text-sm font-semibold text-[#B42318]">Remove</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Question" value={row.question} onChange={(value) => updateFaq(index,{ question:value })} span /><Input label="Answer" value={row.answer} onChange={(value) => updateFaq(index,{ answer:value })} textarea span rows={4} /><Input label="Category" value={row.category} onChange={(value) => updateFaq(index,{ category:value })} /><Input label="Display order" value={row.displayOrder} onChange={(value) => updateFaq(index,{ displayOrder:value })} type="number" /><BooleanField label="Featured FAQ" checked={row.isFeatured} onChange={(checked) => updateFaq(index,{ isFeatured:checked })} /></div></div>)}</div></Card>
      <Card eyebrow="Guidance" title="Consultant cards" description="Optional guidance cards are staged here and saved with the country."><div className="flex justify-end"><button type="button" onClick={() => { setCards((rows) => [...rows,blankCard()]); setDirty(true); }} className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]">+ Add guidance card</button></div><div className="mt-5 space-y-5">{cards.length === 0 ? <Empty text="No guidance cards yet." /> : cards.map((row,index) => <div key={row.id ?? `card-${index}`} className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"><div className="flex justify-between"><h4 className="font-semibold">Guidance card {index + 1}</h4><button type="button" onClick={() => removeCard(index)} className="text-sm font-semibold text-[#B42318]">Remove</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Input label="Title" value={row.title} onChange={(value) => updateCard(index,{ title:value, slug: row.slug || slugify(value) })} /><Input label="Slug" value={row.slug} onChange={(value) => updateCard(index,{ slug:value })} /><Input label="Short description" value={row.shortDescription} onChange={(value) => updateCard(index,{ shortDescription:value })} textarea span /><Input label="Overview" value={row.overview} onChange={(value) => updateCard(index,{ overview:value })} textarea span /><MediaPickerDialog label="Icon media" value={row.iconMediaId} media={media} onChange={(value) => updateCard(index,{ iconMediaId:value })} /><MediaPickerDialog label="Featured media" value={row.featuredMediaId} media={media} onChange={(value) => updateCard(index,{ featuredMediaId:value })} /><Input label="CTA label" value={row.ctaLabel} onChange={(value) => updateCard(index,{ ctaLabel:value })} /><Input label="CTA URL" value={row.ctaUrl} onChange={(value) => updateCard(index,{ ctaUrl:value })} /><Input label="Display order" value={row.displayOrder} onChange={(value) => updateCard(index,{ displayOrder:value })} type="number" /><BooleanField label="Free consultation" checked={row.isFreeConsultation} onChange={(checked) => updateCard(index,{ isFreeConsultation:checked })} /><BooleanField label="Featured card" checked={row.isFeatured} onChange={(checked) => updateCard(index,{ isFeatured:checked })} /></div></div>)}</div></Card>
      <UnifiedSeoFields value={seo} onChange={(next) => { setSeo(next); setDirty(true); }} media={media} />
      <UnifiedEditorActions cancelHref="/countries" busy={saving} savingIntent={savingIntent} published={record?.status === 'PUBLISHED'} />
    </form></section>;
}

function Card({ eyebrow,title,description,children }: { eyebrow:string; title:string; description:string; children:React.ReactNode }) { return <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8"><legend className="sr-only">{title}</legend><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1657CF]">{eyebrow}</p><h3 className="mt-2 text-xl font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#667085]">{description}</p><div className="mt-6">{children}</div></fieldset>; }
function Empty({ text }: { text:string }) { return <div className="rounded-xl bg-[#F8FAFC] p-5 text-sm text-[#667085]">{text}</div>; }
function Input({ label,value,onChange,type='text',textarea=false,span=false,rows=3 }: { label:string; value:string; onChange:(value:string)=>void; type?:string; textarea?:boolean; span?:boolean; rows?:number }) { const id = `country-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`; return <div className={`text-sm font-semibold ${span ? 'sm:col-span-2' : ''}`}><FieldLabel label={label} htmlFor={id} />{textarea ? <textarea id={id} rows={rows} className={input} value={value} onChange={(event) => onChange(event.target.value)} /> : <input id={id} type={type} className={input} value={value} onChange={(event) => onChange(event.target.value)} />}</div>; }
function Select({ label,value,onChange,options }: { label:string; value:string; onChange:(value:string)=>void; options:Array<{id:string;label:string}> }) { const id = `country-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`; return <div className="text-sm font-semibold"><FieldLabel label={label} htmlFor={id} /><select id={id} className={input} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>; }
function BooleanField({ label,checked,onChange }: { label:string; checked:boolean; onChange:(checked:boolean)=>void }) { return <label className="flex items-center gap-3 self-end rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>; }
function CountrySection({ index,row,media,onChange,onRemove }: { index:number; row:SectionRow; media:EditorialMedia[]; onChange:(patch:Partial<SectionRow>)=>void; onRemove:()=>void }) { return <div className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"><div className="flex justify-between"><h4 className="font-semibold">Content section {index + 1}</h4><button type="button" onClick={onRemove} className="text-sm font-semibold text-[#B42318]">Remove</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Select label="Section key" value={row.sectionKey} onChange={(value) => onChange({ sectionKey:value as SectionRow['sectionKey'] })} options={SECTION_KEYS.map((id) => ({ id,label:id }))} /><Select label="Section type" value={row.sectionType} onChange={(value) => onChange({ sectionType:value as SectionType })} options={SECTION_TYPES.map((id) => ({ id,label:id.replaceAll('_',' ') }))} /><Input label="Eyebrow" value={row.eyebrow} onChange={(value) => onChange({ eyebrow:value })} /><Input label="Heading" value={row.heading} onChange={(value) => onChange({ heading:value })} /><Input label="Subheading" value={row.subheading} onChange={(value) => onChange({ subheading:value })} textarea span /><Input label="Display order" value={String(row.displayOrder)} onChange={(value) => onChange({ displayOrder:Number(value) || 0 })} type="number" /><MediaPickerDialog label="Primary media" value={row.primaryMediaId} media={media} onChange={(value) => onChange({ primaryMediaId:value })} /><MediaPickerDialog label="Secondary media" value={row.secondaryMediaId} media={media} onChange={(value) => onChange({ secondaryMediaId:value })} /><Input label="CTA label" value={row.ctaLabel} onChange={(value) => onChange({ ctaLabel:value })} /><Input label="CTA URL" value={row.ctaUrl} onChange={(value) => onChange({ ctaUrl:value })} /></div><div className="mt-5"><TypedBodyEditor type={row.sectionType} value={row.body} onChange={(body) => onChange({ body })} /></div></div>; }
