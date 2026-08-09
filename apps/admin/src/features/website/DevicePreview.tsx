"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

/** Device-framed draft preview for the Website Builder.
 *
 * The three frames use the real logical viewports the public CSS breaks on, so
 * what the frame shows is what that device shows -- the iframe is genuinely
 * that many CSS pixels wide, and is then scaled down visually to fit the admin
 * column. Scaling is a CSS transform on the rendered result, so it never
 * changes the viewport width the page inside media-queries against.
 *
 * Draft content is fetched by the previewed page itself using a short-lived
 * signed token issued here, so nothing draft is reachable without one. */

export const PREVIEW_DEVICES = [
  { key: "desktop", label: "Desktop", width: 1440, height: 900 },
  { key: "tablet", label: "Tablet", width: 768, height: 1024 },
  { key: "mobile", label: "Mobile", width: 390, height: 844 },
] as const;

export type PreviewDeviceKey = (typeof PREVIEW_DEVICES)[number]["key"];

export function DevicePreview({
  slug,
  title,
  onClose,
  publicPath,
  framesLiveRoute = false,
  inline = false,
}: {
  slug: string;
  title: string;
  /** Omitted when embedded: an inline preview has nothing to close. */
  onClose?: () => void;
  /** The real public route this page frames, for listing/comparison/functional
   * pages whose rows come from live records. */
  publicPath?: string | null;
  /** When true the frame shows that live route rather than the draft-only
   * view. A listing page's own record holds framing copy, not the listing --
   * previewing just that record would show an almost-empty page and tell the
   * admin nothing about what visitors see. */
  framesLiveRoute?: boolean;
  /** Renders inside the builder's centre pane instead of as a modal, so the
   * builder shows the real preview rather than a second, home-grown renderer
   * that would drift from the public site. */
  inline?: boolean;
}) {
  const [device, setDevice] = useState<PreviewDeviceKey>("desktop");
  const [issuedPreviewUrl, setIssuedPreviewUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  /** Bumped to force the iframe to remount on Refresh. */
  const [nonce, setNonce] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState(0);

  /** Fetches a token. Deliberately does not set the loading state itself: the
   * component already mounts in "loading" (it is keyed on the slug, so it
   * mounts fresh per page), which keeps the mount effect free of a synchronous
   * setState. `reissue` below adds the loading state for the manual paths. */
  const issue = useCallback(async () => {
    try {
      const response = await authFetch("/api/v1/admin/preview-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "page", ref: slug }),
      });
      const body = await response.json();
      if (!response.ok || body?.error || !body?.data?.previewUrl)
        throw new Error(body?.error?.message ?? "Could not create a preview link.");
      setIssuedPreviewUrl(body.data.previewUrl as string);
      setExpiresAt((body.data.expiresAt as string) ?? null);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a preview link.");
      setStatus("error");
    }
  }, [slug]);

  const reissue = useCallback(() => {
    setStatus("loading");
    setError(null);
    void issue();
  }, [issue]);

  useEffect(() => {
    // Matches the convention used by WebsitePagesManager and SettingsManager:
    // every state update inside `issue` happens after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void issue();
  }, [issue]);

  /** Measure the available column so the frame can be scaled down to fit.
   * Scaling is purely visual: the iframe element keeps its real pixel width,
   * so the page inside still matches on the same media queries. */
  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setStageWidth((current) => (Math.abs(current - width) < 1 ? current : width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [status]);

  const frame = PREVIEW_DEVICES.find((entry) => entry.key === device) ?? PREVIEW_DEVICES[0];
  const scale = stageWidth > 0 ? Math.min(1, stageWidth / frame.width) : 1;
  const liveRoute = framesLiveRoute && publicPath && issuedPreviewUrl
    ? new URL(publicPath, issuedPreviewUrl).toString()
    : null;
  const previewUrl = liveRoute ?? issuedPreviewUrl;

  return (
    <div
      className={inline ? "wb-preview is-inline" : "wb-preview"}
      role={inline ? "region" : "dialog"}
      aria-modal={inline ? undefined : true}
      aria-label={inline ? `Preview of ${title}` : `Preview of ${title}`}
    >
      <div className="wb-preview-bar">
        <div>
          <strong>Preview</strong> <span className="wb-preview-slug">/{slug}</span>
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
          <button type="button" onClick={() => setNonce((value) => value + 1)} disabled={!previewUrl}>
            Refresh
          </button>
          <button type="button" onClick={reissue}>
            New link
          </button>
          {previewUrl ? (
            <a href={previewUrl} target="_blank" rel="noreferrer noopener">
              Open in new tab
            </a>
          ) : null}
          {onClose ? (
            <button type="button" className="wb-preview-close" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      </div>

      {liveRoute ? (
        <p className="wb-preview-note">
          Framing the live <strong>{publicPath}</strong> route, because its rows come from
          published records rather than from this page. Saved framing changes appear here
          once the page is published.
        </p>
      ) : expiresAt && status === "ready" ? (
        <p className="wb-preview-note">
          This preview link shows unpublished draft content, is not indexed, and expires at{" "}
          {new Date(expiresAt).toLocaleTimeString()}. Use “New link” if it stops working.
        </p>
      ) : null}

      <div className="wb-preview-stage" ref={stageRef}>
        {status === "loading" && !liveRoute ? (
          <p className="wb-preview-state">Preparing preview…</p>
        ) : null}
        {status === "error" && !liveRoute ? (
          <div className="wb-preview-state wb-preview-state-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={reissue}>
              Try again
            </button>
          </div>
        ) : null}
        {(status === "ready" || liveRoute) && previewUrl ? (
          <div
            className="wb-preview-shrink"
            /* Reserves only the scaled-down footprint, so the admin page never
               scrolls sideways around a 1440px frame. */
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
                key={`${device}-${nonce}-${issuedPreviewUrl}`}
                title={`${frame.label} preview of ${title}`}
                src={previewUrl}
                width={frame.width}
                height={frame.height}
                /* Draft content is our own origin; scripts stay enabled so the
                   preview behaves like the real page. */
                sandbox="allow-scripts allow-same-origin allow-popups"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
