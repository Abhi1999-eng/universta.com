"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { isStructuredPhase1Resource } from "./Phase1StructuredEditor";
import { UnifiedPhase1StructuredEditor } from "./UnifiedPhase1StructuredEditor";
import { PageCmsEditor } from "./PageCmsEditor";
import { NavigationMenuEditor } from "./NavigationMenuEditor";

const titles: Record<string, string> = {
  universities: "Universities",
  offerings: "University course offerings",
  scholarships: "Scholarships",
  consultants: "Consultants",
  jobs: "Jobs",
  events: "Events",
  "success-stories": "Success stories",
  testimonials: "Testimonials",
  pages: "Editorial pages",
  "navigation-menus": "Navigation menus",
  "contact-inquiries": "Contact enquiries",
};

const examples: Record<string, string> = {
  pages:
    '{\n  "pageType": "EDITORIAL",\n  "title": "About",\n  "slug": "about"\n}',
};

type Phase1Row = {
  id: string;
  name?: string;
  title?: string;
  fullName?: string;
  inquiryNumber?: string;
  quote?: string;
  slug?: string;
  status?: string;
  convertedLeadId?: string | null;
  menuKey?: string;
  usedAs?: "header" | "footer" | null;
};

type ListMeta = { page: number; limit: number; total: number; totalPages: number };
type Envelope = {
  data: Phase1Row[] | null;
  meta: ListMeta | null;
  error: { message: string } | null;
};

const PAGE_SIZE = 20;

