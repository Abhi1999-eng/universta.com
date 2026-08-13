"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

async function api<T>(init?: RequestInit): Promise<T> {
  const response = await authFetch(
    "/api/v1/admin/seo-management/site-verification",
    {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    },
  );
  const body = (await response.json()) as {
    data?: T;
    error?: { message?: string } | null;
  };
  if (!response.ok || body.error)
    throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

export function SiteVerificationManager() {
  const [google, setGoogle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void api<{ google: string | null }>()
      .then((value) => setGoogle(value.google ?? ""))
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load site verification",
        ),
      );
  }, []);
  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const saved = await api<{ google: string | null }>({
        method: "PUT",
        body: JSON.stringify({ google: google || null }),
      });
      setGoogle(saved.google ?? "");
      setMessage(
        "Saved. The Google verification meta tag is now server-rendered publicly.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save site verification",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="mt-6 max-w-2xl rounded-2xl border border-[#E8ECF3] bg-white p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-[#0D1524]">
        Google Search Console
      </h3>
      <p className="mt-2 text-sm leading-6 text-[#667085]">
        Paste only the content value from Google&apos;s verification tag. Do not
        paste HTML.
      </p>
      <label className="mt-5 block text-sm font-semibold text-[#344054]">
        Google verification token
        <input
          className="mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]"
          value={google}
          onChange={(event) => setGoogle(event.target.value)}
          placeholder="google-site-verification token"
        />
      </label>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save verification"}
        </button>
        {message ? (
          <p
            role={message.startsWith("Saved") ? "status" : "alert"}
            className={`text-sm font-semibold ${message.startsWith("Saved") ? "text-[#18794E]" : "text-[#B42318]"}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
