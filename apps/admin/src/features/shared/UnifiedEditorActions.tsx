'use client';

import Link from 'next/link';

type Props = {
  cancelHref: string;
  busy?: boolean;
  draftLabel?: string;
  publishLabel?: string;
  savingIntent?: 'draft' | 'publish' | null;
  published?: boolean;
  sticky?: boolean;
};

export function UnifiedEditorActions({
  cancelHref,
  busy = false,
  draftLabel = 'Save draft',
  publishLabel = 'Publish',
  savingIntent = null,
  published = false,
  sticky = true,
}: Props) {
  return (
    <div
      className={`${sticky ? 'sticky bottom-4 z-30 bg-white/95 shadow-[0_14px_40px_rgba(15,23,42,0.12)] backdrop-blur' : 'bg-white'} mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E0EA] p-4`}
    >
      <div>
        <p >One record, one save flow</p>
        <p className="p-hint">
          Every section on this page is saved together. Draft keeps it private; Publish makes the complete record live.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={cancelHref} className="rounded-xl border border-[#D9E0EA] px-5 py-3 text-sm font-semibold text-[#344054]">
          Cancel
        </Link>
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={busy}
          className="p-btn p-btn--outline"
        >
          {savingIntent === 'draft' ? 'Saving…' : published ? 'Move to draft' : draftLabel}
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={busy}
          className="p-btn p-btn--primary"
        >
          {savingIntent === 'publish' ? 'Publishing…' : publishLabel}
        </button>
      </div>
    </div>
  );
}
