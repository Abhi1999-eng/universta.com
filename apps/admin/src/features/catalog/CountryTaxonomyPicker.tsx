"use client";

import { useMemo, useState } from "react";

/**
 * Country taxonomy selector.
 *
 * Lives inside the Country form, so two things matter more than the visuals:
 * it must never render a nested `<form>` (the browser would submit the outer
 * Country form when the dialog's button is pressed), and creating a term must
 * not unmount anything, or the editor loses every unsaved Country field.
 */

export type TaxonomyRow = {
  id: string;
  label: string;
  /** Selectable in their own right when `onChildrenChange` is supplied,
   * otherwise shown under the parent for context only. */
  children?: Array<{ id: string; label: string }>;
  /** Real usage count; when absent the "Most used" view is not offered. */
  usage?: number;
};

export type CreateOutcome =
  | { kind: "created"; id: string; label: string }
  | { kind: "existing"; id: string; label: string };

type View = "all" | "selected" | "most-used";

/** One shared array, so an absent `selectedChildren` is a stable dependency
 * rather than a new [] on every render. */
const NO_CHILDREN: string[] = [];

export function normalizeTermName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Same shape the catalogue uses elsewhere, so a term typed here and a term
 * typed on the Subjects screen collide rather than duplicate. */
export function termSlug(value: string): string {
  return normalizeTermName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findExistingTerm(
  rows: TaxonomyRow[],
  name: string,
): TaxonomyRow | undefined {
  const normalized = normalizeTermName(name).toLowerCase();
  const slug = termSlug(name);
  return rows.find(
    (row) =>
      row.label.trim().toLowerCase() === normalized ||
      termSlug(row.label) === slug,
  );
}

export function CountryTaxonomyPicker({
  title,
  singular,
  rows,
  selected,
  onChange,
  onCreate,
  testId,
  childTitle,
  selectedChildren,
  onChildrenChange,
}: {
  title: string;
  singular: string;
  rows: TaxonomyRow[];
  selected: string[];
  onChange: (next: string[]) => void;
  onCreate: (name: string) => Promise<CreateOutcome>;
  testId?: string;
  /** Plural noun for the children, used in the counts. */
  childTitle?: string;
  /** Supplying both makes the children selectable. */
  selectedChildren?: string[];
  onChildrenChange?: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const supportsUsage = rows.some((row) => typeof row.usage === "number");
  const childrenSelectable = Boolean(onChildrenChange);
  const childSelection = selectedChildren ?? NO_CHILDREN;
  const childNoun = childTitle ?? "children";
  /* Which parents are open. With hundreds of children per parent, showing
     them all at once is unreadable and slow, so a parent opens on demand --
     or on its own when a search matches one of its children. */
  const [expanded, setExpanded] = useState<string[]>([]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (row: TaxonomyRow) =>
      !needle ||
      row.label.toLowerCase().includes(needle) ||
      (row.children ?? []).some((child) =>
        child.label.toLowerCase().includes(needle),
      );
    const base = rows.filter(matches);
    if (view === "selected")
      return base.filter(
        (row) =>
          selected.includes(row.id) ||
          (row.children ?? []).some((child) =>
            childSelection.includes(child.id),
          ),
      );
    if (view === "most-used")
      return [...base].sort(
        (a, b) =>
          (b.usage ?? 0) - (a.usage ?? 0) || a.label.localeCompare(b.label),
      );
    return base;
  }, [rows, query, view, selected, childSelection]);

  const toggle = (id: string) => {
    setNotice("");
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  };

  const toggleChild = (id: string) => {
    if (!onChildrenChange) return;
    setNotice("");
    onChildrenChange(
      childSelection.includes(id)
        ? childSelection.filter((value) => value !== id)
        : [...childSelection, id],
    );
  };

  /* All or none for one parent: picking two hundred boxes by hand is not a
     thing anyone should be asked to do. */
  const setAllChildren = (row: TaxonomyRow, on: boolean) => {
    if (!onChildrenChange) return;
    setNotice("");
    const ids = (row.children ?? []).map((child) => child.id);
    onChildrenChange(
      on
        ? [...childSelection, ...ids.filter((id) => !childSelection.includes(id))]
        : childSelection.filter((id) => !ids.includes(id)),
    );
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDraftName("");
    setError("");
    setBusy(false);
  };

  async function submitDialog() {
    const name = normalizeTermName(draftName);
    if (!name || busy) return;
    setError("");
    // Selecting what already exists beats creating a near-duplicate, and the
    // loaded options are the active ones, so this catches the common case
    // before any request is made.
    const existing = findExistingTerm(rows, name);
    if (existing) {
      if (!selected.includes(existing.id)) onChange([...selected, existing.id]);
      setNotice(`“${existing.label}” already existed and has been selected.`);
      closeDialog();
      return;
    }
    setBusy(true);
    try {
      const outcome = await onCreate(name);
      if (!selected.includes(outcome.id)) onChange([...selected, outcome.id]);
      setNotice(
        outcome.kind === "existing"
          ? `“${outcome.label}” already existed and has been selected.`
          : `“${outcome.label}” was created and selected.`,
      );
      closeDialog();
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : `Unable to create the ${singular.toLowerCase()}`,
      );
      setBusy(false);
    }
  }

  return (
    <fieldset
      className="rounded-xl border border-[#D9E0EA] p-4"
      data-testid={testId}
    >
      <legend className="px-1 text-sm font-semibold">{title}</legend>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${title.toLowerCase()}`}
        aria-label={`Search ${title.toLowerCase()}`}
        className="mt-2 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm"
      />

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`${title} view`}>
        {(
          [
            ["all", "All"],
            ["selected", `Selected (${selected.length})`],
            ...(supportsUsage ? ([["most-used", "Most used"]] as const) : []),
          ] as Array<[View, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              view === value
                ? "bg-[#1657CF] text-white"
                : "bg-[#F1F5FB] text-[#475467]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="p-sub">
            {view === "selected"
              ? `No ${title.toLowerCase()} selected yet.`
              : `No ${title.toLowerCase()} match that search.`}
          </p>
        ) : null}
        {visible.map((row) => (
          <div key={row.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={() => toggle(row.id)}
              />
              <span>{row.label}</span>
              {view === "most-used" && typeof row.usage === "number" ? (
                <span className="p-hint">
                  {row.usage} course{row.usage === 1 ? "" : "s"}
                </span>
              ) : null}
            </label>
            {(row.children ?? []).length ? (
              childrenSelectable ? (
                (() => {
                  const kids = row.children ?? [];
                  const needle = query.trim().toLowerCase();
                  const hits = needle
                    ? kids.filter((child) =>
                        child.label.toLowerCase().includes(needle),
                      )
                    : kids;
                  /* A search that matches a child opens its parent: the point
                     of typing "animal science" is to see it, not to be told
                     which subject to open. */
                  const open =
                    expanded.includes(row.id) ||
                    (Boolean(needle) && hits.length > 0);
                  const mine = kids.filter((child) =>
                    childSelection.includes(child.id),
                  ).length;
                  return (
                    <div className="ml-6 mt-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#1657CF]"
                          aria-expanded={open}
                          onClick={() =>
                            setExpanded((current) =>
                              current.includes(row.id)
                                ? current.filter((id) => id !== row.id)
                                : [...current, row.id],
                            )
                          }
                        >
                          {open ? "Hide" : "Show"} {kids.length} {childNoun}
                        </button>
                        <span className="p-hint">
                          {mine} selected
                        </span>
                        {open ? (
                          <>
                            <button
                              type="button"
                              className="text-xs text-[#475467] underline"
                              onClick={() => setAllChildren(row, true)}
                            >
                              Select all
                            </button>
                            <button
                              type="button"
                              className="text-xs text-[#475467] underline"
                              onClick={() => setAllChildren(row, false)}
                            >
                              Clear
                            </button>
                          </>
                        ) : null}
                      </div>
                      {open ? (
                        <ul className="mt-1 space-y-1">
                          {hits.map((child) => (
                            <li key={child.id}>
                              <label className="flex cursor-pointer items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={childSelection.includes(child.id)}
                                  onChange={() => toggleChild(child.id)}
                                />
                                <span>{child.label}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                })()
              ) : (
                <ul className="ml-6 mt-1 space-y-1">
                  {(row.children ?? []).map((child) => (
                    <li key={child.id} className="p-hint">
                      {child.label}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 text-sm font-semibold text-[#1657CF]"
        onClick={() => {
          setNotice("");
          setDialogOpen(true);
        }}
      >
        + Add New {singular}
      </button>

      {notice ? (
        <p role="status" className="mt-2 text-xs text-[#18794E]">
          {notice}
        </p>
      ) : null}

      <p className="mt-3 p-hint">
        {selected.length} selected
        {childrenSelectable
          ? ` · ${childSelection.length} ${childNoun} selected`
          : ""}
      </p>

      {dialogOpen ? (
        // Deliberately a div, not a form: a nested form inside the Country
        // form would make this button submit the country.
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Add new ${singular.toLowerCase()}`}
          className="mt-4 rounded-xl border border-[#D9E0EA] bg-[#FAFBFD] p-4"
        >
          <label className="text-sm font-semibold">
            {singular} name
            <input
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  // Enter inside the outer form would otherwise submit the
                  // country instead of creating the term.
                  event.preventDefault();
                  void submitDialog();
                }
                if (event.key === "Escape") closeDialog();
              }}
              className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm"
            />
          </label>
          {draftName.trim() ? (
            <p className="p-hint">
              Slug: {termSlug(draftName) || "—"}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 text-xs text-[#B42318]">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy || !draftName.trim()}
              onClick={() => void submitDialog()}
              className="p-btn p-btn--primary"
            >
              {busy ? "Creating…" : `Create ${singular.toLowerCase()}`}
            </button>
            <button
              type="button"
              onClick={closeDialog}
              className="p-btn p-btn--ghost p-btn--sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
