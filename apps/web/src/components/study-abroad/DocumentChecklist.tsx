'use client';

import { useId, useState } from 'react';
import { RichText } from '@/components/phase1/RichText';

/**
 * The documents list as the design builds it: a checklist the student ticks
 * off as they collect each item, with a running count underneath.
 *
 * Each row is one checkbox named by the document alone, so a screen reader
 * says "Passport, checkbox, not checked" rather than reading the whole
 * description as the control's name.
 */
export type ChecklistDocument = {
  id: string;
  name: string;
  isRequired: boolean;
  details: string | null;
};

export function DocumentChecklist({ documents }: { documents: ChecklistDocument[] }) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const base = useId().replace(/:/g, '');
  const toggle = (id: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const done = checked.size;
  const total = documents.length;

  return (
    <>
      <div className="docs">
        {documents.map((document, index) => {
          const on = checked.has(document.id);
          return (
            <div
              className="doc"
              key={document.id}
              role="checkbox"
              aria-checked={on}
              aria-labelledby={`${base}-${document.id}-n`}
              aria-describedby={document.details ? `${base}-${document.id}-d` : undefined}
              tabIndex={0}
              data-checked={String(on)}
              onClick={() => toggle(document.id)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  toggle(document.id);
                }
              }}
            >
              <span className="doc__box" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </span>
              <span className="doc__n" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <div className="doc__name" id={`${base}-${document.id}-n`}>
                  {document.name}
                </div>
                {document.details ? (
                  <div className="doc__desc" id={`${base}-${document.id}-d`}>
                    <RichText value={document.details} />
                  </div>
                ) : null}
              </div>
              <span className="doc__badge">
                <span className={`badge ${document.isRequired ? 'badge--req' : 'badge--neutral'}`}>
                  {document.isRequired ? 'Required' : 'Optional'}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="docs__foot">
        <div className="docs__progress">
          <span className="docs__bar" aria-hidden="true">
            <i style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
          </span>
          <span aria-live="polite">
            {done} of {total} collected
          </span>
        </div>
        <button className="linkcta" type="button" data-open-assessment data-intent="checklist">
          Get the Checklist{' '}
          <span className="linkcta__arrow" aria-hidden="true">
            &rarr;
          </span>
        </button>
      </div>
    </>
  );
}
