'use client';

import { useId } from 'react';
import type { CourseFaqRecord, CourseSectionRecord, EditorialMedia } from '../catalog.types';
import { MediaPickerDialog } from './MediaPickerDialog';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { RichTextEditor } from '@/features/shared/RichTextEditor';
import { variablesForContext, type EditorVariableContext } from '@/features/shared/variable-autocomplete';

/**
 * Content sections and FAQs as the course editor has them, for any record
 * that carries its own: a draft per row, a blank row always open, rows
 * written back one by one when the record is saved. The specialization
 * editor is the first other user.
 */

export type SectionDraft = {
  id?: string;
  updatedAt?: string;
  sectionKey: string;
  sectionType: string;
  heading: string;
  subheading: string;
  bodyText: string;
  mediaId: string;
  status: string;
  displayOrder: string;
};
export type FaqDraft = {
  id?: string;
  updatedAt?: string;
  question: string;
  answer: string;
  status: string;
  displayOrder: string;
};

export const SECTION_TYPES = ['RICH_TEXT', 'CHECKLIST', 'STEPS', 'FACT_GRID', 'CARD_GRID'] as const;

export const sectionBlank = (sectionKey: string): SectionDraft => ({ sectionKey, sectionType: 'RICH_TEXT', heading: '', subheading: '', bodyText: '', mediaId: '', status: 'ACTIVE', displayOrder: '0' });
export const faqBlank = (): FaqDraft => ({ question: '', answer: '', status: 'ACTIVE', displayOrder: '0' });

/** A row counts once something has been written in it, or it was saved before. */
export const sectionUsed = (row: SectionDraft) => Boolean(row.id || row.heading.trim() || row.bodyText.trim() || row.subheading.trim() || row.mediaId);
export const faqUsed = (row: FaqDraft) => Boolean(row.id || row.question.trim() || row.answer.trim());

export function sectionBodyText(body: Record<string, unknown> | null) {
  if (!body) return '';
  if (Array.isArray(body.paragraphs)) return body.paragraphs.filter((x): x is string => typeof x === 'string').join('\n\n');
  const values: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number') values.push(String(value));
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(collect);
  };
  collect(body);
  return values.join('\n');
}

export function sectionFromRecord(row: CourseSectionRecord): SectionDraft {
  return {
    id: row.id,
    updatedAt: row.updatedAt,
    sectionKey: row.sectionKey,
    sectionType: row.sectionType,
    heading: row.heading ?? '',
    subheading: row.subheading ?? '',
    bodyText: sectionBodyText(row.bodyJson),
    mediaId: row.media?.id ?? '',
    status: row.status,
    displayOrder: String(row.displayOrder),
  };
}
export function faqFromRecord(row: CourseFaqRecord): FaqDraft {
  return { id: row.id, updatedAt: row.updatedAt, question: row.question, answer: row.answer, status: row.status, displayOrder: String(row.displayOrder) };
}

/** The body as the API stores it: one rich-text block, or the lines of a
 * checklist or the steps, read off the text an editor typed. */
export function bodyJson(text: string, type: string) {
  if (type === 'RICH_TEXT') return { paragraphs: text.trim() ? [text.trim()] : [] };
  const paragraphs = text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  if (type === 'CHECKLIST') return { paragraphs, items: lines };
  if (type === 'STEPS') return { paragraphs, steps: lines.map((value, index) => ({ order: index + 1, text: value })) };
  return { paragraphs };
}

export function sectionPayload(row: SectionDraft) {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    sectionKey: row.sectionKey.trim(),
    sectionType: row.sectionType,
    heading: optional(row.heading),
    subheading: optional(row.subheading),
    bodyJson: bodyJson(row.bodyText, row.sectionType),
    ...(row.mediaId ? { mediaId: row.mediaId } : {}),
    status: row.status,
    displayOrder: Number(row.displayOrder) || 0,
    ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}),
  };
}
export function faqPayload(row: FaqDraft) {
  return {
    question: row.question.trim(),
    answer: row.answer.trim(),
    status: row.status,
    displayOrder: Number(row.displayOrder) || 0,
    ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}),
  };
}

