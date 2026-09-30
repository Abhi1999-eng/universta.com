'use client';

import { VariableAutocompleteTextControl } from '@/features/shared/VariableAutocompleteTextControl';
import { RichTextEditor } from '@/features/shared/RichTextEditor';
import type { DynamicVariable } from '@/features/shared/variable-autocomplete';
import type { EditorEntityContext } from '@/features/shared/useEntityAutocomplete';
import type { SectionType, TypedBody, TypedRow } from './editor-types';

const emptyRow = (): TypedRow => ({ label: '', value: '', description: '', step: '' });

export function TypedBodyEditor({ type, value, onChange, variables = [], entityContext }: { type: SectionType; value: TypedBody; onChange: (value: TypedBody) => void; variables?: readonly DynamicVariable[]; entityContext?: EditorEntityContext }) {
  if (type === 'CTA') return <RichTextEditor label="Supporting text" ariaLabel="Supporting text" value={value.supportingText ?? ''} onChange={(supportingText) => onChange({ supportingText })} allowedVariables={variables} entityContext={entityContext} minHeight="min-h-28" />;
  /* The caption is the sentence printed under a published image, which is
   * ordinary editorial prose -- it was the one piece of section copy still
   * typed into a bare textarea. */
  if (type === 'MEDIA') return <RichTextEditor label="Media caption" ariaLabel="Media caption" value={value.caption ?? ''} onChange={(caption) => onChange({ caption })} allowedVariables={variables} entityContext={entityContext} enableImages={false} minHeight="min-h-24" />;
  if (type === 'RICH_TEXT') {
    const paragraphs = value.paragraphs ?? [''];
    return <fieldset className="space-y-3"><legend className="text-sm font-semibold">Paragraphs</legend>{paragraphs.map((paragraph, index) => <div className="flex gap-2" key={`paragraph-${index}`}><RichTextEditor label={`Paragraph ${index + 1}`} value={paragraph} onChange={(next) => onChange({ paragraphs: paragraphs.map((item, itemIndex) => itemIndex === index ? next : item) })} allowedVariables={variables} entityContext={entityContext} minHeight="min-h-28" />{paragraphs.length > 1 ? <button type="button" aria-label={`Remove paragraph ${index + 1}`} onClick={() => onChange({ paragraphs: paragraphs.filter((_, itemIndex) => itemIndex !== index) })} className="self-start rounded-lg border px-3 py-2 text-xs font-semibold">Remove</button> : null}</div>)}<button type="button" onClick={() => onChange({ paragraphs: [...paragraphs, ''] })} className="p-btn p-btn--ghost p-btn--sm">Add paragraph</button></fieldset>;
  }

  const rows = value.items ?? [emptyRow()];
  const showStep = type === 'STEPS';
  const showDescription = type !== 'FACT_GRID';
  const update = (index: number, patch: Partial<TypedRow>) => onChange({ items: rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) });
  const move = (index: number, direction: -1 | 1) => {
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(index + direction, 0, item);
    onChange({ items: next });
  };
  return <fieldset className="space-y-3"><legend className="text-sm font-semibold">{type === 'FACT_GRID' ? 'Facts' : type === 'STEPS' ? 'Steps' : 'Cards'}</legend>{rows.map((row, index) => <div className="p-card" key={`row-${index}`}><div className="grid gap-3 sm:grid-cols-2">{showStep ? <Text id={`country-section-row-${index}-step`} label="Step" value={row.step ?? ''} onChange={(step) => update(index, { step })} variables={variables} /> : null}<Text id={`country-section-row-${index}-label`} label={type === 'FACT_GRID' ? 'Label' : 'Title'} value={row.label} onChange={(label) => update(index, { label })} variables={variables} />{/* A fact is a label and a figure, so its value stays a plain control.
        * Cards and steps carry supporting prose instead, which is the WYSIWYG's
        * job -- and only one box for it: the row's `value` and `description`
        * were always written to the same stored key, so the second field was a
        * duplicate that could only disagree with the first. Existing rows are
        * unaffected; nothing has ever been stored under `value` for these two
        * types, and `bodyForApi` still falls back to it for an older draft. */}
      {type === 'FACT_GRID' ? <Text id={`country-section-row-${index}-value`} label="Value" value={row.value} onChange={(rowValue) => update(index, { value: rowValue })} variables={variables} /> : null}{showDescription ? <div className="sm:col-span-2"><RichTextEditor label={`Description ${index + 1}`} ariaLabel={`Description ${index + 1}`} value={row.description || row.value} onChange={(description) => update(index, { description })} allowedVariables={variables} entityContext={entityContext} enableImages={false} minHeight="min-h-20" /></div> : null}</div><div className="mt-3 flex justify-end gap-2">{index > 0 ? <button type="button" onClick={() => move(index, -1)} className="rounded-lg border px-2 py-1 text-xs font-semibold">Move up</button> : null}{index < rows.length - 1 ? <button type="button" onClick={() => move(index, 1)} className="rounded-lg border px-2 py-1 text-xs font-semibold">Move down</button> : null}{rows.length > 1 ? <button type="button" onClick={() => onChange({ items: rows.filter((_, itemIndex) => itemIndex !== index) })} className="rounded-lg border border-[#B42318] px-2 py-1 text-xs font-semibold text-[#B42318]">Remove</button> : null}</div></div>)}<button type="button" onClick={() => onChange({ items: [...rows, emptyRow()] })} className="p-btn p-btn--ghost p-btn--sm">Add row</button></fieldset>;
}

function Text({ id, label, value, onChange, variables }: { id: string; label: string; value: string; onChange: (value: string) => void; variables: readonly DynamicVariable[] }) {
  const className = 'mt-1 w-full rounded-lg border border-[#D9E0EA] px-2 py-2 font-normal';
  return <label className="block text-xs font-semibold">{label}{variables.length ? <VariableAutocompleteTextControl id={id} value={value} onChange={onChange} variables={variables} maxLength={2000} className={className} /> : <input id={id} value={value} onChange={(event) => onChange(event.target.value)} maxLength={2000} className={className} />}</label>;
}
