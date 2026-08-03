"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { DevicePreview } from "./DevicePreview";
import { VersionHistory } from "./VersionHistory";

/** Website Pages -- the front door of Website Builder.
 *
 * One searchable selector over every managed public page and template, so an
 * admin never has to know a route. Each row states honestly how that page is
 * managed (full section editor, layout template, or SEO-only for a
 * code-composed route) instead of implying every page has the same controls. */

type WebsitePage = {
  key: string;
  label: string;
  family: string;
  kind: "PAGE" | "TEMPLATE" | "ROUTE";
  managementType:
    | "STATIC_PAGE"
    | "LISTING_PAGE"
    | "DETAIL_TEMPLATE"
    | "FUNCTIONAL_PAGE"
    | "COMPARISON_PAGE";
  /** Where this entry opens in the Builder. Null only if it has no backing
   * record yet, which registration is meant to prevent. */
  builderPath: string | null;
  status: string;
  publicPath: string;
  pageId: string | null;
  pageSlug: string | null;
  sectionCount: number | null;
  templateId: string | null;
  templateKey: string | null;
  seoKey: string | null;
  hasSeoRecord: boolean;
  updatedAt: string | null;
  canCreatePage: boolean;
};

const WEB_ORIGIN =
  process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";

/** The client's vocabulary, not ours: an admin looking for "the Universities
 * page" should not have to know whether it is a CMS Page or a code route. */
const MANAGEMENT_LABEL: Record<WebsitePage["managementType"], string> = {
  STATIC_PAGE: "Static page — full section editor",
  LISTING_PAGE: "Listing page — editorial framing, rows from live records",
  DETAIL_TEMPLATE: "Detail template — layout for every record of this type",
  FUNCTIONAL_PAGE: "Functional page — configurable blocks around the form",
  COMPARISON_PAGE: "Comparison page — editorial framing, results from records",
};

/** Every registered entry has a Builder workspace: Pages open the page
 * builder, detail templates open the template builder. `/seo` is only the
 * fallback for an entry that somehow has no backing record. */
function editHref(row: WebsitePage) {
  return row.builderPath ?? "/seo";
}

