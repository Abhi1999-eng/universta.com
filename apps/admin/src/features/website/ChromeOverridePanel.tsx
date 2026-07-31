"use client";

/** Structured Header/Footer override controls for one Page or PageTemplate.
 *
 * Every control here is a select or a checkbox -- there is deliberately no
 * JSON field, because the whole point of the override system is that an admin
 * can change page chrome without touching code or raw data.
 *
 * The two safety behaviours the brief calls for live here rather than in the
 * API, because they are about what a person is about to do: hiding both the
 * header and the footer asks for confirmation, and hiding the footer warns
 * that the legal and contact links live there. */

export type ChromeMode = "USE_GLOBAL" | "HIDE" | "ALTERNATE_VARIANT";

export type ChromeOverrideValue = {
  header?: {
    mode: ChromeMode;
    variant?: string;
    navigationMenuKey?: string | null;
    announcementVisible?: boolean;
    ctaVisible?: boolean;
    ctaLabel?: string;
    ctaUrl?: string;
  };
  footer?: {
    mode: ChromeMode;
    variant?: string;
    navigationMenuKey?: string | null;
    footerCtaVisible?: boolean;
    counsellingCtaVisible?: boolean;
  };
} | null;

const MODES: Array<{ value: ChromeMode; label: string; hint: string }> = [
  {
    value: "USE_GLOBAL",
    label: "Use Global",
    hint: "Inherits the Global Header/Footer. This is the default.",
  },
  {
    value: "ALTERNATE_VARIANT",
    label: "Alternate variant",
    hint: "Same Admin-managed navigation and settings, different presentation.",
  },
  { value: "HIDE", label: "Hide", hint: "Not rendered on this page at all." },
];

const HEADER_VARIANTS = ["default", "compact", "centered", "minimal"];
const FOOTER_VARIANTS = ["default", "compact", "minimal"];

const selectClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm outline-none focus:border-[#1657CF]";

export function ChromeOverridePanel({
  value,
  onChange,
  menuOptions,
  scopeLabel,
  inheritedNote,
}: {
  value: ChromeOverrideValue;
  onChange: (next: ChromeOverrideValue) => void;
  /** Admin-managed navigation menus. An alternate variant picks one of these;
   * it never supplies its own links. */
  menuOptions: Array<{ menuKey: string; name: string }>;
  scopeLabel: string;
  /** Shown when this page inherits an override from its template, so the
   * admin can see why the page looks different before changing anything. */
  inheritedNote?: string | null;
}) {
  const header = value?.header ?? { mode: "USE_GLOBAL" as ChromeMode };
  const footer = value?.footer ?? { mode: "USE_GLOBAL" as ChromeMode };

  const patch = (next: Partial<NonNullable<ChromeOverrideValue>>) => {
    const merged = { header, footer, ...next };
    // Both back to Global means "no override at all", which is stored as null
    // so the page cleanly falls through to its template or the global chrome.
    if (merged.header.mode === "USE_GLOBAL" && merged.footer.mode === "USE_GLOBAL") {
      onChange(null);
      return;
    }
    onChange(merged);
  };

  type HeaderPatch = Partial<NonNullable<NonNullable<ChromeOverrideValue>["header"]>>;
  type FooterPatch = Partial<NonNullable<NonNullable<ChromeOverrideValue>["footer"]>>;
  const setHeader = (next: HeaderPatch) => patch({ header: { ...header, ...next } });
  const setFooter = (next: FooterPatch) => patch({ footer: { ...footer, ...next } });

  const bothHidden = header.mode === "HIDE" && footer.mode === "HIDE";

  /** Hiding both leaves a page with no navigation in or out, so it is worth a
   * stop rather than a note. */
  const confirmHide = (which: "header" | "footer") => {
    const other = which === "header" ? footer.mode : header.mode;
    if (other !== "HIDE") return true;
    return window.confirm(
      "Hiding both the Header and the Footer leaves this page with no site navigation, no contact details and no legal links. Visitors will only be able to leave using the browser Back button.\n\nHide both anyway?",
    );
  };

  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="px-1 text-sm font-semibold">Header &amp; Footer</legend>
      <p className="text-xs leading-5 text-[#828B9B]">
        {scopeLabel} inherits the Global Header and Footer unless you change it here. An
        alternate variant restyles the same Admin-managed navigation and settings — it does
        not create a separate header.
      </p>
      {inheritedNote ? (
        <p className="mt-2 rounded-lg bg-[#EEF4FF] px-3 py-2 text-xs font-semibold text-[#1657CF]">
          {inheritedNote}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold">
            Header
            <select
              className={selectClass}
              value={header.mode}
              onChange={(event) => {
                const mode = event.target.value as ChromeMode;
                if (mode === "HIDE" && !confirmHide("header")) return;
                setHeader({ mode });
              }}
            >
              {MODES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-[#828B9B]">
            {MODES.find((option) => option.value === header.mode)?.hint}
          </p>

          {header.mode === "ALTERNATE_VARIANT" ? (
            <div className="mt-3 space-y-3">
              <label className="block text-sm font-semibold">
                Header variant
                <select
                  className={selectClass}
                  value={header.variant ?? "default"}
                  onChange={(event) => setHeader({ variant: event.target.value })}
                >
                  {HEADER_VARIANTS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Navigation menu
                <select
                  className={selectClass}
                  value={header.navigationMenuKey ?? ""}
                  onChange={(event) =>
                    setHeader({ navigationMenuKey: event.target.value || null })
                  }
                >
                  <option value="">Use the Global header menu</option>
                  {menuOptions.map((menu) => (
                    <option key={menu.menuKey} value={menu.menuKey}>
                      {menu.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {header.mode !== "HIDE" ? (
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={header.announcementVisible !== false}
                  onChange={(event) =>
                    setHeader({ announcementVisible: event.target.checked })
                  }
                />
                Show the announcement bar
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={header.ctaVisible !== false}
                  onChange={(event) => setHeader({ ctaVisible: event.target.checked })}
                />
                Show the primary call to action
              </label>
              {header.ctaVisible !== false ? (
                <>
                  <label className="block text-sm font-semibold">
                    CTA label override
                    <input
                      className={selectClass}
                      value={header.ctaLabel ?? ""}
                      placeholder="Leave blank to use the Global label"
                      onChange={(event) => setHeader({ ctaLabel: event.target.value })}
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    CTA destination override
                    <input
                      className={selectClass}
                      value={header.ctaUrl ?? ""}
                      placeholder="Leave blank to use the Global destination"
                      onChange={(event) => setHeader({ ctaUrl: event.target.value })}
                    />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-semibold">
            Footer
            <select
              className={selectClass}
              value={footer.mode}
              onChange={(event) => {
                const mode = event.target.value as ChromeMode;
                if (mode === "HIDE" && !confirmHide("footer")) return;
                setFooter({ mode });
              }}
            >
              {MODES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-[#828B9B]">
            {MODES.find((option) => option.value === footer.mode)?.hint}
          </p>

          {footer.mode === "HIDE" ? (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-[#FFF8E6] px-3 py-2 text-xs font-semibold text-[#6B5312]"
            >
              The footer carries the privacy policy, terms and contact details. Hiding it
              removes the only place those links appear on this page — make sure they are
              reachable some other way.
            </p>
          ) : null}

          {footer.mode === "ALTERNATE_VARIANT" ? (
            <div className="mt-3 space-y-3">
              <label className="block text-sm font-semibold">
                Footer variant
                <select
                  className={selectClass}
                  value={footer.variant ?? "default"}
                  onChange={(event) => setFooter({ variant: event.target.value })}
                >
                  {FOOTER_VARIANTS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Footer menu
                <select
                  className={selectClass}
                  value={footer.navigationMenuKey ?? ""}
                  onChange={(event) =>
                    setFooter({ navigationMenuKey: event.target.value || null })
                  }
                >
                  <option value="">Use the Global footer menu</option>
                  {menuOptions.map((menu) => (
                    <option key={menu.menuKey} value={menu.menuKey}>
                      {menu.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {footer.mode !== "HIDE" ? (
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={footer.footerCtaVisible !== false}
                  onChange={(event) => setFooter({ footerCtaVisible: event.target.checked })}
                />
                Show the footer call to action
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={footer.counsellingCtaVisible !== false}
                  onChange={(event) =>
                    setFooter({ counsellingCtaVisible: event.target.checked })
                  }
                />
                Show the counselling call to action
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {bothHidden ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs font-semibold text-[#B42318]"
        >
          Both the Header and the Footer are hidden on this page. Visitors will have no
          navigation, no contact details and no legal links.
        </p>
      ) : null}
    </fieldset>
  );
}
