"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { studentLoginHref } from "@/lib/student-return-to";

type Kind = "universities" | "offerings" | "scholarships";

/* The design's heart, as its course card and course page draw it. */
function Heart({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      aria-hidden="true"
    >
      <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z" />
    </svg>
  );
}

/** A compact public-catalogue bridge to the existing student session boundary.
 * It holds a refreshed access token only for this interaction; the durable
 * credential remains the HttpOnly cookie.
 *
 * `variant="heart"` draws Save as the Study Abroad design's heart: the
 * labelled icon button on a course page, or with `compact` the small square
 * on a course card, named for screen readers by `label`. It saves to the same
 * student account -- signed out, it leads to the student login and back --
 * and Apply, where there is one, stays beside it. */
export function StudentCatalogueActions({
  kind,
  entityId,
  offeringId,
  scholarshipId,
  variant = "buttons",
  compact = false,
  label,
}: {
  kind: Kind;
  entityId: string;
  offeringId?: string;
  scholarshipId?: string;
  variant?: "buttons" | "heart";
  compact?: boolean;
  /** What is being saved, for the compact heart's accessible name. */
  label?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const current =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}`;
  const refresh = async () => {
    const response = await fetch("/api/student/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { accessToken?: string } };
    return body.data?.accessToken ?? null;
  };
  const request = async (path: string, init: RequestInit) => {
    const token = await refresh();
    if (!token) {
      router.push(studentLoginHref(current));
      return null;
    }
    const response = await fetch(`/api/student${path}`, {
      ...init,
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    if (!response.ok)
      throw new Error(
        "We could not update your student portal. Please try again.",
      );
    return response.json();
  };
  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      await request(`/saved/${kind}/${entityId}`, { method: "POST" });
      setSaved(true);
      setMessage("Saved to your portal.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const unsave = async () => {
    setBusy(true);
    setMessage("");
    try {
      await request(`/saved/${kind}/${entityId}`, { method: "DELETE" });
      setSaved(false);
      setMessage("Removed from your portal.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    const endpoint = offeringId
      ? "/applications"
      : scholarshipId
        ? "/scholarship-applications"
        : null;
    const body = offeringId
      ? { offeringId }
      : scholarshipId
        ? { scholarshipId }
        : null;
    if (!endpoint || !body) return;
    setBusy(true);
    setMessage("");
    try {
      const response = (await request(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      })) as { data?: { id?: string } } | null;
      if (response?.data?.id) {
        router.push(
          offeringId ? "/student/applications" : "/student/scholarships",
        );
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (variant === "heart") {
    const toggle = () => void (saved ? unsave() : save());
    return (
      <span className="student-catalogue-actions student-catalogue-actions--heart">
        {compact ? (
          <button
            type="button"
            className="tinybtn"
            aria-pressed={saved}
            aria-label={`Save ${label ?? "course"}`}
            title={message || (saved ? "Saved to your portal" : "Save")}
            onClick={toggle}
            disabled={busy}
          >
            <Heart size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="iconbtn"
            aria-pressed={saved}
            onClick={toggle}
            disabled={busy}
          >
            <Heart size={15} />
            <span>
              {busy
                ? "Saving…"
                : saved
                  ? "Saved"
                  : kind === "offerings"
                    ? "Save course"
                    : "Save"}
            </span>
          </button>
        )}
        {offeringId || scholarshipId ? (
          <button
            type="button"
            className="iconbtn"
            onClick={() => void apply()}
            disabled={busy}
          >
            Apply with Universta
          </button>
        ) : null}
        {message ? (
          <span
            role="status"
            className={compact ? "sr-only" : "student-catalogue-status"}
          >
            {message}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="student-catalogue-actions">
      <button
        type="button"
        className="button secondary"
        onClick={() => void (saved ? unsave() : save())}
        disabled={busy}
      >
        {busy ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
      {offeringId || scholarshipId ? (
        <button
          type="button"
          className="button"
          onClick={() => void apply()}
          disabled={busy}
        >
          Apply with Universta
        </button>
      ) : null}
      {message ? (
        <span role="status" className="student-catalogue-status">
          {message}
        </span>
      ) : null}
    </span>
  );
}
