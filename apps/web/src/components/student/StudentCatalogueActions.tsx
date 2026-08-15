"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Kind = "universities" | "offerings" | "scholarships";

/** A compact public-catalogue bridge to the existing student session boundary.
 * It holds a refreshed access token only for this interaction; the durable
 * credential remains the HttpOnly cookie. */
export function StudentCatalogueActions({
  kind,
  entityId,
  offeringId,
  scholarshipId,
}: {
  kind: Kind;
  entityId: string;
  offeringId?: string;
  scholarshipId?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
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
      router.push(`/student/login?returnTo=${encodeURIComponent(current)}`);
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
      setMessage("Saved to your portal.");
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
  return (
    <span className="student-catalogue-actions">
      <button
        type="button"
        className="button secondary"
        onClick={() => void save()}
        disabled={busy}
      >
        {busy ? "Saving…" : "Save"}
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
