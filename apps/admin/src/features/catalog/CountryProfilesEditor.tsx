'use client';

import { useEffect, useMemo, useState } from 'react';
import { deleteCountryProfile, getCountryProfiles, listIntakeOptions, putCountryProfile } from './catalog-client';
import type { CatalogMutationError, CountryProfileBundle, IntakeOption } from './catalog.types';

type ProfileKind = 'cost' | 'work' | 'language' | 'statistics';
type Values = Record<string, string | boolean>;
const sourceFields = ['sourceReference', 'verifiedAt'];
const fields: Record<ProfileKind, string[]> = {
  cost: ['currencyCode', 'currencySymbol', 'tuitionMin', 'tuitionMax', 'tuitionPeriod', 'budgetBand', 'livingCostMin', 'livingCostMax', 'applicableYear', ...sourceFields],
  work: ['partTimeHoursPerWeek', 'postStudyWorkMinMonths', 'postStudyWorkMaxMonths', 'immigrationPathwayStrength', 'visaSuccessBand', 'visaSuccessPercentage', ...sourceFields],
  language: ['ieltsRequirement', 'ieltsMinScore', 'pteRequirement', 'pteMinScore', 'toeflRequirement', 'toeflMinScore', 'duolingoRequirement', 'duolingoMinScore', ...sourceFields],
  statistics: ['universitiesCount', 'publicUniversitiesCount', 'coursesCount', 'ugCoursesCount', 'pgCoursesCount', 'topRankedUniversitiesCount', ...sourceFields],
};
const labels: Record<string, string> = { currencyCode: 'Currency code', currencySymbol: 'Currency symbol', tuitionMin: 'Tuition minimum', tuitionMax: 'Tuition maximum', tuitionPeriod: 'Tuition period', budgetBand: 'Budget band', livingCostMin: 'Living cost minimum', livingCostMax: 'Living cost maximum', applicableYear: 'Applicable year', partTimeHoursPerWeek: 'Part-time hours/week', postStudyWorkMinMonths: 'Post-study months minimum', postStudyWorkMaxMonths: 'Post-study months maximum', immigrationPathwayStrength: 'Pathway strength', visaSuccessBand: 'Visa success band', visaSuccessPercentage: 'Visa success percentage', ieltsRequirement: 'IELTS requirement', ieltsMinScore: 'IELTS minimum score', pteRequirement: 'PTE requirement', pteMinScore: 'PTE minimum score', toeflRequirement: 'TOEFL requirement', toeflMinScore: 'TOEFL minimum score', duolingoRequirement: 'Duolingo requirement', duolingoMinScore: 'Duolingo minimum score', universitiesCount: 'Universities', publicUniversitiesCount: 'Public universities', coursesCount: 'Courses', ugCoursesCount: 'UG courses', pgCoursesCount: 'PG courses', topRankedUniversitiesCount: 'Top-ranked universities', sourceReference: 'Source URL', verifiedAt: 'Verified at' };
const defaults: Record<ProfileKind, Values> = { cost: { currencyCode: 'CAD', currencySymbol: '$', tuitionPeriod: 'PER_YEAR', budgetBand: 'MID_RANGE' }, work: { partTimeAllowed: false, postStudyWorkAvailable: false, immigrationPathwayStrength: 'NOT_PUBLISHED', visaSuccessBand: 'NOT_PUBLISHED' }, language: { ieltsRequirement: 'VARIES', pteRequirement: 'VARIES', toeflRequirement: 'VARIES', duolingoRequirement: 'VARIES', languageWaiverAvailable: false }, statistics: { sourceMode: 'MANUAL' } };

function recordValue(record: Record<string, unknown> | null, key: string, kind: ProfileKind): string | boolean {
  const candidate = record?.[key];
  if (typeof candidate === 'boolean') return candidate;
  if (candidate !== undefined && candidate !== null) return String(candidate);
  return defaults[kind][key] ?? '';
}

