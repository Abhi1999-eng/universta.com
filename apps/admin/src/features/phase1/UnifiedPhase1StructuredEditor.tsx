'use client';

import { useRef } from 'react';
import { Phase1StructuredEditor } from './Phase1StructuredEditor';

type Props = {
  resource: string;
  recordId?: string;
  onSaved: () => Promise<void>;
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

  function submit(intent: 'draft' | 'publish') {
    const form = root.current?.querySelector<HTMLFormElement>('form');
    if (!form) return;

    const publishLabel = Array.from(form.querySelectorAll('label')).find((node) =>
      node.textContent?.includes('Publish state'),
    );
    const select = publishLabel?.querySelector<HTMLSelectElement>('select');
    if (!select) return;

    const next = intent === 'publish' ? 'PUBLISHED' : 'DRAFT';
    if (select.value !== next) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )?.set;
      setter?.call(select, next);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // React applies the controlled status update before the existing submit
    // handler builds its payload. No alternate API/save path is introduced.
    window.setTimeout(() => form.requestSubmit(), 0);
  }

  return (
    <div ref={root} className="unified-phase1-editor">
      <Phase1StructuredEditor {...props} />
      <div className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E0EA] bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.12)] backdrop-blur">
        <div>
          <p className="text-sm font-semibold text-[#1D2939]">
            One record, one save flow
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            Every field above is saved together. Draft keeps the record private;
            Publish saves the same complete form and makes it live.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
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
            className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white"
          >
            Publish
          </button>
        </div>
      </div>
      <style jsx global>{`
        .unified-phase1-editor form > fieldset > div:last-child {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
