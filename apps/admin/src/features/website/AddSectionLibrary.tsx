"use client";

import { useMemo, useState } from "react";
import { sectionLibrary, type SectionDefinition } from "./section-registry";

/** The "what would you like to add?" picker.
 *
 * Everything offered here comes from the section registry, so the list can
 * never drift from what the public site can render. Sections are described by
 * what they put on the page rather than by their type name -- an admin picks
 * "Questions and answers", not FAQ_GROUP. */
export function AddSectionLibrary({
  onPick,
  onClose,
}: {
  onPick: (definition: SectionDefinition) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sectionLibrary();
    return sectionLibrary()
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Add a section"
    >
      <div className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Add a section</h3>
            <p className="mt-1 text-sm text-[#667085]">
              Pick what you want to appear on the page. You can edit it straight
              after adding.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E8ECF3] px-3 py-2 text-sm font-semibold"
          >
            Close
          </button>
        </div>

        <label className="mt-4 block text-sm font-semibold">
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “countries” or “questions”"
            className="mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]"
          />
        </label>

        {groups.length === 0 ? (
          <p className="mt-6 text-sm text-[#667085]">
            Nothing matches “{query}”.
          </p>
        ) : null}

        {groups.map((group) => (
          <section key={group.category} className="mt-6">
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
              {group.label}
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {group.items.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => onPick(item)}
                  className="rounded-xl border border-[#E8ECF3] p-4 text-left hover:border-[#1657CF] hover:bg-[#F7F9FC]"
                  data-testid={`add-section-${item.type}`}
                >
                  <span className="block text-sm font-semibold text-[#1D2433]">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs text-[#667085]">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