export function CountryProfilesEditor({ countryId }: { countryId: string }) {
  const [bundle, setBundle] = useState<CountryProfileBundle | null>(null);
  const [intakeOptions, setIntakeOptions] = useState<IntakeOption[]>([]);
  const [values, setValues] = useState<Record<ProfileKind, Values>>(defaults);
  const [versions, setVersions] = useState<Record<ProfileKind, string | undefined>>({ cost: undefined, work: undefined, language: undefined, statistics: undefined });
  const [selectedIntakes, setSelectedIntakes] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<ProfileKind | 'intakes' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([getCountryProfiles(countryId), listIntakeOptions()]).then(([profiles, options]) => {
      setBundle(profiles.data); setIntakeOptions(options.data);
      const next = { ...values };
      (['cost', 'work', 'language', 'statistics'] as ProfileKind[]).forEach((kind) => {
        const record = profiles.data[kind];
        if (record) { next[kind] = { ...defaults[kind] }; fields[kind].forEach((key) => { next[kind][key] = recordValue(record, key, kind); }); }
      });
      setValues(next);
      setVersions({ cost: profiles.data.cost?.updatedAt as string | undefined, work: profiles.data.work?.updatedAt as string | undefined, language: profiles.data.language?.updatedAt as string | undefined, statistics: profiles.data.statistics?.updatedAt as string | undefined });
      const selected: Record<string, boolean> = {}; profiles.data.intakes.forEach((item) => { if (typeof item.intakeId === 'string') selected[item.intakeId] = true; }); setSelectedIntakes(selected);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load country profiles'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId]);

  const update = (kind: ProfileKind, key: string, next: string | boolean) => setValues((current) => ({ ...current, [kind]: { ...current[kind], [key]: next } }));
  const errorDetails = (cause: unknown) => { const typed = cause as Partial<CatalogMutationError>; setError(typed.message ?? 'Unable to save profile'); };
  async function save(kind: ProfileKind) {
    setSaving(kind); setMessage(''); setError('');
    try { const result = await putCountryProfile(countryId, kind, { ...values[kind], expectedUpdatedAt: versions[kind] }); const record = result.data as Record<string, unknown>; setVersions((current) => ({ ...current, [kind]: typeof record.updatedAt === 'string' ? record.updatedAt : current[kind] })); setMessage(`${kind} profile saved.`); }
    catch (cause: unknown) { errorDetails(cause); } finally { setSaving(null); }
  }
  async function remove(kind: ProfileKind) {
    setSaving(kind); setMessage(''); setError('');
    try { await deleteCountryProfile(countryId, kind, versions[kind]); setVersions((current) => ({ ...current, [kind]: undefined })); setMessage(`${kind} profile removed.`); }
    catch (cause: unknown) { errorDetails(cause); } finally { setSaving(null); }
  }
  async function saveIntakes() {
    setSaving('intakes'); setMessage(''); setError('');
    try { const expectedUpdatedAt = bundle?.intakes.map((item) => typeof item.updatedAt === 'string' ? item.updatedAt : '').filter(Boolean).sort().at(-1); const result = await putCountryProfile(countryId, 'intakes', { expectedUpdatedAt, intakes: Object.entries(selectedIntakes).filter(([, checked]) => checked).map(([intakeId]) => ({ intakeId, isMajor: true, availabilityStatus: 'AVAILABLE' })) }); const returned = result.data as { intakes?: Array<Record<string, unknown>> }; setBundle((current) => current ? { ...current, intakes: returned.intakes ?? current.intakes } : current); setMessage('Intakes saved.'); }
    catch (cause: unknown) { errorDetails(cause); } finally { setSaving(null); }
  }
  const profileSections = useMemo(() => ['cost', 'work', 'language', 'statistics'] as ProfileKind[], []);
  if (!bundle) return <section className="mt-8 rounded-2xl border border-[#E8ECF3] bg-white p-6"><p className="text-sm text-[#667085]">Loading structured profiles…</p></section>;
  return <section className="mt-8 space-y-6" aria-labelledby="country-profiles-heading"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Structured profile data</p><h2 id="country-profiles-heading" className="mt-2 text-2xl font-semibold">Profile editors</h2><p className="mt-2 text-sm leading-6 text-[#667085]">Manage verified, structured facts. Public APIs hide unverified optional facts.</p></div>{message ? <p role="status" className="rounded-xl bg-[#E9F8F0] px-4 py-3 text-sm font-semibold text-[#18794E]">{message}</p> : null}{error ? <p role="alert" className="rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] px-4 py-3 text-sm text-[#B42318]">{error}</p> : null}{profileSections.map((kind) => <ProfileSection key={kind} kind={kind} values={values[kind]} saving={saving === kind} onChange={(key, next) => update(kind, key, next)} onSave={() => void save(kind)} onDelete={() => void remove(kind)} />)}<fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8"><legend className="sr-only">Intakes</legend><h3 className="text-xl font-semibold">Intakes</h3><p className="mt-2 text-sm text-[#667085]">Select active intake masters and mark them as major for public summaries.</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{intakeOptions.map((item) => <label key={item.id} className="flex items-center gap-3 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(selectedIntakes[item.id])} onChange={(event) => setSelectedIntakes((current) => ({ ...current, [item.id]: event.target.checked }))} className="h-4 w-4 accent-[#1657CF]" />{item.name}</label>)}</div><button type="button" disabled={saving === 'intakes'} onClick={() => void saveIntakes()} className="mt-5 rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{saving === 'intakes' ? 'Saving…' : 'Save intakes'}</button></fieldset></section>;
}

function ProfileSection({ kind, values, saving, onChange, onSave, onDelete }: { kind: ProfileKind; values: Values; saving: boolean; onChange: (key: string, value: string | boolean) => void; onSave: () => void; onDelete: () => void }) {
  const booleanFields = kind === 'work' ? ['partTimeAllowed', 'postStudyWorkAvailable'] : kind === 'language' ? ['languageWaiverAvailable'] : [];
  return <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8"><legend className="sr-only">{kind}</legend><h3 className="text-xl font-semibold capitalize">{kind} profile</h3><div className="mt-5 grid gap-5 sm:grid-cols-2">{booleanFields.map((key) => <label key={key} className="flex items-center gap-3 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(values[key])} onChange={(event) => onChange(key, event.target.checked)} className="h-4 w-4 accent-[#1657CF]" />{labels[key] ?? key}</label>)}{fields[kind].map((key) => <label key={key} className="block text-sm font-semibold">{labels[key] ?? key}<input value={String(values[key] ?? '')} onChange={(event) => onChange(key, event.target.value)} type="text" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal outline-none focus:border-[#1657CF]" /></label>)}</div><div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={onSave} className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Saving…' : `Save ${kind}`}</button><button type="button" disabled={saving} onClick={onDelete} className="rounded-xl border border-[#F2C5C5] px-5 py-3 text-sm font-semibold text-[#B42318] disabled:opacity-40">Remove {kind}</button></div></fieldset>;
}
