'use client';

import Link from 'next/link';

type Props = {
  cancelHref: string;
  busy?: boolean;
  draftLabel?: string;
  publishLabel?: string;
  savingIntent?: 'draft' | 'publish' | null;
  published?: boolean;
};

export function UnifiedEditorActions({
  cancelHref,
  busy = false,
  draftLabel = 'Save draft',
  publishLabel = 'Publish',
  savingIntent = null,
  published = false,
}: Props) {
  return (
    <div className="sticky bottom-4 z-30 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9E0EA] bg-white/95 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.12)] backdrop-blur">
      <div>
        <p className="text-sm font-semibold text-[#1D2939]">One record, one save flow</p>
        <p className="mt-1 text-xs text-[#667085]">
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
          className="rounded-xl border border-[#1657CF] bg-white px-5 py-3 text-sm font-semibold text-[#1657CF] disabled:opacity-50"
        >
          {savingIntent === 'draft' ? 'Saving…' : published ? 'Move to draft' : draftLabel}
        </button>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={busy}
          className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {savingIntent === 'publish' ? 'Publishing…' : publishLabel}
        </button>
      </div>
    </div>
  );
}