export function WebsitePagesManager() {
  const [rows, setRows] = useState<WebsitePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [kind, setKind] = useState("");
  const [reload, setReload] = useState(0);
  const [preview, setPreview] = useState<{ slug: string; title: string } | null>(null);
  const [history, setHistory] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Matches the convention used by SettingsManager: the remaining state
    // updates all happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    authFetch("/api/v1/admin/website-pages", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (cancelled) return;
        if (body?.error) setError(body.error.message ?? "Unable to load pages");
        else setRows((body?.data as WebsitePage[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load pages");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const families = useMemo(
    () => [...new Set(rows.map((row) => row.family))].sort(),
    [rows],
  );

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (family && row.family !== family) return false;
        if (kind && row.managementType !== kind) return false;
        if (!query.trim()) return true;
        const needle = query.trim().toLowerCase();
        return (
          row.label.toLowerCase().includes(needle) ||
          row.publicPath.toLowerCase().includes(needle) ||
          row.family.toLowerCase().includes(needle) ||
          row.managementType.toLowerCase().includes(needle)
        );
      }),
    [rows, family, kind, query],
  );

  async function createPage(row: WebsitePage) {
    setNotice("");
    setError("");
    const response = await authFetch(
      `/api/v1/admin/website-pages/${encodeURIComponent(row.key)}/page`,
      { method: "POST" },
    );
    const body = await response.json();
    if (!response.ok || body?.error) {
      setError(body?.error?.message ?? "Unable to create the page record");
      return;
    }
    setNotice(`Created an editable page record for ${row.label}.`);
    setReload((value) => value + 1);
  }

  return (
    <section aria-labelledby="website-pages-heading">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
          Website Builder
        </p>
        <h2
          id="website-pages-heading"
          className="mt-2 text-3xl font-semibold tracking-[-0.04em]"
        >
          Website Pages
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085]">
          Every public page and reusable template in one place. Static pages
          such as Home and About are edited as individual pages; dynamic detail
          pages such as University Detail are edited as templates that apply to
          every record of that type.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_240px]">
        <label className="block text-sm font-semibold">
          Search pages
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or URL…"
            className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal outline-none focus:border-[#1657CF]"
          />
        </label>
        <label className="block text-sm font-semibold">
          Page family
          <select
            value={family}
            onChange={(event) => setFamily(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal outline-none focus:border-[#1657CF]"
          >
            <option value="">All families</option>
            {families.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Managed as
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal outline-none focus:border-[#1657CF]"
          >
            <option value="">All types</option>
            <option value="STATIC_PAGE">Static page</option>
            <option value="LISTING_PAGE">Listing page</option>
            <option value="DETAIL_TEMPLATE">Detail template</option>
            <option value="FUNCTIONAL_PAGE">Functional page</option>
            <option value="COMPARISON_PAGE">Comparison page</option>
          </select>
        </label>
      </div>

      {notice ? (
        <p role="status" className="mt-4 rounded-xl bg-[#ECFDF5] px-4 py-3 text-sm font-semibold text-[#047857]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#B42318]">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-5">
          {/* Keyed on the slug so switching pages mounts a fresh preview
              rather than briefly showing the previous page's frame. */}
          <DevicePreview
            key={preview.slug}
            slug={preview.slug}
            title={preview.title}
            onClose={() => setPreview(null)}
          />
        </div>
      ) : null}

      {history ? (
        <div className="mt-5">
          <VersionHistory
            key={history.id}
            resourceType="PAGE"
            resourceId={history.id}
            title={history.title}
            onRestored={() => setReload((value) => value + 1)}
          />
          <button
            type="button"
            className="mt-3 font-semibold text-[#1657CF] focus:underline focus:outline-none"
            onClick={() => setHistory(null)}
          >
            Close version history
          </button>
        </div>
      ) : null}

      <p className="mt-5 text-sm text-[#667085]">
        {loading
          ? "Loading website pages…"
          : `${visible.length} of ${rows.length} pages`}
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[#E8ECF3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#FAFBFD] text-xs uppercase tracking-[0.12em] text-[#828B9B]">
              <tr>
                <th className="px-5 py-4">Page</th>
                <th className="px-5 py-4">Family</th>
                <th className="px-5 py-4">Managed as</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {visible.map((row) => (
                <tr key={row.key}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-[#0D1524]">{row.label}</p>
                    <p className="mt-1 text-xs text-[#828B9B]">
                      {row.publicPath}
                      {row.sectionCount !== null
                        ? ` · ${row.sectionCount} section${row.sectionCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-[#667085]">{row.family}</td>
                  <td className="px-5 py-4 text-[#667085]">
                    {MANAGEMENT_LABEL[row.managementType]}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-semibold text-[#1657CF]">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    {row.canCreatePage ? (
                      <button
                        type="button"
                        onClick={() => void createPage(row)}
                        className="mr-3 font-semibold text-[#1657CF] focus:underline focus:outline-none"
                      >
                        Create editable page
                      </button>
                    ) : (
                      <Link
                        href={editHref(row)}
                        className="mr-3 font-semibold text-[#1657CF] focus:underline focus:outline-none"
                      >
                        Open in Builder
                      </Link>
                    )}
                    {row.seoKey ? (
                      <Link
                        href={`/seo?key=${encodeURIComponent(row.seoKey)}`}
                        className="mr-3 font-semibold text-[#1657CF] focus:underline focus:outline-none"
                      >
                        SEO
                      </Link>
                    ) : null}
                    {/* Only a real Page has draft content to preview. For a
                        template or a code-composed route there is nothing
                        unpublished to show, so those keep the honest "View
                        live" link rather than a preview that would be
                        identical to the public page. */}
                    {row.kind === "PAGE" && row.pageSlug ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreview({ slug: row.pageSlug as string, title: row.label })
                        }
                        className="mr-3 font-semibold text-[#1657CF] focus:underline focus:outline-none"
                      >
                        Preview
                      </button>
                    ) : null}
                    {row.kind === "PAGE" && row.pageId ? (
                      <button
                        type="button"
                        onClick={() =>
                          setHistory({ id: row.pageId as string, title: row.label })
                        }
                        className="mr-3 font-semibold text-[#1657CF] focus:underline focus:outline-none"
                      >
                        History
                      </button>
                    ) : null}
                    <a
                      href={`${WEB_ORIGIN}${row.publicPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#667085] focus:underline focus:outline-none"
                    >
                      View live
                    </a>
                  </td>
                </tr>
              ))}
              {!loading && !visible.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#667085]">
                    No pages match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