/** What stops a save, in the words the issues list uses. */
export function sectionIssues(rows: SectionDraft[], keys: readonly string[]) {
  const next: string[] = [];
  const seen = new Set<string>();
  rows.filter(sectionUsed).forEach((row, index) => {
    const label = `Content section ${index + 1}`;
    if (!row.sectionKey.trim()) next.push(`${label}: choose what the section is about.`);
    else if (!keys.includes(row.sectionKey)) next.push(`${label}: "${row.sectionKey}" is not one of the section kinds.`);
    else if (seen.has(row.sectionKey)) next.push(`${label}: there is already a "${row.sectionKey}" section; each kind can appear once.`);
    seen.add(row.sectionKey);
    if (!/^\d+$/.test(row.displayOrder)) next.push(`${label}: display order must be a whole number.`);
  });
  return next;
}
/** `blankOrder`: a blank display order is allowed and means the row's place
 * on screen, as on a level page. */
export function faqIssues(rows: FaqDraft[], { blankOrder = false }: { blankOrder?: boolean } = {}) {
  const next: string[] = [];
  rows.filter(faqUsed).forEach((row, index) => {
    if (!row.question.trim() || !row.answer.trim()) next.push(`FAQ ${index + 1}: both question and answer are required.`);
    if (!(blankOrder && row.displayOrder.trim() === '') && !/^\d+$/.test(row.displayOrder)) next.push(`FAQ ${index + 1}: display order must be a whole number.`);
  });
  return next;
}

const input = 'p-input';
const prettyKey = (key: string) => key.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function Field({ label, value, onChange, type = 'text', textarea = false, span = false, rows = 3, required = false, idPrefix }: { label: string; value: string; onChange: (value: string) => void; type?: string; textarea?: boolean; span?: boolean; rows?: number; required?: boolean; idPrefix: string }) {
  const reactId = useId();
  const id = `${idPrefix}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <div className={`text-sm font-semibold ${span ? 'sm:col-span-full' : ''}`}><FieldLabel label={label} htmlFor={id} required={required} />{textarea ? <textarea id={id} required={required} aria-required={required} rows={rows} className={input} value={value} onChange={(event) => onChange(event.target.value)} /> : <input id={id} required={required} aria-required={required} type={type} className={input} value={value} onChange={(event) => onChange(event.target.value)} />}</div>;
}
function Choice({ label, value, onChange, options, required = false, idPrefix }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; label: string }>; required?: boolean; idPrefix: string }) {
  const reactId = useId();
  const id = `${idPrefix}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <div className="text-sm font-semibold"><FieldLabel label={label} htmlFor={id} required={required} /><select id={id} required={required} aria-required={required} className={input} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>;
}

