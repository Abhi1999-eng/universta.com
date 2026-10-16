'use client';

import { useMemo, useState } from 'react';
import type { CountryRecord } from './catalog.types';

/** The destinations a subject or a specialization is listed for, as ticks
 * over every country. A destination that teaches it through a published
 * course is ticked and locked: the courses say so, not the editor. A new
 * subject starts listed everywhere, as the catalogue does it; a new
 * specialization starts listed nowhere. */
export function DestinationTicks({
  idPrefix,
  countries,
  value,
  derived = [],
  onChange,
  hint,
}: {
  idPrefix: string;
  countries: CountryRecord[];
  value: string[];
  /** Ids a published course already stands behind; shown ticked and locked. */
  derived?: string[];
  onChange: (next: string[]) => void;
  hint?: string;
}) {
  const [q, setQ] = useState('');
  const locked = useMemo(() => new Set(derived), [derived]);
  const ordered = useMemo(() => [...countries].sort((a, b) => a.name.localeCompare(b.name)), [countries]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? ordered.filter((row) => row.name.toLowerCase().includes(needle) || row.slug.includes(needle)) : ordered;
  }, [ordered, q]);
  const ticked = new Set(value);
  const toggle = (id: string, on: boolean) => {
    if (locked.has(id)) return;
    onChange(on ? [...new Set([...value, id])] : value.filter((item) => item !== id));
  };
  const selectedCount = ordered.filter((row) => ticked.has(row.id) || locked.has(row.id)).length;
  return (
    <fieldset id={`${idPrefix}-destinations`} className="p-panel">
      <legend className="sr-only">Destinations</legend>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="p-eyebrow">Destinations</p>
          <h3 className="mt-2 text-xl font-semibold">Destinations</h3>
          <p className="p-sub">{hint ?? 'Tick the countries this is offered in. A country with a published course in it stays ticked on its own.'}</p>
        </div>
        <p className="p-hint">{selectedCount} of {ordered.length} selected</p>
      </div>
      {ordered.length === 0 ? (
        <p className="p-hint mt-4">No countries yet.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="p-field">
              <span className="sr-only">Find a country</span>
              <input className="p-input p-input--sm" placeholder="Find a country" value={q} onChange={(event) => setQ(event.target.value)} />
            </label>
            <button type="button" className="p-btn p-btn--ghost p-btn--sm" onClick={() => onChange([...new Set([...value, ...shown.map((row) => row.id)])])}>Tick all shown</button>
            <button type="button" className="p-btn p-btn--ghost p-btn--sm" onClick={() => onChange(value.filter((id) => !shown.some((row) => row.id === id && !locked.has(id))))}>Untick all shown</button>
          </div>
          <div className="mt-4 grid max-h-[320px] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Destinations">
            {shown.map((row) => {
              const isLocked = locked.has(row.id);
              const checked = isLocked || ticked.has(row.id);
              return (
                <label key={row.id} htmlFor={`${idPrefix}-country-${row.id}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-[#B7C6E8] bg-[#EEF3FF]' : 'border-[#E8ECF3]'}`} title={isLocked ? 'A published course is taught here, so it stays listed.' : undefined}>
                  <input id={`${idPrefix}-country-${row.id}`} type="checkbox" checked={checked} disabled={isLocked} onChange={(event) => toggle(row.id, event.target.checked)} />
                  <span className="flex-1">{row.name}</span>
                  {isLocked ? <span className="p-chip text-xs">has courses</span> : null}
                  {row.status !== 'PUBLISHED' ? <span className="p-hint text-xs">draft</span> : null}
                </label>
              );
            })}
            {shown.length === 0 ? <p className="p-hint">No country matches.</p> : null}
          </div>
        </>
      )}
    </fieldset>
  );
}
