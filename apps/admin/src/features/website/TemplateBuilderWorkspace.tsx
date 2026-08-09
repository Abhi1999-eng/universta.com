"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/features/auth/auth-client";
import {
  ChromeOverridePanel,
  type ChromeOverrideValue,
} from "./ChromeOverridePanel";
import { VersionHistory } from "./VersionHistory";
import { PREVIEW_DEVICES, type PreviewDeviceKey } from "./DevicePreview";

/** Builder workspace for a dynamic detail template.
 *
 * A detail route has no Page record of its own -- it is a template plus one
 * entity -- so this is the template's half of the same workspace the Page
 * builder provides: identity, Header/Footer override, version history, and a
 * preview that renders the real public route for a real published entity.
 *
 * The entity list comes from actual records. Previewing a template against
 * invented data would prove nothing about what visitors see. */

type Template = {
  id: string;
  name: string;
  templateKey: string;
  description?: string | null;
  pageFamily: string;
  isActive: boolean;
  chromeConfigJson?: ChromeOverrideValue;
};

type Entity = { label: string; path: string };
type Panel = "history" | null;

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";

export function TemplateBuilderWorkspace({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [chrome, setChrome] = useState<ChromeOverrideValue>(null);
  const [menuOptions, setMenuOptions] = useState<Array<{ menuKey: string; name: string }>>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entityPath, setEntityPath] = useState("");
  const [device, setDevice] = useState<PreviewDeviceKey>("desktop");
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [stageWidth, setStageWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authFetch(`/api/v1/admin/page-templates/${templateId}`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok || body?.error)
          throw new Error(body?.error?.message ?? "Unable to load this template.");
        const record = body.data as Template;
        setTemplate(record);
        setChrome(record.chromeConfigJson ?? null);

        const [menus, list] = await Promise.all([
          authFetch("/api/v1/admin/phase1/navigation-menus?limit=100", { cache: "no-store" })
            .then((r) => r.json())
            .catch(() => null),
          authFetch(
            `/api/v1/admin/website-pages/templates/${encodeURIComponent(record.templateKey)}/preview-entities`,
            { cache: "no-store" },
          )
            .then((r) => r.json())
            .catch(() => null),
        ]);
        if (cancelled) return;
        setMenuOptions(
          ((menus?.data as Array<{ menuKey: string; name: string }>) ?? []).map((m) => ({
            menuKey: m.menuKey,
            name: m.name,
          })),
        );
        const rows = (list?.data as Entity[]) ?? [];
        setEntities(rows);
        // Keep whatever the admin already picked. Reloading after a save used
        // to snap the preview back to the first record, silently discarding
        // the entity they were checking their change against.
        setEntityPath((current) =>
          current && rows.some((row) => row.path === current)
            ? current
            : (rows[0]?.path ?? ""),
        );
      } catch (cause) {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Unable to load this template.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId, reloadKey]);

  const save = useCallback(async () => {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await authFetch(`/api/v1/admin/page-templates/${templateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chrome }),
      });
      const body = await response.json();
      if (!response.ok || body?.error)
        throw new Error(body?.error?.message ?? "Could not save this template.");
      setNotice(
        "Saved. This applies to every page rendered from this template, unless an individual page overrides it.",
      );
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this template.");
    } finally {
      setBusy(false);
    }
  }, [chrome, templateId]);

  const frame = PREVIEW_DEVICES.find((entry) => entry.key === device) ?? PREVIEW_DEVICES[0];
  const scale = stageWidth > 0 ? Math.min(1, stageWidth / frame.width) : 1;
  const previewUrl = entityPath ? `${WEB_ORIGIN}${entityPath}` : null;

  const stageRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setStageWidth((current) => (Math.abs(current - width) < 1 ? current : width));
    });
    observer.observe(node);
  }, []);

  const familyLabel = useMemo(
    () => template?.pageFamily?.replaceAll("_", " ") ?? "",
    [template],
  );

  if (error && !template)
    return (
      <p className="wb-error" role="alert">
        {error}
      </p>
    );
  if (!template) return <p className="wb-hint">Loading template…</p>;

  return (
    <section className="wb-workspace" aria-label="Website Builder — template">
      <div className="wb-topbar">
        <div className="wb-topbar-select">
          <span className="wb-topbar-label">Template</span>
          <strong>{template.name}</strong>
        </div>
        <div className="wb-topbar-meta">
          <span className="wb-chip">{template.templateKey}</span>
          <span className="wb-chip">Detail template — applies to every record</span>
          <span className="wb-chip">{familyLabel}</span>
          <span className={`wb-chip is-status${template.isActive ? " is-published" : ""}`}>
            {template.isActive ? "ACTIVE" : "INACTIVE"}
          </span>
        </div>
        <div className="wb-topbar-actions">
          <button
            type="button"
            aria-pressed={panel === "history"}
            className={panel === "history" ? "is-active" : ""}
            onClick={() => setPanel(panel === "history" ? null : "history")}
          >
            Version history
          </button>
          <button type="button" onClick={() => router.push("/page-templates")}>
            Sections included
          </button>
          <button type="button" onClick={() => router.push("/website")}>
            All pages
          </button>
        </div>
      </div>

      <p className="wb-hint">
        This template renders every {familyLabel.toLowerCase()} detail page. Entity content
        always comes from the real record — the template owns layout, Header/Footer and
        presentation. A page-level override on an individual page beats what you set here.
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

      {panel === "history" ? (
        <div className="wb-panel">
          <VersionHistory
            key={templateId}
            resourceType="PAGE_TEMPLATE"
            resourceId={templateId}
            title={template.name}
            onRestored={() => setReloadKey((value) => value + 1)}
          />
        </div>
      ) : null}

      <div className="wb-panel">
        <ChromeOverridePanel
          value={chrome}
          onChange={setChrome}
          menuOptions={menuOptions}
          scopeLabel="Every page using this template"
        />
        <div className="mt-3">
          <button
            type="button"
            className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => void save()}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>

      <div className="wb-panel">
        <div className="wb-preview">
          <div className="wb-preview-bar">
            <div>
              <strong>Preview</strong>{" "}
              <span className="wb-preview-slug">{entityPath || "no entity selected"}</span>
            </div>
            <div className="wb-topbar-select">
              <label className="wb-topbar-label" htmlFor="tpl-entity">
                Preview with
              </label>
              <select
                id="tpl-entity"
                value={entityPath}
                onChange={(event) => setEntityPath(event.target.value)}
              >
                {entities.length ? (
                  entities.map((entity) => (
                    <option key={entity.path} value={entity.path}>
                      {entity.label}
                    </option>
                  ))
                ) : (
                  <option value="">No published records yet</option>
                )}
              </select>
            </div>
            <div className="wb-preview-devices" role="group" aria-label="Preview device">
              {PREVIEW_DEVICES.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className={entry.key === device ? "is-active" : ""}
                  aria-pressed={entry.key === device}
                  onClick={() => setDevice(entry.key)}
                >
                  {entry.label}
                  <small>{entry.width}px</small>
                </button>
              ))}
            </div>
            <div className="wb-preview-actions">
              {previewUrl ? (
                <a href={previewUrl} target="_blank" rel="noreferrer noopener">
                  Open in new tab
                </a>
              ) : null}
            </div>
          </div>

          {/* A detail page is public content, so this frames the real published
              route rather than a token-gated draft view. */}
          <p className="wb-preview-note">
            Previewing the live public route for a real published record.
          </p>

          <div className="wb-preview-stage" ref={stageRef}>
            {previewUrl ? (
              <div
                className="wb-preview-shrink"
                style={{ width: frame.width * scale, height: frame.height * scale }}
              >
                <div
                  className="wb-preview-frame"
                  data-device={device}
                  style={{
                    width: frame.width,
                    height: frame.height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }}
                >
                  <iframe
                    key={`${device}-${entityPath}-${reloadKey}`}
                    title={`${frame.label} preview of ${template.name}`}
                    src={previewUrl}
                    width={frame.width}
                    height={frame.height}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  />
                </div>
              </div>
            ) : (
              <p className="wb-preview-state">
                No published record of this type yet, so there is nothing to preview
                against. Publish one and it will appear here.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
