'use client';

import type { CatalogLevel, MasterRecord } from './catalog.types';

/** The study levels a subject or a specialization is offered at, as ticks
 * over the active course levels. The public pages add these to the levels
 * they work out from published courses, so a level can be shown before any
 * course is filed under it; `implied` names the ones courses already stand
 * at, so an editor can see what the ticks add. */
export function StudyLevelTicks({
  idPrefix,
  levels,
  value,
  implied = [],
  hint = 'Tick the levels this is offered at. Levels that already have a published course show on the site either way.',
  onChange,
}: {
  idPrefix: string;
  levels: MasterRecord[];
  value: string[];
  implied?: CatalogLevel[];
  /** What the ticks do here, under the heading. */
  hint?: string;
  onChange: (next: string[]) => void;
}) {
  const ordered = [...levels].sort(
    (a, b) => (a.educationOrder ?? 0) - (b.educationOrder ?? 0) || a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
  );
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...new Set([...value, id])] : value.filter((item) => item !== id));
  return (
    <fieldset id={`${idPrefix}-levels`} className="p-panel">
      <legend className="sr-only">Study levels</legend>
      <p className="p-eyebrow">Study levels</p>
      <h3 className="mt-2 text-xl font-semibold">Study levels</h3>
      <p className="p-sub">{hint}</p>
      {ordered.length === 0 ? (
        <p className="p-hint mt-4">No active study level yet. Add levels under “All levels” first.</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          {ordered.map((level) => {
            const checked = value.includes(level.id);
            const fromCourses = implied.some((item) => item.id === level.id);
            return (
              <label key={level.id} htmlFor={`${idPrefix}-level-${level.id}`} className={`p-btn ${checked ? 'p-btn--outline' : 'p-btn--ghost'}`}>
                <input id={`${idPrefix}-level-${level.id}`} type="checkbox" checked={checked} onChange={(event) => toggle(level.id, event.target.checked)} />
                {' '}{level.name}
                {fromCourses ? <span className="p-hint ml-1" title="A published course already stands at this level.">(has courses)</span> : null}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
