"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

/** ISS-019 fix. Before this, a navigation menu could be listed, published,
 * unpublished and archived -- but nothing anywhere let an admin see, add,
 * edit, reorder or remove the links inside it. The only surface offered for
 * that was a raw "Advanced JSON draft" textarea, and the site chrome's own
 * links table had no admin route at all. This editor is the missing half:
 * a menu's own fields plus full item management, backed by the
 * `/admin/phase1/navigation-menus/:id/items*` routes added alongside it. */

const WEB_ORIGIN =
  process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";

type Menu = {
  id: string;
  name: string;
  menuKey: string;
  location: string;
  status: string;
  usedAs?: "header" | "footer" | null;
};

type Item = {
  id: string;
  menuId: string;
  parentItemId: string | null;
  label: string;
  linkType: "PAGE" | "CUSTOM" | "NONE";
  pageId: string | null;
  pageTitle: string | null;
  customUrl: string | null;
  openInNewTab: boolean;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
  resolvedHref: string | null;
  brokenTarget: boolean;
};

type PageOption = { id: string; title: string; slug: string };

type ApiError = Error & { code?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as {
    data?: T;
    error?: { code?: string; message?: string } | null;
  };
  if (!response.ok || body.error) {
    const error = new Error(
      body.error?.message ?? "Request failed",
    ) as ApiError;
    error.code = body.error?.code;
    throw error;
  }
  return body.data as T;
}

const input =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2 text-sm outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const label = "text-sm font-semibold text-[#1F2933]";

const emptyDraft = {
  id: "" as string | null,
  label: "",
  linkType: "PAGE" as Item["linkType"],
  pageId: "",
  customUrl: "",
  openInNewTab: false,
  parentItemId: "",
  status: "ACTIVE" as Item["status"],
};

