"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { MediaPickerDialog } from "@/features/catalog/editorial/MediaPickerDialog";
import { listEditorialMedia } from "@/features/catalog/catalog-client";
import type { EditorialMedia } from "@/features/catalog/catalog.types";

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";

type Groups = {
  header: Record<string, unknown>;
  branding: Record<string, unknown>;
  general: Record<string, unknown>;
};
type MenuOption = { key: string; label: string };

/** Global Header editing in the admin's own terms.
 *
 * Every control here maps to something the public header genuinely does --
 * see apps/web/src/components/chrome/GlobalNav.tsx. Settings the header
 * ignores are not offered, because a control that looks like it works and
 * changes nothing is worse than no control. */
export function GlobalHeaderWorkspace() {
  const [groups, setGroups] = useState<Groups | null>(null);
  const [menus, setMenus] = useState<MenuOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [mediaOptions, setMediaOptions] = useState<EditorialMedia[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [settingsResponse, menuResponse] = await Promise.all([
          authFetch("/api/v1/admin/settings", { cache: "no-store" }),
          authFetch("/api/v1/admin/phase1/navigation-menus?limit=50", {
            cache: "no-store",
          }),
        ]);
        const settingsBody = await settingsResponse.json();
        const menuBody = await menuResponse.json();
        if (cancelled) return;
        const rows = (settingsBody?.data ?? []) as {
          group: string;
          values: Record<string, unknown>;
        }[];
        const find = (name: string) =>
          rows.find((row) => row.group === name)?.values ?? {};
        setGroups({
          header: find("header"),
          branding: find("branding"),
          general: find("general"),
        });
        setMenus(
          ((menuBody?.data ?? []) as Record<string, unknown>[])
            .map((row) => ({
              key: String(row.menuKey ?? ""),
              label: String(row.name ?? row.menuKey ?? ""),
            }))
            .filter((row) => row.key),
        );
      } catch {
        if (!cancelled) setMessage("Unable to load the header");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await listEditorialMedia({ limit: 48 });
        if (!cancelled) setMediaOptions(result.data);
      } catch {
        if (!cancelled) setMediaOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setHeader(patch: Record<string, unknown>) {
    setGroups((current) =>
      current ? { ...current, header: { ...current.header, ...patch } } : current,
    );
  }

  async function save() {
    if (!groups) return;
    setBusy(true);
    setMessage("");
    try {
      // Branding and header are separate settings groups but one screen to the
      // admin, so both go in a single action rather than a button each.
      for (const [group, values] of [
        ["header", groups.header],
        ["branding", groups.branding],
        ["general", groups.general],
      ] as const) {
        const response = await authFetch(`/api/v1/admin/settings/${group}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        });
        const body = await response.json();
        if (!response.ok || body?.error)
          throw new Error(body?.error?.message ?? "Unable to save the header");
      }
      setMessage("Header saved.");
      setReloadKey((value) => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the header");
    } finally {
      setBusy(false);
    }
  }

  if (!groups) return <p className="mt-6 text-sm text-[#667085]">Loading header…</p>;
  const header = groups.header;
  const logoId = (groups.branding.logoMediaId as string | null) ?? null;

  return (
    <section className="mt-6 space-y-4" aria-label="Global Header settings">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-[#667085]">
          The bar at the top of every page on your website.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save header
        </button>
      </div>

      <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
        <legend className="px-1 text-sm font-semibold">Branding</legend>
        <p className="text-xs text-[#828B9B]">
          Your logo appears at the top left and links to the home page. With no
          logo your site name is shown as text instead.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Site name
            <input
              value={(groups.general.siteName as string) ?? ""}
              onChange={(event) =>
                setGroups((current) =>
                  current
                    ? {
                        ...current,
                        general: { ...current.general, siteName: event.target.value },
                      }
                    : current,
                )
              }
              className={inputClass}
            />
          </label>
          <MediaPickerDialog
            label="Logo"
            value={logoId ?? ""}
            media={mediaOptions}
            onChange={(value) =>
              setGroups((current) =>
                current
                  ? {
                      ...current,
                      branding: {
                        ...current.branding,
                        logoMediaId: value || null,
                      },
                    }
                  : current,
              )
            }
          />
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
        <legend className="px-1 text-sm font-semibold">Menu</legend>
        <label className="block text-sm font-semibold">
          Which menu appears in the header
          <select
            value={(header.menuKey as string) ?? "header"}
            onChange={(event) => setHeader({ menuKey: event.target.value })}
            className={inputClass}
          >
            {menus.map((menu) => (
              <option key={menu.key} value={menu.key}>
                {menu.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-[#828B9B]">
          The links themselves are edited in Website Builder → Navigation menus.
        </p>
      </fieldset>

      <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
        <legend className="px-1 text-sm font-semibold">Main button</legend>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={header.ctaVisible !== false}
            onChange={(event) => setHeader({ ctaVisible: event.target.checked })}
          />
          Show a button in the header
        </label>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Button text
            <input
              value={(header.ctaLabel as string) ?? ""}
              onChange={(event) => setHeader({ ctaLabel: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Where it goes
            <input
              value={(header.ctaUrl as string) ?? ""}
              onChange={(event) => setHeader({ ctaUrl: event.target.value })}
              placeholder="/counselling"
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
        <legend className="px-1 text-sm font-semibold">Announcement bar</legend>
        <p className="text-xs text-[#828B9B]">
          A thin strip above the header, for a notice you want on every page.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={header.announcementVisible === true}
            onChange={(event) =>
              setHeader({ announcementVisible: event.target.checked })
            }
          />
          Show the announcement bar
        </label>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Message
            <input
              value={(header.announcementText as string) ?? ""}
              onChange={(event) =>
                setHeader({ announcementText: event.target.value })
              }
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Link (optional)
            <input
              value={(header.announcementUrl as string) ?? ""}
              onChange={(event) =>
                setHeader({ announcementUrl: event.target.value })
              }
              placeholder="/news"
              className={inputClass}
            />
          </label>
        </div>
      </fieldset>

      <details className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          Advanced
        </summary>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={header.sticky !== false}
            onChange={(event) => setHeader({ sticky: event.target.checked })}
          />
          Keep the header visible while scrolling
        </label>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Secondary link text
            <input
              value={(header.accountCtaLabel as string) ?? ""}
              onChange={(event) =>
                setHeader({ accountCtaLabel: event.target.value })
              }
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Secondary link destination
            <input
              value={(header.accountCtaUrl as string) ?? ""}
              onChange={(event) => setHeader({ accountCtaUrl: event.target.value })}
              className={inputClass}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-[#828B9B]">
          The secondary link only appears when both a label and a destination
          are set.
        </p>
      </details>

      {message ? (
        <p className="text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}

    </section>
  );
}