export function ContentSectionsCard({ idPrefix, rows, keys, media, variableContext, onChange, onAdd, onRemove }: {
  idPrefix: string;
  rows: SectionDraft[];
  /** What a section can be about, in the order offered. */
  keys: readonly string[];
  media: EditorialMedia[];
  /** Which record's variables the rich text may name; none when the page
   * resolves none. */
  variableContext?: EditorVariableContext;
  onChange: (index: number, patch: Partial<SectionDraft>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <fieldset className="p-panel">
      <legend className="sr-only">Content sections</legend>
      <p className="p-eyebrow">Editorial</p>
      <h3 className="p-h3">Content sections</h3>
      <p className="p-sub">The first section is open already. Add more only when there is something to say; a section with nothing written is not saved.</p>
      <div className="mt-6">
        <div className="mb-5 flex justify-end"><button type="button" onClick={onAdd} className="p-btn p-btn--outline p-btn--sm">+ Add another section</button></div>
        <div className="space-y-5">
          {rows.map((row, index) => {
            const used = sectionUsed(row);
            return (
              <div key={row.id ?? `section-${index}`} className="p-panel">
                <div className="flex justify-between gap-3"><h4 className="font-semibold">Content section {index + 1}</h4>{index > 0 || row.id ? <button type="button" onClick={() => onRemove(index)} className="p-danger">Remove</button> : null}</div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Choice idPrefix={idPrefix} label="About" value={row.sectionKey} onChange={(value) => onChange(index, { sectionKey: value })} options={keys.map((key) => ({ id: key, label: prettyKey(key) }))} required={used} />
                  <Choice idPrefix={idPrefix} label="Section type" value={row.sectionType} onChange={(value) => onChange(index, { sectionType: value })} options={SECTION_TYPES.map((id) => ({ id, label: id.replaceAll('_', ' ') }))} required={used} />
                  <Field idPrefix={idPrefix} label="Heading" value={row.heading} onChange={(value) => onChange(index, { heading: value })} />
                  <Field idPrefix={idPrefix} label="Subheading" value={row.subheading} onChange={(value) => onChange(index, { subheading: value })} />
                  {row.sectionType === 'RICH_TEXT'
                    ? <div className="sm:col-span-full"><RichTextEditor label="Body" value={row.bodyText} onChange={(bodyText) => onChange(index, { bodyText })} allowedVariables={variablesForContext(variableContext)} entityContext={variableContext ? { variableContext } : undefined} media={media} /></div>
                    : <Field idPrefix={idPrefix} label="Body" value={row.bodyText} onChange={(value) => onChange(index, { bodyText: value })} textarea span rows={6} />}
                  <MediaPickerDialog label="Section media" value={row.mediaId} media={media} onChange={(value) => onChange(index, { mediaId: value })} />
                  <Choice idPrefix={idPrefix} label="Status" value={row.status} onChange={(value) => onChange(index, { status: value })} options={[{ id: 'ACTIVE', label: 'Active' }, { id: 'INACTIVE', label: 'Inactive' }]} />
                  <Field idPrefix={idPrefix} label="Display order" value={row.displayOrder} onChange={(value) => onChange(index, { displayOrder: value })} type="number" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

export function FaqsCard({ idPrefix, rows, onChange, onAdd, onRemove }: {
  idPrefix: string;
  rows: FaqDraft[];
  onChange: (index: number, patch: Partial<FaqDraft>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <fieldset className="p-panel">
      <legend className="sr-only">FAQs</legend>
      <p className="p-eyebrow">Questions</p>
      <h3 className="p-h3">FAQs</h3>
      <p className="p-sub">The first FAQ is open already. Leave it blank if there is nothing to ask yet.</p>
      <div className="mt-6">
        <div className="mb-5 flex justify-end"><button type="button" onClick={onAdd} className="p-btn p-btn--outline p-btn--sm">+ Add another FAQ</button></div>
        <div className="space-y-4">
          {rows.map((row, index) => {
            const used = faqUsed(row);
            return (
              <div key={row.id ?? `faq-${index}`} className="p-panel">
                <div className="flex justify-between gap-3"><h4 className="font-semibold">FAQ {index + 1}</h4>{rows.length > 1 || row.id ? <button type="button" onClick={() => onRemove(index)} className="p-danger">Remove</button> : null}</div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field idPrefix={idPrefix} label="Question" value={row.question} onChange={(value) => onChange(index, { question: value })} span required={used} />
                  <Field idPrefix={idPrefix} label="Answer" value={row.answer} onChange={(value) => onChange(index, { answer: value })} textarea span rows={4} required={used} />
                  <Choice idPrefix={idPrefix} label="Status" value={row.status} onChange={(value) => onChange(index, { status: value })} options={[{ id: 'ACTIVE', label: 'Active' }, { id: 'INACTIVE', label: 'Inactive' }]} />
                  <Field idPrefix={idPrefix} label="Display order" value={row.displayOrder} onChange={(value) => onChange(index, { displayOrder: value })} type="number" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
