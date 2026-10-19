'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phase1StructuredEditor } from './Phase1StructuredEditor';

type Props = {
  resource: string;
  recordId?: string;
  /** Says which button saved it, and what the API returned. */
  onSaved: (intent: 'draft' | 'publish', saved?: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
};

/**
 * Phase1StructuredEditor already owns a single field-based form for
 * Universities, Offerings, Scholarships, Consultants, Jobs, Events, Success
 * Stories and Testimonials. This shell standardises its publishing UX with
 * Courses/Subjects/Countries: the internal status select and generic save
 * button are hidden, and the editor exposes only Save draft / Publish.
 *
 * We intentionally keep all of the existing field and validation logic in the
 * proven editor instead of forking eight resource forms. The shell drives the
 * editor's existing controlled status field through a real change event and
 * then submits the same form, so the API payload and validation path remain
 * exactly the same.
 */
export function UnifiedPhase1StructuredEditor(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  /* The inner editor saves through the form's own submit, so the button that
     started it is remembered here and passed on with the result. */
  const intent = useRef<'draft' | 'publish'>('draft');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setForm(root.current?.querySelector<HTMLFormElement>('form') ?? null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [props.recordId, props.resource]);

  function submit(next: 'draft' | 'publish') {
    if (!form) return;
    intent.current = next;

    const publishLabel = Array.from(form.querySelectorAll('label')).find((node) =>
      node.textContent?.includes('Publish state'),
    );
    const select = publishLabel?.querySelector<HTMLSelectElement>('select');
    if (!select) return;

    const status = next === 'publish' ? 'PUBLISHED' : 'DRAFT';
    if (select.value !== status) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )?.set;
      setter?.call(select, status);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // React applies the controlled status update before the existing submit
    // handler builds its payload. No alternate API/save path is introduced.
    window.setTimeout(() => form.requestSubmit(), 0);
  }

  const actions = form ? createPortal(
    <div className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E0EA] bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.12)] backdrop-blur">
      <div>
        <p>
          Save your changes
        </p>
        <p className="p-hint">
          Everything above saves together. Save draft keeps it off the website;
          Publish puts it live.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {/* Named by its visible words. It was announced as "Save changes",
            which it is not: on a published record it takes the record off
            the site. */}
        <button
          type="button"
          onClick={() => submit('draft')}
          className="rounded-xl border border-[#1657CF] bg-white px-5 py-3 text-sm font-semibold text-[#1657CF]"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={() => submit('publish')}
          className="p-btn p-btn--primary"
        >
          Publish
        </button>
      </div>
    </div>,
    form,
  ) : null;

  return (
    <div ref={root} className="unified-phase1-editor">
      <Phase1StructuredEditor
        resource={props.resource}
        recordId={props.recordId}
        onCancel={props.onCancel}
        onSaved={(saved) => props.onSaved(intent.current, saved)}
      />
      {actions}
      <style jsx global>{`
        .unified-phase1-editor [data-testid='structured-editor-save-row'] {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