async function request(path: string, init?: RequestInit): Promise<Envelope> {
  const response = await authFetch(`/api/v1/admin/phase1/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as Envelope;
  if (!response.ok || body.error)
    throw new Error(body.error?.message ?? "Admin request failed");
  return body;
}

export function Phase1Manager({ resource }: { resource: string }) {
  const [rows, setRows] = useState<Phase1Row[]>([]);
  const [listMeta, setListMeta] = useState<ListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState(examples[resource] ?? "{}");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<Phase1Row | null>(null);
  const title = titles[resource] ?? resource;
  const structured = isStructuredPhase1Resource(resource);
  const isPageCms = resource === "pages";
  const isNavMenu = resource === "navigation-menus";
  const [newMenu, setNewMenu] = useState({ name: "", menuKey: "", location: "HEADER" });

  const load = useCallback(async () => {
    try {
      const body = await request(`${resource}?page=${page}&limit=${PAGE_SIZE}`);
      setRows(body.data ?? []);
      setListMeta(body.meta);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load records",
      );
    }
  }, [resource, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [resource]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createAdvanced() {
    try {
      const body: unknown = JSON.parse(draft);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new Error("The draft must be a JSON object");
      await request(resource, { method: "POST", body: JSON.stringify(body) });
      setMessage("Draft created. Publish it when ready.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  async function action(path: string, method = "POST") {
    try {
      await request(path, { method });
      setMessage("Saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    }
  }

  async function afterSave() {
    await load();
    setCreating(false);
    setEditingId(null);
  }

  async function createMenu(event: React.FormEvent) {
    event.preventDefault();
    try {
      const created = await request(resource, {
        method: "POST",
        body: JSON.stringify(newMenu),
      });
      const createdRow = created.data as unknown as Phase1Row | null;
      setMessage("Menu created.");
      setNewMenu({ name: "", menuKey: "", location: "HEADER" });
      setCreating(false);
      await load();
      if (createdRow?.id) setEditingId(createdRow.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create menu");
    }
  }

  const editor = (structured || isPageCms) && (creating || editingId);

  return (
    <section className="mx-auto max-w-[1240px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
            Expanded Phase 1
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-[#667085]">
            {listMeta ? `${listMeta.total} record${listMeta.total === 1 ? "" : "s"}` : `${rows.length} records`}
          </p>
          {structured || isPageCms || isNavMenu ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setCreating(true);
              }}
              className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
            >
              Create {resource === "offerings" ? "offering" : isPageCms ? "page" : isNavMenu ? "menu" : "record"}
            </button>
          ) : null}
        </div>
      </div>

      {creating && isNavMenu ? (
        <form
          onSubmit={(event) => void createMenu(event)}
          className="mt-8 grid gap-4 rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:grid-cols-3"
        >
          <h3 className="sm:col-span-3 text-lg font-semibold">Create navigation menu</h3>
          <label className="text-sm font-semibold">
            Menu name
            <input
              className="mt-1 w-full rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm"
              value={newMenu.name}
              onChange={(event) => setNewMenu((v) => ({ ...v, name: event.target.value }))}
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Menu key
            <input
              className="mt-1 w-full rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm"
              value={newMenu.menuKey}
              onChange={(event) => setNewMenu((v) => ({ ...v, menuKey: event.target.value }))}
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Menu location
            <select
              className="mt-1 w-full rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm"
              value={newMenu.location}
              onChange={(event) => setNewMenu((v) => ({ ...v, location: event.target.value }))}
            >
              <option value="HEADER">Header</option>
              <option value="FOOTER">Footer</option>
            </select>
          </label>
          <p className="sm:col-span-3 text-xs text-[#828B9B]">
            The menu key must match Global Settings → Header/Footer for this menu to
            actually appear on the live site. Items are added after the menu is created.
          </p>
          <div className="sm:col-span-3 flex gap-3">
            <button type="submit" className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white">
              Create menu
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {isNavMenu && editingId ? (
        <NavigationMenuEditor
          key={editingId}
          menuId={editingId}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      {editor && isPageCms ? (
        <PageCmsEditor
          key={editingId ?? 'create'}
          recordId={editingId ?? undefined}
          onSaved={afterSave}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
          }}
        />
      ) : null}
      {editor && structured ? (
        <UnifiedPhase1StructuredEditor
          key={`${resource}:${editingId ?? 'create'}`}
          resource={resource}
          recordId={editingId ?? undefined}
          onSaved={afterSave}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
          }}
        />
      ) : null}

      <div
        className={`mt-8 grid gap-8 ${
          structured || isPageCms || isNavMenu || resource === "contact-inquiries"
            ? ""
            : "lg:grid-cols-[1fr_360px]"
        }`}
      >
        <div className="overflow-x-auto rounded-2xl border border-[#E8ECF3] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#E8ECF3] text-[#667085]">
              <tr>
                <th className="p-4">Record</th>
                <th className="p-4">Slug / status</th>
                {isNavMenu ? <th className="p-4">Affects</th> : null}
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b border-[#F0F2F5]" key={row.id}>
                  <td className="p-4 font-semibold">
                    {row.name ??
                      row.title ??
                      row.fullName ??
                      row.inquiryNumber ??
                      row.quote?.slice(0, 48)}
                  </td>
                  <td className="p-4 text-[#667085]">
                    {row.slug ?? row.status}
                    {isNavMenu && row.menuKey ? ` (${row.menuKey})` : null}
                  </td>
                  {isNavMenu ? (
                    <td className="p-4">
                      {row.usedAs ? (
                        <span className="rounded-full bg-[#E9F8F0] px-2.5 py-1 text-xs font-bold text-[#18794E]">
                          {row.usedAs === "header" ? "Header" : "Footer"}
                        </span>
                      ) : (
                        <span
                          className="rounded-full bg-[#FFF7E6] px-2.5 py-1 text-xs font-bold text-[#8A5A00]"
                          title="This menu is not wired to the live site's Header or Footer"
                        >
                          Not used
                        </span>
                      )}
                    </td>
                  ) : null}
                  <td className="flex flex-wrap gap-2 p-4">
                    {structured || isPageCms || isNavMenu ? (
                      <button
                        type="button"
                        className="rounded-lg border border-[#1657CF] px-3 py-2 text-xs font-semibold text-[#1657CF]"
                        onClick={() => {
                          setCreating(false);
                          setEditingId(row.id);
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {resource !== "contact-inquiries" ? (
                      <>
                        <button
                          type="button"
                          className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white"
                          onClick={() =>
                            void action(`${resource}/${row.id}/publish`)
                          }
                        >
                          Publish
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-[#E8ECF3] px-3 py-2 text-xs font-semibold"
                          onClick={() =>
                            void action(`${resource}/${row.id}/unpublish`)
                          }
                        >
                          Unpublish
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white"
                        disabled={Boolean(row.convertedLeadId)}
                        onClick={() =>
                          void action(`${resource}/${row.id}/convert`)
                        }
                      >
                        Convert to lead
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                      onClick={() => setPendingArchive(row)}
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length ? null : (
            <p className="p-6 text-sm text-[#667085]">No records yet.</p>
          )}
        </div>

        {listMeta && listMeta.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-[#667085]">
              Page {listMeta.page} of {listMeta.totalPages}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= listMeta.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}

        {resource === "contact-inquiries" ? (
          <aside className="rounded-2xl border border-[#E8ECF3] bg-white p-5 text-sm text-[#667085]">
            Contact enquiries are separate from counselling leads. Conversion is
            idempotent, requires a phone number, and is recorded in the API
            audit log.
          </aside>
        ) : null}

        {!structured && !isPageCms && !isNavMenu && resource !== "contact-inquiries" ? (
          <aside className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
            <h3 className="font-semibold">Advanced development fallback</h3>
            <p className="mt-2 text-sm text-[#667085]">
              This JSON tool is retained only for editorial development.
              Catalog records use field-based editors, and navigation menus
              have their own field-based editor with full item management.
            </p>
            <textarea
              aria-label="Advanced JSON draft"
              className="mt-4 h-72 w-full rounded-xl border border-[#DCE2EA] p-3 font-mono text-xs"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button
              className="mt-3 rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={() => void createAdvanced()}
            >
              Create draft
            </button>
          </aside>
        ) : null}
      </div>
      {message ? (
        <p className="mt-5 text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}
      {pendingArchive ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-record-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="archive-record-title" className="text-lg font-semibold">
              Archive this record?
            </h3>
            <p className="mt-2 text-sm text-[#667085]">
              {pendingArchive.name ??
                pendingArchive.title ??
                pendingArchive.quote?.slice(0, 48) ??
                "This record"} will be removed from Admin and public listings.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
                onClick={() => setPendingArchive(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  void action(`${resource}/${pendingArchive.id}`, "DELETE");
                  setPendingArchive(null);
                }}
              >
                Archive record
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}