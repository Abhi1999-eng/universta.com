"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type SeoEntry = { label: string; href: string; note: string };

const ENTRIES: SeoEntry[] = [
  { label: "Countries", href: "/countries", note: "Open a country, use its SEO tab (title, description, canonical, OG, hreflang, schema)." },
  { label: "Cities", href: "/locations", note: "Open the Cities tab, use the “SEO” action on any row." },
  { label: "Universities", href: "/phase1/universities", note: "Edit a university, use the SEO section of the structured editor." },
  { label: "University course offerings", href: "/phase1/offerings", note: "Edit an offering, use the SEO section of the structured editor." },
  { label: "Scholarships", href: "/phase1/scholarships", note: "Edit a scholarship, use the SEO section of the structured editor." },
  { label: "Consultants", href: "/phase1/consultants", note: "Edit a consultant, use the SEO section of the structured editor." },
  { label: "Consultant locations", href: "/consultant-locations", note: "Use the “SEO” action on any location row." },
  { label: "Jobs", href: "/phase1/jobs", note: "Edit a job, use the SEO section of the structured editor." },
  { label: "Events", href: "/phase1/events", note: "Edit an event, use the SEO section of the structured editor." },
  { label: "Success stories", href: "/phase1/success-stories", note: "Edit a story, use the SEO section of the structured editor." },
  { label: "Testimonials", href: "/phase1/testimonials", note: "Edit a testimonial, use the SEO section of the structured editor." },
  { label: "Editorial pages", href: "/phase1/pages", note: "Edit a page, use the SEO fieldset (title, description, canonical, focus keyword)." },
];

type StaticSeo = {
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
};
type StaticRow = { key: string; label: string; seo: StaticSeo | null };

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/static-page-seo${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { data?: T; error?: { message?: string } | null };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

function StaticSeoEditor({ row, onSaved }: { row: StaticRow; onSaved: (key: string, seo: StaticSeo) => void }) {
  const [seoTitle, setSeoTitle] = useState(row.seo?.seoTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(row.seo?.metaDescription ?? "");
  const [canonicalUrl, setCanonicalUrl] = useState(row.seo?.canonicalUrl ?? "");
  const [robotsIndex, setRobotsIndex] = useState(row.seo?.robotsIndex ?? true);
  const [robotsFollow, setRobotsFollow] = useState(row.seo?.robotsFollow ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const saved = await api<StaticSeo>(`/${row.key}`, {
        method: "PUT",
        body: JSON.stringify({ seoTitle, metaDescription, canonicalUrl: canonicalUrl || null, robotsIndex, robotsFollow }),
      });
      onSaved(row.key, saved);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[#E8ECF3] bg-[#FAFBFD] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold">SEO title
          <input className={inputClass} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
        </label>
        <label className="block text-xs font-semibold">Meta description
          <input className={inputClass} value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} />
        </label>
        <label className="block text-xs font-semibold sm:col-span-2">Canonical URL (optional)
          <input className={inputClass} value={canonicalUrl} onChange={(event) => setCanonicalUrl(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={robotsIndex} onChange={(event) => setRobotsIndex(event.target.checked)} />
          Allow search indexing
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={robotsFollow} onChange={(event) => setRobotsFollow(event.target.checked)} />
          Allow link following
        </label>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={saving || !seoTitle || !metaDescription} onClick={() => void save()} className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
          {saving ? "Saving…" : "Save SEO"}
        </button>
        {message ? <p className={`text-xs font-semibold ${message === "Saved." ? "text-[#18794E]" : "text-[#B42318]"}`}>{message}</p> : null}
      </div>
    </div>
  );
}

function StaticPageSeoTable() {
  const [rows, setRows] = useState<StaticRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await api<StaticRow[]>(""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load static page SEO");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The state update happens only after the asynchronous request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function onSaved(key: string, seo: StaticSeo) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, seo } : row)));
  }

  if (loading) return <p className="mt-4 text-sm text-[#667085]">Loading…</p>;
  if (error) return <p className="mt-4 text-sm font-semibold text-[#B42318]" role="alert">{error}</p>;

  return (
    <div className="mt-4 divide-y divide-[#E8ECF3] rounded-2xl border border-[#E8ECF3] bg-white">
      {rows.map((row) => (
        <div key={row.key} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{row.label}</p>
              <p className="mt-1 text-xs text-[#828B9B]">
                {row.seo ? (row.seo.robotsIndex ? "Indexable" : "Noindex") : "No SEO record yet — using page defaults"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenKey(openKey === row.key ? null : row.key)}
              className="rounded-lg border border-[#D9E0EA] px-3 py-1.5 text-xs font-semibold"
            >
              {openKey === row.key ? "Close" : "Edit SEO"}
            </button>
          </div>
          {openKey === row.key ? <StaticSeoEditor row={row} onSaved={onSaved} /> : null}
        </div>
      ))}
    </div>
  );
}

export function SeoManagementHub() {
  return (
    <section className="mx-auto max-w-[1180px]">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Platform tools</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">SEO management</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
        SEO title, meta description, canonical URL, Open Graph image and robots directives are edited inline within
        each resource&apos;s own editor rather than a separate global form, so changes stay next to the content
        they describe. Every SEO-enabled resource type is listed here so nothing is left undiscoverable.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {ENTRIES.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="block rounded-2xl border border-[#E8ECF3] bg-white p-5 transition hover:border-[#1657CF] hover:shadow-[0_8px_24px_rgba(22,87,207,0.08)]"
          >
            <h3 className="text-base font-semibold text-[#0D1524]">{entry.label}</h3>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{entry.note}</p>
          </Link>
        ))}
      </div>

      <h3 className="mt-10 text-xl font-semibold">Static / listing pages</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
        These routes are code-defined, not database records, so their SEO lives here instead of inside a resource
        editor. Comparison pages default to noindex until an admin explicitly changes that.
      </p>
      <StaticPageSeoTable />

      <p className="mt-8 text-xs text-[#828B9B]">
        Not covered here: FAQ entries (nested within each Country/Course record — no standalone SEO record exists
        for an individual FAQ question in the schema).
      </p>
    </section>
  );
}
