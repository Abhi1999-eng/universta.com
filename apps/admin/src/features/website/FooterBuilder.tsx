"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import {
  FOOTER_BLOCKS,
  FOOTER_LAYOUT_VERSION,
  ROW_LAYOUTS,
  footerBlockDefinition,
  footerBlockLabel,
  layoutAreas,
  newBlock,
  newRow,
  reflowRow,
  type FooterBlock,
  type FooterBlockType,
  type FooterLayout,
  type FooterLink,
  type FooterRow,
  type FooterRowLayout,
} from "./footer-blocks";

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";

type MenuOption = { key: string; label: string };

/** Builds the footer out of rows and blocks.
 *
 * Deliberately not a free-form canvas: a row picks one of the approved
 * layouts, and blocks sit in one of that layout's columns. That is what keeps
 * a footer an admin composed inside the design system, and it is why there is
 * no CSS anywhere in this screen. */
export function FooterBuilder({
  value,
  onChange,
  menuOptions,
}: {
  value: FooterLayout | null;
  onChange: (next: FooterLayout) => void;
  menuOptions: MenuOption[];
}) {
  const rows = value?.rows ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const selectedBlock = useMemo(() => {
    for (const row of rows) {
      const block = row.blocks.find((entry) => entry.id === selected);
      if (block) return { row, block };
    }
    return null;
  }, [rows, selected]);

  function commit(nextRows: FooterRow[]) {
    onChange({ version: FOOTER_LAYOUT_VERSION, rows: nextRows });
  }
  function patchRow(rowId: string, patch: Partial<FooterRow>) {
    commit(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }
  function patchBlock(blockId: string, patch: Partial<FooterBlock>) {
    commit(
      rows.map((row) => ({
        ...row,
        blocks: row.blocks.map((block) =>
          block.id === blockId ? { ...block, ...patch } : block,
        ),
      })),
    );
  }
  function moveRow(rowId: string, direction: -1 | 1) {
    const index = rows.findIndex((row) => row.id === rowId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = rows.slice();
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <aside
        className="rounded-2xl border border-[#E8ECF3] bg-white p-4"
        aria-label="Footer structure"
        data-testid="footer-structure"
      >
        <h3 className="text-sm font-semibold">Footer rows</h3>
        <p className="mt-1 text-xs text-[#828B9B]">
          Each row spans the width of the footer. Add blocks into its columns.
        </p>

        <ul className="mt-3 space-y-3">
          {rows.map((row, rowIndex) => (
            <li
              key={row.id}
              className="rounded-xl border border-[#E8ECF3] p-3"
              data-testid={`footer-row-${row.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Row {rowIndex + 1}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveRow(row.id, -1)}
                    disabled={rowIndex === 0}
                    aria-label={`Move row ${rowIndex + 1} up`}
                    className="rounded-lg border border-[#E8ECF3] px-2 py-1 text-xs disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(row.id, 1)}
                    disabled={rowIndex === rows.length - 1}
                    aria-label={`Move row ${rowIndex + 1} down`}
                    className="rounded-lg border border-[#E8ECF3] px-2 py-1 text-xs disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => commit(rows.filter((entry) => entry.id !== row.id))}
                    aria-label={`Remove row ${rowIndex + 1}`}
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <label className="mt-2 block text-xs font-semibold">
                Layout
                <select
                  value={row.layout}
                  onChange={(event) =>
                    patchRow(
                      row.id,
                      reflowRow(row, event.target.value as FooterRowLayout),
                    )
                  }
                  className={inputClass}
                  aria-label={`Row ${rowIndex + 1} layout`}
                >
                  {ROW_LAYOUTS.map((layout) => (
                    <option key={layout.value} value={layout.value}>
                      {layout.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-2 flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={row.visible !== false}
                  onChange={(event) =>
                    patchRow(row.id, { visible: event.target.checked })
                  }
                />
                Show this row
              </label>

              <div className="mt-3 space-y-2">
                {Array.from({ length: layoutAreas(row.layout) }, (_, area) => (
                  <div key={area} className="rounded-lg bg-[#F7F9FC] p-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#828B9B]">
                      Column {area + 1}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {row.blocks
                        .filter((block) => (block.area ?? 0) === area)
                        .map((block) => (
                          <li key={block.id}>
                            <button
                              type="button"
                              onClick={() => setSelected(block.id)}
                              data-testid={`footer-block-${block.id}`}
                              className={`w-full rounded-lg border px-2 py-1 text-left text-xs ${
                                selected === block.id
                                  ? "border-[#1657CF] bg-[#F2F7FF]"
                                  : "border-[#E8ECF3] bg-white"
                              }`}
                            >
                              {footerBlockLabel(block.type)}
                              {block.visible === false ? " · Hidden" : ""}
                            </button>
                          </li>
                        ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setAdding(`${row.id}:${area}`)}
                      className="mt-1 w-full rounded-lg border border-dashed border-[#D9E0EA] px-2 py-1 text-xs font-semibold text-[#1657CF]"
                    >
                      Add block
                    </button>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>

        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-[#667085]">
            No rows yet. Your site keeps its standard footer until you add one.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => commit([...rows, newRow()])}
          className="mt-4 w-full rounded-xl bg-[#1657CF] px-3 py-2 text-sm font-semibold text-white"
        >
          Add row
        </button>
      </aside>

      <div className="rounded-2xl border border-[#E8ECF3] bg-[#F7F9FC] p-5">
        {selectedBlock ? (
          <BlockSettings
            block={selectedBlock.block}
            menuOptions={menuOptions}
            onChange={(patch) => patchBlock(selectedBlock.block.id, patch)}
            onRemove={() => {
              commit(
                rows.map((row) => ({
                  ...row,
                  blocks: row.blocks.filter(
                    (entry) => entry.id !== selectedBlock.block.id,
                  ),
                })),
              );
              setSelected(null);
            }}
          />
        ) : (
          <p className="text-sm text-[#667085]">
            Pick a block on the left to edit it, or add one to a column.
          </p>
        )}
      </div>

      {adding ? (
        <BlockLibrary
          onClose={() => setAdding(null)}
          onPick={(type) => {
            const [rowId, area] = adding.split(":");
            const block = newBlock(type, Number(area));
            commit(
              rows.map((row) =>
                row.id === rowId
                  ? { ...row, blocks: [...row.blocks, block] }
                  : row,
              ),
            );
            setSelected(block.id);
            setAdding(null);
          }}
        />
      ) : null}
    </div>
  );
}

function BlockLibrary({
  onPick,
  onClose,
}: {
  onPick: (type: FooterBlockType) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Add a footer block"
    >
      <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold">Add a block</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E8ECF3] px-3 py-2 text-sm font-semibold"
          >
            Close
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FOOTER_BLOCKS.map((block) => (
            <button
              key={block.type}
              type="button"
              onClick={() => onPick(block.type)}
              data-testid={`add-footer-block-${block.type}`}
              className="rounded-xl border border-[#E8ECF3] p-3 text-left hover:border-[#1657CF] hover:bg-[#F7F9FC]"
            >
              <span className="block text-sm font-semibold">{block.label}</span>
              <span className="mt-1 block text-xs text-[#667085]">
                {block.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockSettings({
  block,
  menuOptions,
  onChange,
  onRemove,
}: {
  block: FooterBlock;
  menuOptions: MenuOption[];
  onChange: (patch: Partial<FooterBlock>) => void;
  onRemove: () => void;
}) {
  const definition = footerBlockDefinition(block.type);
  const links = block.links ?? [];

  function patchLink(index: number, patch: Partial<FooterLink>) {
    onChange({
      links: links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
    });
  }

  return (
    <div data-testid="footer-block-settings">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{definition.label}</h3>
          <p className="mt-1 text-xs text-[#667085]">{definition.description}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
        >
          Remove block
        </button>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={block.visible !== false}
          onChange={(event) => onChange({ visible: event.target.checked })}
        />
        Show this block
      </label>

      {definition.supportsHeading ? (
        <label className="mt-3 block text-sm font-semibold">
          Heading
          <input
            value={block.heading ?? ""}
            onChange={(event) => onChange({ heading: event.target.value })}
            className={inputClass}
          />
        </label>
      ) : null}

      {definition.supportsText ? (
        <label className="mt-3 block text-sm font-semibold">
          Text
          <textarea
            value={block.text ?? ""}
            onChange={(event) => onChange({ text: event.target.value })}
            className={`${inputClass} min-h-24`}
          />
        </label>
      ) : null}

      {definition.supportsMenu ? (
        <label className="mt-3 block text-sm font-semibold">
          Which menu
          <select
            value={block.menuKey ?? ""}
            onChange={(event) => onChange({ menuKey: event.target.value })}
            className={inputClass}
          >
            <option value="">Choose a menu</option>
            {menuOptions.map((menu) => (
              <option key={menu.key} value={menu.key}>
                {menu.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {definition.supportsCta ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Button label
            <input
              value={block.ctaLabel ?? ""}
              onChange={(event) => onChange({ ctaLabel: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Button link
            <input
              value={block.ctaUrl ?? ""}
              onChange={(event) => onChange({ ctaUrl: event.target.value })}
              placeholder="/counselling"
              className={inputClass}
            />
          </label>
        </div>
      ) : null}

      {definition.supportsLinks ? (
        <fieldset className="mt-4 rounded-xl border border-[#E8ECF3] bg-white p-3">
          <legend className="px-1 text-sm font-semibold">Links</legend>
          {links.map((link, index) => (
            <div key={index} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block text-xs font-semibold">
                Label
                <input
                  value={link.label}
                  onChange={(event) => patchLink(index, { label: event.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block text-xs font-semibold">
                Destination
                <input
                  value={link.url}
                  onChange={(event) => patchLink(index, { url: event.target.value })}
                  placeholder="/about"
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  onChange({ links: links.filter((_, i) => i !== index) })
                }
                aria-label={`Remove link ${index + 1}`}
                className="mt-5 h-10 rounded-lg border border-red-200 px-2 text-xs text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ links: [...links, { label: "", url: "" }] })}
            className="mt-3 rounded-xl border border-[#D9E0EA] px-3 py-2 text-xs font-semibold"
          >
            Add another link
          </button>
        </fieldset>
      ) : null}
    </div>
  );
}

/** Loads the navigation menus a Menu column block can point at. */
export function useFooterMenuOptions(): MenuOption[] {
  const [options, setOptions] = useState<MenuOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch(
          "/api/v1/admin/phase1/navigation-menus?limit=50",
          { cache: "no-store" },
        );
        const body = await response.json();
        if (cancelled) return;
        setOptions(
          ((body?.data ?? []) as Record<string, unknown>[])
            .map((row) => ({
              key: String(row.menuKey ?? ""),
              label: String(row.name ?? row.menuKey ?? ""),
            }))
            .filter((row) => row.key),
        );
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}
