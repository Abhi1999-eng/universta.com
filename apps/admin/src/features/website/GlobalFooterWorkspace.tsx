"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { FooterBuilder, useFooterMenuOptions } from "./FooterBuilder";
import { FOOTER_LAYOUT_VERSION, type FooterLayout } from "./footer-blocks";

/** Global Footer editing, with one save.
 *
 * The footer's flat settings (description, copyright, legal links) and the
 * composed rows are one document to the admin, so they save together through
 * the same settings endpoint rather than offering a button each. */
export function GlobalFooterWorkspace() {
  const [values, setValues] = useState<Record<string, unknown> | null>(null);
  const [layout, setLayout] = useState<FooterLayout | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const menuOptions = useFooterMenuOptions();

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch("/api/v1/admin/settings", {
          cache: "no-store",
        });
        const body = await response.json();
        if (cancelled) return;
        const group = (
          (body?.data ?? []) as { group: string; values: Record<string, unknown> }[]
        ).find((entry) => entry.group === "footer");
        setValues(group?.values ?? {});
        const stored = group?.values?.layoutJson as FooterLayout | null | undefined;
        setLayout(
          stored?.rows ? stored : { version: FOOTER_LAYOUT_VERSION, rows: [] },
        );
      } catch {
        if (!cancelled) setMessage("Unable to load the footer");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await authFetch("/api/v1/admin/settings/footer", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, layoutJson: layout }),
      });
      const body = await response.json();
      if (!response.ok || body?.error)
        throw new Error(body?.error?.message ?? "Unable to save the footer");
      setMessage("Footer saved.");
      setReloadKey((value) => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the footer");
    } finally {
      setBusy(false);
    }
  }

  if (!values) return <p className="mt-6 text-sm text-[#667085]">Loading footer…</p>;

  const rowCount = layout?.rows.length ?? 0;

  return (
    <section className="mt-6 space-y-4" aria-labelledby="global-footer-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
            Website Builder
          </p>
          <h2 id="global-footer-heading" className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            Global Footer
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            {rowCount
              ? "Your footer is built from the rows below and appears on every page."
              : "Your site is using its standard footer. Add a row to build your own."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save footer
        </button>
      </div>

      <FooterBuilder
        value={layout}
        onChange={setLayout}
        menuOptions={menuOptions}
      />

      {message ? (
        <p className="text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
