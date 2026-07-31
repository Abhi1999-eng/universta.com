"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/features/auth/auth-client";
import { PageCmsEditor } from "@/features/phase1/PageCmsEditor";
import { DevicePreview } from "./DevicePreview";
import { VersionHistory } from "./VersionHistory";

/** The one Website Builder workspace.
 *
 * Before this screen existed the controls were split: the Website Pages
 * selector owned "which page", Preview and History, while the page editor
 * owned sections, SEO, publication and the chrome overrides. An admin had to
 * bounce between two screens to do one job.
 *
 * This composes them instead of re-implementing them. `PageCmsEditor` is still
 * the only place page/section editing logic lives, `DevicePreview` is still the
 * only preview, `VersionHistory` is still the only history -- this file adds
 * the surrounding workspace (page switcher, status, action bar, panel
 * layout) and nothing else. That matters: two competing page editors would
 * drift apart within a release. */

type WebsitePage = {
  key: string;
  label: string;
  family: string;
  kind: "PAGE" | "TEMPLATE" | "ROUTE";
  status: string;
  publicPath: string;
  pageId: string | null;
  pageSlug: string | null;
  sectionCount: number | null;
  templateId: string | null;
  templateKey: string | null;
};

type Panel = "preview" | "history" | null;

export function WebsiteBuilderWorkspace({ pageId }: { pageId: string }) {
  const router = useRouter();
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch("/api/v1/admin/website-pages", { cache: "no-store" });
        const body = await response.json();
        if (cancelled) return;
        if (body?.error) setError(body.error.message ?? "Unable to load pages");
        else setPages((body?.data as WebsitePage[]) ?? []);
      } catch {
        if (!cancelled) setError("Unable to load pages");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const current = useMemo(
    () => pages.find((row) => row.pageId === pageId) ?? null,
    [pages, pageId],
  );

  const editable = useMemo(
    () => pages.filter((row) => row.kind === "PAGE" && row.pageId),
    [pages],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return editable;
    return editable.filter(
      (row) =>
        row.label.toLowerCase().includes(needle) ||
        row.publicPath.toLowerCase().includes(needle) ||
        row.family.toLowerCase().includes(needle),
    );
  }, [editable, query]);

  /** Leaving with unsaved edits is the one destructive thing this screen can
   * do by accident, so it is guarded on both the in-app switch and the browser
   * close/reload. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const switchPage = useCallback(
    (nextId: string) => {
      if (!nextId || nextId === pageId) return;
      if (
        dirty &&
        !window.confirm(
          "This page has unsaved changes. Switching to another page will discard them.\n\nSwitch anyway?",
        )
      )
        return;
      setDirty(false);
      setPanel(null);
      router.push(`/website/pages/${nextId}/builder`);
    },
    [dirty, pageId, router],
  );

  const onSaved = useCallback(async () => {
    setDirty(false);
    setNotice("Saved. Draft changes are not visible on the public site until you publish.");
    setError("");
    setReloadKey((value) => value + 1);
  }, []);

  return (
    <section className="wb-workspace" aria-label="Website Builder">
      <div className="wb-topbar">
        <div className="wb-topbar-select">
          <label className="wb-topbar-label" htmlFor="wb-page-search">
            Page
          </label>
          <input
            id="wb-page-search"
            value={query}
            placeholder="Search pages…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className="sr-only" htmlFor="wb-page-picker">
            Select a page to edit
          </label>
          <select
            id="wb-page-picker"
            value={pageId}
            onChange={(event) => switchPage(event.target.value)}
          >
            {matches.map((row) => (
              <option key={row.pageId} value={row.pageId ?? ""}>
                {row.label} — {row.publicPath}
              </option>
            ))}
            {!matches.some((row) => row.pageId === pageId) && current ? (
              <option value={pageId}>{current.label}</option>
            ) : null}
          </select>
        </div>

        <div className="wb-topbar-meta">
          {current ? (
            <>
              <span className="wb-chip">{current.publicPath}</span>
              <span className="wb-chip">Page — sections editable</span>
              <span className={`wb-chip is-status is-${current.status.toLowerCase()}`}>
                {current.status}
              </span>
              {dirty ? <span className="wb-chip is-dirty">Unsaved changes</span> : null}
            </>
          ) : null}
        </div>

        <div className="wb-topbar-actions">
          <button
            type="button"
            aria-pressed={panel === "preview"}
            className={panel === "preview" ? "is-active" : ""}
            onClick={() => setPanel(panel === "preview" ? null : "preview")}
          >
            Preview
          </button>
          <button
            type="button"
            aria-pressed={panel === "history"}
            className={panel === "history" ? "is-active" : ""}
            onClick={() => setPanel(panel === "history" ? null : "history")}
          >
            Version history
          </button>
          {current?.publicPath ? (
            <a
              href={`${process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000"}${current.publicPath}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              View live
            </a>
          ) : null}
        </div>
      </div>

      <p className="wb-hint">
        Everything for this page lives on this screen: sections and their content below,
        device visibility on each section, and page settings — template, Header/Footer,
        SEO, publication status and schedule — in the same form. Save Draft and the
        Publish status control are at the bottom of the page form.
      </p>

      {notice ? (
        <p className="wb-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="wb-error" role="alert">
          {error}
        </p>
      ) : null}

      {panel === "preview" && current?.pageSlug ? (
        <div className="wb-panel">
          <DevicePreview
            key={current.pageSlug}
            slug={current.pageSlug}
            title={current.label}
            onClose={() => setPanel(null)}
          />
        </div>
      ) : null}

      {panel === "history" ? (
        <div className="wb-panel">
          <VersionHistory
            key={pageId}
            resourceType="PAGE"
            resourceId={pageId}
            title={current?.label ?? "this page"}
            onRestored={() => setReloadKey((value) => value + 1)}
          />
        </div>
      ) : null}

      {/* The single page/section editor. Rendered here rather than duplicated,
          so there is exactly one implementation of the editing rules. */}
      <div
        className="wb-editor"
        onInput={() => setDirty(true)}
        onChange={() => setDirty(true)}
      >
        <PageCmsEditor
          key={`${pageId}-${reloadKey}`}
          recordId={pageId}
          onSaved={onSaved}
          onCancel={() => router.push("/website")}
        />
      </div>
    </section>
  );
}
