'use client';

import { useId, useState } from 'react';

/**
 * The design's "read more" for long editorial copy: the lead stays on the
 * page and the rest opens under a toggle, so a guide's overview does not
 * push every section after it a screen further down.
 */
export function Longform({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="longform">
      <button
        className="longform__toggle"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span>{open ? 'Show less' : label}</span>
        <span className="plus" aria-hidden="true">
          +
        </span>
      </button>
      <div className="longform__body" id={id} data-open={String(open)}>
        {children}
      </div>
    </div>
  );
}