export function NavigationMenuEditor({
  menuId,
  onCancel,
}: {
  menuId: string;
  onCancel: () => void;
}) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [menuDraft, setMenuDraft] = useState({ name: "", menuKey: "", location: "HEADER" });
  const [itemDraft, setItemDraft] = useState(emptyDraft);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [menuList, itemList, options] = await Promise.all([
        request<Menu[]>("/phase1/navigation-menus?limit=100"),
        request<Item[]>(`/phase1/navigation-menus/${menuId}/items`),
        request<{ pages: PageOption[] }>("/phase1/form-options"),
      ]);
      const found = menuList.find((row) => row.id === menuId) ?? null;
      setMenu(found);
      if (found)
        setMenuDraft({
          name: found.name,
          menuKey: found.menuKey,
          location: found.location,
        });
      setItems(itemList);
      setPages(options.pages ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the menu");
    } finally {
      setLoading(false);
    }
  }, [menuId]);

  useEffect(() => {
    // The state update happens only after the asynchronous requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function saveMenuFields(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await request(`/phase1/navigation-menus/${menuId}`, {
        method: "PATCH",
        body: JSON.stringify(menuDraft),
      });
      setMessage("Menu details saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the menu");
    }
  }

  async function setMenuStatus(status: "ACTIVE" | "INACTIVE") {
    setError("");
    try {
      await request(
        `/phase1/navigation-menus/${menuId}/${status === "ACTIVE" ? "publish" : "unpublish"}`,
        { method: "POST" },
      );
      setMessage(status === "ACTIVE" ? "Menu published." : "Menu unpublished.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change menu status");
    }
  }

  function beginEdit(item: Item) {
    setItemDraft({
      id: item.id,
      label: item.label,
      linkType: item.linkType,
      pageId: item.pageId ?? "",
      customUrl: item.customUrl ?? "",
      openInNewTab: item.openInNewTab,
      parentItemId: item.parentItemId ?? "",
      status: item.status,
    });
    setMessage("");
    setError("");
  }

  function resetDraft() {
    setItemDraft(emptyDraft);
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const payload: Record<string, unknown> = {
      label: itemDraft.label,
      linkType: itemDraft.linkType,
      openInNewTab: itemDraft.openInNewTab,
      parentItemId: itemDraft.parentItemId || null,
      status: itemDraft.status,
    };
    if (itemDraft.linkType === "PAGE") payload.pageId = itemDraft.pageId;
    if (itemDraft.linkType === "CUSTOM") payload.customUrl = itemDraft.customUrl;
    try {
      if (itemDraft.id) {
        await request(`/phase1/navigation-menus/${menuId}/items/${itemDraft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Item saved.");
      } else {
        await request(`/phase1/navigation-menus/${menuId}/items`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Item added.");
      }
      resetDraft();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the item");
    }
  }

  async function toggleItemStatus(item: Item) {
    setError("");
    try {
      await request(`/phase1/navigation-menus/${menuId}/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      });
      setMessage(
        item.status === "ACTIVE" ? "Item deactivated." : "Item reactivated.",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change the item's status");
    }
  }

  async function removeItem(item: Item) {
    setError("");
    try {
      await request(`/phase1/navigation-menus/${menuId}/items/${item.id}`, {
        method: "DELETE",
      });
      setMessage("Item removed.");
      setPendingDelete(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove the item");
      setPendingDelete(null);
    }
  }

  /** Moves an item one place within its own sibling group (same
   * parentItemId) and writes the whole group's new order in one request, so
   * a stale displayOrder on an untouched sibling can never desync the list. */
  async function move(item: Item, direction: -1 | 1) {
    setError("");
    const siblings = items
      .filter((row) => (row.parentItemId ?? null) === (item.parentItemId ?? null))
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const index = siblings.findIndex((row) => row.id === item.id);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await request(`/phase1/navigation-menus/${menuId}/items/reorder`, {
        method: "POST",
        body: JSON.stringify({
          parentItemId: item.parentItemId ?? null,
          orderedIds: reordered.map((row) => row.id),
        }),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reorder items");
    }
  }

  if (loading) return <p className="mt-6 text-sm text-[#667085]">Loading menu…</p>;
  if (!menu)
    return (
      <p className="mt-6 text-sm text-[#B42318]" role="alert">
        This menu could not be found.
      </p>
    );

  const topLevel = items
    .filter((item) => !item.parentItemId)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const childrenOf = (parentId: string) =>
    items
      .filter((item) => item.parentItemId === parentId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  const targetLabel = (item: Item) =>
    item.linkType === "NONE"
      ? "No link (group only)"
      : item.linkType === "PAGE"
        ? item.pageTitle
          ? `Page: ${item.pageTitle}`
          : "Page: (missing)"
        : item.customUrl ?? "";

  return (
    <section className="mt-8 rounded-2xl border border-[#E8ECF3] bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
            Navigation menu
          </p>
          <h3 className="mt-1 text-2xl font-semibold">{menu.name}</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
        >
          ← Back to menus
        </button>
      </div>

      {/* Where this menu affects the live site -- the single fact that was
       * missing everywhere before this fix, and the direct cause of ISS-019's
       * "obvious but unused" menu. */}
      <div
        role="status"
        className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${
          menu.usedAs
            ? "bg-[#E9F8F0] text-[#18794E]"
            : "bg-[#FFF7E6] text-[#8A5A00]"
        }`}
      >
        {menu.usedAs === "header" && "This menu is the live site's Header, on every public page."}
        {menu.usedAs === "footer" && "This menu is the live site's Footer, on every public page."}
        {!menu.usedAs &&
          `This menu is not connected to the Header or Footer. Editing it has no visible effect on ${WEB_ORIGIN} until Global Settings → Header/Footer is changed to point at menu key "${menu.menuKey}".`}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-[#FFF7F7] px-4 py-3 text-sm font-semibold text-[#B42318]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-4 rounded-xl bg-[#E9F8F0] px-4 py-3 text-sm font-semibold text-[#18794E]">
          {message}
        </p>
      ) : null}

      {/* Menu fields */}
      <form onSubmit={(event) => void saveMenuFields(event)} className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className={label}>
          Menu name
          <input
            className={input}
            value={menuDraft.name}
            onChange={(event) => setMenuDraft((v) => ({ ...v, name: event.target.value }))}
            required
          />
        </label>
        <label className={label}>
          Menu key
          <input
            className={input}
            value={menuDraft.menuKey}
            onChange={(event) => setMenuDraft((v) => ({ ...v, menuKey: event.target.value }))}
            required
          />
        </label>
        <label className={label}>
          Menu location
          <select
            className={input}
            value={menuDraft.location}
            onChange={(event) => setMenuDraft((v) => ({ ...v, location: event.target.value }))}
          >
            <option value="HEADER">Header</option>
            <option value="FOOTER">Footer</option>
          </select>
        </label>
        <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
          <button type="submit" className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white">
            Save menu details
          </button>
          <span className="text-sm text-[#667085]">
            Status: <strong>{menu.status}</strong>
          </span>
          {menu.status === "ACTIVE" ? (
            <button
              type="button"
              onClick={() => void setMenuStatus("INACTIVE")}
              className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-xs font-semibold"
            >
              Unpublish menu
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void setMenuStatus("ACTIVE")}
              className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white"
            >
              Publish menu
            </button>
          )}
          <a
            href={WEB_ORIGIN}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-sm font-semibold text-[#1657CF]"
          >
            View live site →
          </a>
        </div>
      </form>

      {/* Items */}
      <div className="mt-8 overflow-x-auto rounded-2xl border border-[#E8ECF3]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[#E8ECF3] text-[#667085]">
            <tr>
              <th className="p-3">Label</th>
              <th className="p-3">Target</th>
              <th className="p-3">New tab</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {topLevel.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-[#667085]">
                  This menu has no items yet.
                </td>
              </tr>
            ) : null}
            {topLevel.map((item) => (
              <>
                <tr key={item.id} className="border-b border-[#F0F2F5]">
                  <td className="p-3 font-semibold">{item.label}</td>
                  <td className="p-3 text-[#667085]">
                    {targetLabel(item)}
                    {item.brokenTarget ? (
                      <span className="ml-2 rounded-full bg-[#FFF1F0] px-2 py-0.5 text-xs font-semibold text-[#B42318]">
                        Broken target
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">{item.openInNewTab ? "Yes" : "No"}</td>
                  <td className="p-3">{item.status}</td>
                  <td className="flex flex-wrap gap-2 p-3">
                    <button
                      type="button"
                      onClick={() => move(item, -1)}
                      className="rounded-lg border border-[#D9E0EA] px-2 py-1 text-xs font-semibold"
                      aria-label={`Move ${item.label} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(item, 1)}
                      className="rounded-lg border border-[#D9E0EA] px-2 py-1 text-xs font-semibold"
                      aria-label={`Move ${item.label} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => beginEdit(item)}
                      className="rounded-lg border border-[#1657CF] px-3 py-1 text-xs font-semibold text-[#1657CF]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleItemStatus(item)}
                      className="rounded-lg border border-[#D9E0EA] px-3 py-1 text-xs font-semibold"
                    >
                      {item.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(item)}
                      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {childrenOf(item.id).map((child) => (
                  <tr key={child.id} className="border-b border-[#F0F2F5] bg-[#FAFBFD]">
                    <td className="p-3 pl-8 text-[#48505F]">↳ {child.label}</td>
                    <td className="p-3 text-[#667085]">
                      {targetLabel(child)}
                      {child.brokenTarget ? (
                        <span className="ml-2 rounded-full bg-[#FFF1F0] px-2 py-0.5 text-xs font-semibold text-[#B42318]">
                          Broken target
                        </span>
                      ) : null}
                    </td>
                    <td className="p-3">{child.openInNewTab ? "Yes" : "No"}</td>
                    <td className="p-3">{child.status}</td>
                    <td className="flex flex-wrap gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => move(child, -1)}
                        className="rounded-lg border border-[#D9E0EA] px-2 py-1 text-xs font-semibold"
                        aria-label={`Move ${child.label} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(child, 1)}
                        className="rounded-lg border border-[#D9E0EA] px-2 py-1 text-xs font-semibold"
                        aria-label={`Move ${child.label} down`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => beginEdit(child)}
                        className="rounded-lg border border-[#1657CF] px-3 py-1 text-xs font-semibold text-[#1657CF]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleItemStatus(child)}
                        className="rounded-lg border border-[#D9E0EA] px-3 py-1 text-xs font-semibold"
                      >
                        {child.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(child)}
                        className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / edit item */}
      <form
        onSubmit={(event) => void saveItem(event)}
        className="mt-6 grid gap-4 rounded-2xl border border-[#E8ECF3] bg-[#FAFBFD] p-5 sm:grid-cols-2"
      >
        <h4 className="sm:col-span-2 text-sm font-bold uppercase tracking-[0.1em] text-[#828B9B]">
          {itemDraft.id ? "Edit item" : "Add item"}
        </h4>
        <label className={label}>
          Item label
          <input
            className={input}
            value={itemDraft.label}
            onChange={(event) => setItemDraft((v) => ({ ...v, label: event.target.value }))}
            required
          />
        </label>
        <label className={label}>
          Link type
          <select
            className={input}
            value={itemDraft.linkType}
            onChange={(event) =>
              setItemDraft((v) => ({ ...v, linkType: event.target.value as Item["linkType"] }))
            }
          >
            <option value="PAGE">Internal page</option>
            <option value="CUSTOM">External or custom URL</option>
            <option value="NONE">No link (dropdown group only)</option>
          </select>
        </label>
        {itemDraft.linkType === "PAGE" ? (
          <label className={label}>
            Internal target
            <select
              className={input}
              value={itemDraft.pageId}
              onChange={(event) => setItemDraft((v) => ({ ...v, pageId: event.target.value }))}
              required
            >
              <option value="">Select a page</option>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.title} (/{page.slug})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {itemDraft.linkType === "CUSTOM" ? (
          <label className={label}>
            External URL
            <input
              className={input}
              placeholder="/about or https://example.com"
              value={itemDraft.customUrl}
              onChange={(event) => setItemDraft((v) => ({ ...v, customUrl: event.target.value }))}
              required
            />
          </label>
        ) : null}
        <label className={label}>
          Parent item
          <select
            className={input}
            value={itemDraft.parentItemId}
            onChange={(event) => setItemDraft((v) => ({ ...v, parentItemId: event.target.value }))}
          >
            <option value="">None (top level)</option>
            {topLevel
              .filter((row) => row.id !== itemDraft.id)
              .map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm font-semibold">
          <input
            type="checkbox"
            checked={itemDraft.openInNewTab}
            onChange={(event) => setItemDraft((v) => ({ ...v, openInNewTab: event.target.checked }))}
          />
          Open in a new tab
        </label>
        <label className={label}>
          Item status
          <select
            className={input}
            value={itemDraft.status}
            onChange={(event) =>
              setItemDraft((v) => ({ ...v, status: event.target.value as Item["status"] }))
            }
          >
            <option value="ACTIVE">Active (visible on the site)</option>
            <option value="INACTIVE">Inactive (hidden)</option>
          </select>
        </label>
        <div className="sm:col-span-2 flex gap-3">
          <button type="submit" className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white">
            {itemDraft.id ? "Save item" : "Add item"}
          </button>
          {itemDraft.id ? (
            <button
              type="button"
              onClick={resetDraft}
              className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-item-delete-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="nav-item-delete-title" className="text-lg font-semibold">
              Delete this item?
            </h3>
            <p className="mt-2 text-sm text-[#667085]">
              &ldquo;{pendingDelete.label}&rdquo; will be permanently removed from this menu.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removeItem(pendingDelete)}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Delete item
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
