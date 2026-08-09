"use client";

import { sectionLabel } from "./section-registry";

export type StructureEntry = {
  id: string;
  sectionType: string;
  heading?: string | null;
  /** Set when the section is hidden on every device, so the list can say so. */
  hiddenEverywhere?: boolean;
  /** Sections still being added are not yet reorderable on the server. */
  isNew?: boolean;
};

/** The builder's left pane: the page as an ordered list of sections.
 *
 * This is the admin's map of the page. It names sections the way the section
 * library does -- "Questions and answers", not FAQ_GROUP -- and falls back to
 * the section's own heading so two sections of the same type stay tellable
 * apart. */
export function PageStructurePanel({
  entries,
  selectedId,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  onAdd,
}: {
  entries: StructureEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <aside
      className="rounded-2xl border border-[#E8ECF3] bg-white p-4"
      aria-label="Page structure"
      data-testid="page-structure"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Page structure</h3>
        <span className="text-xs text-[#828B9B]">{entries.length}</span>
      </div>

      <ul className="mt-3 space-y-2">
        {entries.map((entry, index) => {
          const selected = entry.id === selectedId;
          const name = entry.heading?.trim() || sectionLabel(entry.sectionType);
          return (
            <li key={entry.id}>
              <div
                className={`rounded-xl border p-2 ${
                  selected
                    ? "border-[#1657CF] bg-[#F2F7FF]"
                    : "border-[#E8ECF3] bg-white"
                }`}
                data-testid={`structure-item-${entry.id}`}
                data-selected={selected ? "true" : "false"}
              >
                <button
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  className="block w-full text-left"
                  aria-current={selected ? "true" : undefined}
                >
                  <span className="block truncate text-sm font-semibold text-[#1D2433]">
                    {name}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#828B9B]">
                    {sectionLabel(entry.sectionType)}
                    {entry.hiddenEverywhere ? " · Hidden" : ""}
                    {entry.isNew ? " · Not saved yet" : ""}
                  </span>
                </button>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(entry.id, -1)}
                    disabled={index === 0 || entry.isNew}
                    className="rounded-lg border border-[#E8ECF3] px-2 py-1 text-xs disabled:opacity-40"
                    aria-label={`Move ${name} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(entry.id, 1)}
                    disabled={index === entries.length - 1 || entry.isNew}
                    className="rounded-lg border border-[#E8ECF3] px-2 py-1 text-xs disabled:opacity-40"
                    aria-label={`Move ${name} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicate(entry.id)}
                    disabled={entry.isNew}
                    className="rounded-lg border border-[#E8ECF3] px-2 py-1 text-xs disabled:opacity-40"
                    aria-label={`Duplicate ${name}`}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700"
                    aria-label={`Remove ${name}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-[#667085]">
          This page has no sections yet.
        </p>
      ) : null}

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 w-full rounded-xl bg-[#1657CF] px-3 py-2 text-sm font-semibold text-white"
      >
        Add section
      </button>
    </aside>
  );
}
