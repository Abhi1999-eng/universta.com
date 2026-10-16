"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import {
  BulkBar,
  bulkSummary,
  formatUpdated,
  ListSummary,
  RowCheckbox,
  RowMenu,
  SelectAllCheckbox,
  StatusBadge,
  Toasts,
  useRowSelection,
  useToasts,
  ViewOnSite,
} from "@/features/shared/records-ui";
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
  updatedAt?: string;
};

/* Where a published record lives on the site, for the "View on site" link.
   Offerings, testimonials, pages and menus have no page of their own by slug
   alone, so they carry none. */
const publicPaths: Record<string, (row: Phase1Row) => string | null> = {
  universities: (row) => (row.slug ? `/universities/${row.slug}` : null),
  scholarships: (row) => (row.slug ? `/scholarships/${row.slug}` : null),
  consultants: (row) => (row.slug ? `/study-abroad-consultants/${row.slug}` : null),
  jobs: (row) => (row.slug ? `/careers/${row.slug}` : null),
  events: (row) => (row.slug ? `/events/${row.slug}` : null),
  "success-stories": (row) => (row.slug ? `/success-stories/${row.slug}` : null),
};

function rowName(row: Phase1Row) {
  return (
    row.name ??
    row.title ??
    row.fullName ??
    row.inquiryNumber ??
    row.quote?.slice(0, 48) ??
    "This record"
  );
}

type ListMeta = { page: number; limit: number; total: number; totalPages: number };
type Envelope = {
  data: Phase1Row[] | Phase1Row | null;
  meta: ListMeta | null;
  error: { message: string } | null;
};

const PAGE_SIZE = 20;

function menuKeyFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

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
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [counts, setCounts] = useState<{ published: number; draft: number } | null>(null);
  /* Which row is mid-action, and what it is doing, so its button can say so. */
  const [busy, setBusy] = useState<Record<string, string>>({});
  const { toasts, push: toast, dismiss } = useToasts();
  const title = titles[resource] ?? resource;
  const structured = isStructuredPhase1Resource(resource);
  const isPageCms = resource === "pages";
  const isNavMenu = resource === "navigation-menus";
  const isInquiries = resource === "contact-inquiries";
  const editable = structured || isPageCms || isNavMenu;
  const publishable = !isInquiries;
  const [newMenu, setNewMenu] = useState({ name: "", location: "HEADER" });

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter) params.set("status", statusFilter);
      const body = await request(`${resource}?${params.toString()}`);
      setRows(Array.isArray(body.data) ? body.data : []);
      setListMeta(body.meta);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load records",
      );
    }
  }, [resource, page, q, statusFilter]);

  /* How many are live and how many are not, for the line over the table.
     Two one-row reads; a failure only leaves the line without them. */
  const loadCounts = useCallback(async () => {
    if (!publishable) return;
    try {
      const [published, draft] = await Promise.all([
        request(`${resource}?status=PUBLISHED&limit=1`),
        request(`${resource}?status=DRAFT&limit=1`),
      ]);
      setCounts({ published: published.meta?.total ?? 0, draft: draft.meta?.total ?? 0 });
    } catch {
      setCounts(null);
    }
  }, [resource, publishable]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    setQ("");
    setStatusFilter("");
  }, [resource]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCounts();
  }, [loadCounts]);

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
      toast("ok", "Saved.");
      await load();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "Unable to save");
    }
  }

  /* Publish, unpublish or archive one row. The row says what it is doing
     while the request runs, shows its new status as soon as the API
     answers, and a toast says in one line what happened -- or why it did
     not, with the editor one click away. */
  async function rowAction(row: Phase1Row, kind: "publish" | "unpublish" | "archive") {
    const name = rowName(row);
    setBusy((current) => ({ ...current, [row.id]: kind }));
    try {
      const body =
        kind === "archive"
          ? await request(`${resource}/${row.id}`, { method: "DELETE" })
          : await request(`${resource}/${row.id}/${kind}`, { method: "POST" });
      const saved = body.data && !Array.isArray(body.data) ? body.data : null;
      if (kind === "archive") {
        setRows((current) => current.filter((item) => item.id !== row.id));
      } else {
        setRows((current) =>
          current.map((item) =>
            item.id === row.id
              ? { ...item, ...(saved ?? {}), status: saved?.status ?? (kind === "publish" ? "PUBLISHED" : "DRAFT") }
              : item,
          ),
        );
      }
      toast(
        "ok",
        kind === "publish"
          ? `${name} published.`
          : kind === "unpublish"
            ? `${name} moved to draft.`
            : `${name} archived.`,
      );
      await Promise.all([load(), loadCounts()]);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The request failed";
      toast(
        "error",
        `${name}: ${kind === "publish" ? "not published" : kind === "unpublish" ? "not moved to draft" : "not archived"}. ${reason}`,
        editable && kind !== "archive"
          ? {
              label: "Fix in editor",
              onSelect: () => {
                setCreating(false);
                setEditingId(row.id);
              },
            }
          : undefined,
      );
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
    }
  }

  /* Publish or unpublish every ticked row, one after another, and say in
     one line what happened. */
  const selection = useRowSelection(rows.map((row) => row.id));
  const [bulkBusy, setBulkBusy] = useState(false);
  async function bulk(kind: "publish" | "unpublish") {
    const picked = rows.filter((row) => selection.has(row.id));
    const targets = picked.filter((row) => (kind === "publish" ? row.status !== "PUBLISHED" : row.status === "PUBLISHED"));
    setBulkBusy(true);
    const failed: string[] = [];
    let done = 0;
    for (const row of targets) {
      try {
        await request(`${resource}/${row.id}/${kind}`, { method: "POST" });
        done += 1;
      } catch (error) {
        failed.push(`${rowName(row)} (${error instanceof Error ? error.message : "failed"})`);
      }
    }
    toast(failed.length ? "error" : "ok", bulkSummary(kind, done, picked.length - targets.length, failed));
    selection.clear();
    setBulkBusy(false);
    await Promise.all([load(), loadCounts()]);
  }

  async function afterSave() {
    await Promise.all([load(), loadCounts()]);
    setCreating(false);
    setEditingId(null);
  }

  async function createMenu(event: React.FormEvent) {
    event.preventDefault();
    try {
      const menuKey = menuKeyFromName(newMenu.name);
      if (!menuKey)
        throw new Error("Use a menu name with at least one letter or number");
      const created = await request(resource, {
        method: "POST",
        body: JSON.stringify({
          ...newMenu,
          // The database identifier is derived only once; editors work with
          // the menu name and its intended site area, never an internal key.
          menuKey,
        }),
      });
      const createdRow = created.data as unknown as Phase1Row | null;
      setMessage("Menu created.");
      setNewMenu({ name: "", location: "HEADER" });
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
          <p className="p-eyebrow">
            Expanded Phase 1
          </p>
          <h2 className="p-h1">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <ListSummary
            total={listMeta ? listMeta.total : rows.length}
            published={counts?.published}
            draft={counts?.draft}
          />
          {structured || isPageCms || isNavMenu ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setCreating(true);
              }}
              className="p-btn p-btn--primary p-btn--sm"
            >
              Create {resource === "offerings" ? "offering" : isPageCms ? "page" : isNavMenu ? "menu" : "record"}
            </button>
          ) : null}
        </div>
      </div>

      {creating && isNavMenu ? (
        <form
          onSubmit={(event) => void createMenu(event)}
          className="mt-8 grid gap-4 sm:grid-cols-2 p-panel"
        >
          <h3 className="sm:col-span-2 text-lg font-semibold">Create navigation menu</h3>
          <label className="text-sm font-semibold">
            Menu name
            <input
              className="p-input"
              value={newMenu.name}
              onChange={(event) => setNewMenu((v) => ({ ...v, name: event.target.value }))}
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Designed for
            <select
              className="p-input"
              value={newMenu.location}
              onChange={(event) => setNewMenu((v) => ({ ...v, location: event.target.value }))}
            >
              <option value="HEADER">Header</option>
              <option value="FOOTER">Footer</option>
            </select>
          </label>
          <p className="sm:col-span-2 p-hint">
            Choose this menu in Global Settings → Header or Footer when you are ready
            to show it on the live site. You can add links after creating it.
          </p>
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" className="p-btn p-btn--primary p-btn--sm">
              Create menu
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="p-btn p-btn--ghost p-btn--sm"
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
        <div>
          {publishable ? (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="p-field">
                <span className="sr-only">Search {title.toLowerCase()}</span>
                <input
                  className="p-input p-input--sm"
                  placeholder="Search by name or slug"
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="p-field">
                <span className="sr-only">Filter by status</span>
                <select
                  className="p-input p-input--sm"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </label>
            </div>
          ) : null}
          {publishable ? <BulkBar count={selection.count} busy={bulkBusy} onPublish={() => void bulk("publish")} onUnpublish={() => void bulk("unpublish")} onClear={selection.clear} /> : null}
          <div className="overflow-x-auto rounded-2xl border border-[#E8ECF3] bg-white">
          <table className="p-table u-table min-w-full">
            <thead className="border-b border-[#E8ECF3] text-[#667085]">
              <tr>
                {publishable ? <th className="p-4 w-8"><SelectAllCheckbox checked={selection.allSelected} onChange={selection.toggleAll} /></th> : null}
                <th className="p-4">Record</th>
                <th className="p-4">Status</th>
                {isNavMenu ? <th className="p-4">Affects</th> : null}
                <th className="p-4">Updated</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name = rowName(row);
                const sitePath = row.status === "PUBLISHED" ? (publicPaths[resource]?.(row) ?? null) : null;
                const working = busy[row.id];
                return (
                <tr className="border-b border-[#F0F2F5]" key={row.id}>
                  {publishable ? <td className="p-4"><RowCheckbox name={name} checked={selection.has(row.id)} onChange={(on) => selection.toggle(row.id, on)} /></td> : null}
                  <td className="p-4">
                    {editable ? (
                      <button
                        type="button"
                        className="p-link font-semibold"
                        onClick={() => {
                          setCreating(false);
                          setEditingId(row.id);
                        }}
                      >
                        {name}
                      </button>
                    ) : (
                      <span className="font-semibold">{name}</span>
                    )}
                    <span className="p-hint block">
                      {row.slug ?? ""}
                      {isNavMenu && row.menuKey ? ` (${row.menuKey})` : null}
                      {sitePath ? (
                        <>
                          {row.slug ? " · " : null}
                          <ViewOnSite path={sitePath} />
                        </>
                      ) : null}
                    </span>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={row.status} />
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
                  <td className="p-4 text-[#667085]">{formatUpdated(row.updatedAt)}</td>
                  <td className="p-4">
                    <div className="p-row p-row--actions">
                    {editable ? (
                      <button
                        type="button"
                        className="p-btn p-btn--outline p-btn--sm"
                        onClick={() => {
                          setCreating(false);
                          setEditingId(row.id);
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {publishable ? (
                      row.status === "PUBLISHED" ? (
                        <button
                          type="button"
                          className="p-btn p-btn--ghost p-btn--sm"
                          disabled={Boolean(working)}
                          onClick={() => void rowAction(row, "unpublish")}
                        >
                          {working === "unpublish" ? "Moving to draft…" : "Unpublish"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="p-btn p-btn--primary p-btn--sm"
                          disabled={Boolean(working)}
                          onClick={() => void rowAction(row, "publish")}
                        >
                          {working === "publish" ? "Publishing…" : "Publish"}
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        className="p-btn p-btn--primary p-btn--sm"
                        disabled={Boolean(row.convertedLeadId)}
                        onClick={() =>
                          void action(`${resource}/${row.id}/convert`)
                        }
                      >
                        Convert to lead
                      </button>
                    )}
                    <RowMenu
                      items={[
                        { label: "Archive", danger: true, onSelect: () => setPendingArchive(row) },
                      ]}
                    />
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length ? null : (
            <p className="p-6 p-sub">{q || statusFilter ? "No records match these filters." : "No records yet."}</p>
          )}
          </div>
        </div>

        {listMeta && listMeta.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <p className="p-sub">
              Page {listMeta.page} of {listMeta.totalPages}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="p-btn p-btn--ghost p-btn--sm"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= listMeta.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="p-btn p-btn--ghost p-btn--sm"
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
          <aside className="p-panel">
            <h3 className="font-semibold">Advanced development fallback</h3>
            <p className="p-sub">
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
              className="p-btn p-btn--primary p-btn--sm"
              type="button"
              onClick={() => void createAdvanced()}
            >
              Create draft
            </button>
          </aside>
        ) : null}
      </div>
      {message ? (
        <p className="mt-5 p-sub" role="alert">
          {message}
        </p>
      ) : null}
      <Toasts toasts={toasts} onDismiss={dismiss} />
      {pendingArchive ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-record-title"
        >
          <div className="p-modal__panel">
            <h3 id="archive-record-title" className="p-h3">
              Archive this record?
            </h3>
            <p className="p-sub">
              {rowName(pendingArchive)} will be removed from Admin and public listings.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="p-btn p-btn--ghost p-btn--sm"
                onClick={() => setPendingArchive(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="p-btn p-btn--danger"
                onClick={() => {
                  void rowAction(pendingArchive, "archive");
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
