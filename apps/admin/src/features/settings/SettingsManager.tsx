"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { useSectionFocus } from "@/features/shell/use-section-focus";
import { FieldLabel } from "@/features/shared/FieldLabel";

type FieldType = "text" | "textarea" | "color" | "checkbox" | "media" | "url" | "email";
type FieldDef = { key: string; label: string; type: FieldType; placeholder?: string };
type MediaOption = { id: string; altText?: string | null; originalFileName?: string | null };

/** Exported so the dynamic field-help coverage test can compute every
 * `settings.<group>.<key>` helpKey this screen builds at runtime (see
 * `GroupForm`'s `helpKey = \`settings.${group}.${field.key}\`` below) and
 * assert each one resolves in the registry — the static helpKey scan alone
 * cannot see this since the key is built from data, not written literally. */
export const GROUP_FIELDS: Record<string, { title: string; description: string; fields: FieldDef[] }> = {
  general: {
    title: "General",
    description: "Core site identity used across Admin and the public site.",
    fields: [
      { key: "siteName", label: "Site name", type: "text" },
      { key: "defaultLocale", label: "Default locale", type: "text", placeholder: "en" },
      { key: "defaultTimezone", label: "Default timezone", type: "text", placeholder: "America/Toronto" },
      { key: "supportEmail", label: "Support email", type: "email" },
      { key: "supportPhone", label: "Support phone", type: "text" },
    ],
  },
  branding: {
    title: "Branding",
    description: "Logo, favicon and brand colors used site-wide.",
    fields: [
      { key: "logoMediaId", label: "Logo", type: "media" },
      { key: "faviconMediaId", label: "Favicon", type: "media" },
      { key: "primaryColor", label: "Primary brand color", type: "color" },
      { key: "secondaryColor", label: "Secondary brand color", type: "color" },
      { key: "defaultSocialImageMediaId", label: "Default social share image", type: "media" },
    ],
  },
  contact: {
    title: "Contact",
    description: "Contact details shown to visitors.",
    fields: [
      { key: "address", label: "Registered / business address", type: "textarea" },
      { key: "email", label: "Contact email", type: "email" },
      { key: "counsellingPhone", label: "Counselling phone", type: "text" },
      { key: "whatsappLink", label: "WhatsApp / contact link (optional)", type: "url" },
    ],
  },
  social: {
    title: "Social links",
    description: "Leave any field blank to hide that icon publicly.",
    fields: [
      { key: "facebook", label: "Facebook", type: "url" },
      { key: "instagram", label: "Instagram", type: "url" },
      { key: "linkedin", label: "LinkedIn", type: "url" },
      { key: "youtube", label: "YouTube", type: "url" },
      { key: "twitter", label: "X / Twitter", type: "url" },
    ],
  },
  header: {
    title: "Global Header",
    description:
      "Applies to the header on every public page. Menu items themselves are ordered in Navigation menus.",
    fields: [
      { key: "menuKey", label: "Navigation menu key", type: "text", placeholder: "header" },
      { key: "ctaLabel", label: "Primary CTA label", type: "text" },
      { key: "ctaUrl", label: "Primary CTA destination", type: "url" },
      { key: "ctaVisible", label: "Show the header CTA", type: "checkbox" },
      { key: "sticky", label: "Keep the header visible while scrolling", type: "checkbox" },
      { key: "announcementText", label: "Announcement bar text", type: "text" },
      { key: "announcementUrl", label: "Announcement bar link (optional)", type: "url" },
      { key: "announcementVisible", label: "Show the announcement bar", type: "checkbox" },
      { key: "accountCtaLabel", label: "Account CTA label (optional)", type: "text" },
      { key: "accountCtaUrl", label: "Account CTA destination (hidden until set)", type: "url" },
    ],
  },
  footer: {
    title: "Global Footer",
    description:
      "Applies to the footer on every public page. Footer link columns are ordered in Navigation menus.",
    fields: [
      { key: "menuKey", label: "Navigation menu key", type: "text", placeholder: "footer" },
      { key: "description", label: "Footer description", type: "textarea" },
      { key: "counsellingCtaLabel", label: "Counselling CTA label", type: "text" },
      { key: "counsellingCtaUrl", label: "Counselling CTA destination", type: "url" },
      { key: "counsellingCtaVisible", label: "Show the counselling CTA", type: "checkbox" },
      { key: "showContact", label: "Show the contact column", type: "checkbox" },
      { key: "showSocial", label: "Show social links", type: "checkbox" },
      { key: "copyrightText", label: "Copyright text", type: "text" },
      { key: "privacyUrl", label: "Privacy policy URL (optional)", type: "url" },
      { key: "termsUrl", label: "Terms URL (optional)", type: "url" },
    ],
  },
  seo: {
    title: "Default SEO",
    description: "Fallback values used when a page has no SEO of its own.",
    fields: [
      { key: "defaultTitleSuffix", label: "Default title suffix", type: "text" },
      { key: "defaultDescription", label: "Default meta description", type: "textarea" },
      { key: "defaultOgImageMediaId", label: "Default Open Graph image", type: "media" },
      { key: "defaultRobotsIndex", label: "Allow search engines to index by default", type: "checkbox" },
      { key: "defaultRobotsFollow", label: "Allow search engines to follow links by default", type: "checkbox" },
    ],
  },
};
const GROUP_ORDER = ["general", "branding", "contact", "social", "header", "footer", "seo"];

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const buttonClass = "rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/settings${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { data?: T; error?: { message?: string } | null };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

function GroupForm({
  group,
  values: initialValues,
  media,
  onSaved,
}: {
  group: string;
  values: Record<string, unknown>;
  media: MediaOption[];
  onSaved: (group: string, values: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const config = GROUP_FIELDS[group];

  function set(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const saved = await api<{ values: Record<string, unknown> }>(`/${group}`, {
        method: "PUT",
        body: JSON.stringify(values),
      });
      setValues(saved.values);
      onSaved(group, saved.values);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="rounded-2xl border border-[#E8ECF3] bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Platform settings</p>
      <h3 className="mt-2 text-xl font-semibold">{config.title}</h3>
      <p className="mt-2 text-sm text-[#667085]">{config.description}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {config.fields.map((field) => {
          const value = values[field.key];
          const helpKey = `settings.${group}.${field.key}`;
          // Explicit id/htmlFor, not a wrapping <label> — FieldLabel's
          // help-icon <button> breaks an implicitly-wrapping label's
          // accessible-name link in real browsers.
          const fieldId = `settings-${group}-${field.key}`;
          if (field.type === "checkbox")
            return (
              <div key={field.key} className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                <input
                  id={fieldId}
                  type="checkbox"
                  checked={value !== false}
                  onChange={(event) => set(field.key, event.target.checked)}
                />
                <FieldLabel label={field.label} htmlFor={fieldId} helpKey={helpKey} />
              </div>
            );
          if (field.type === "media")
            return (
              <div key={field.key} className="block text-sm font-semibold">
                <FieldLabel label={field.label} htmlFor={fieldId} helpKey={helpKey} />
                <select id={fieldId} className={inputClass} value={(value as string) ?? ""} onChange={(event) => set(field.key, event.target.value || null)}>
                  <option value="">None</option>
                  {media.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.altText || item.originalFileName || item.id}
                    </option>
                  ))}
                </select>
              </div>
            );
          if (field.type === "color")
            return (
              <div key={field.key} className="block text-sm font-semibold">
                <FieldLabel label={field.label} htmlFor={fieldId} helpKey={helpKey} />
                <div className="mt-1 flex items-center gap-2">
                  <input aria-label={`${field.label} swatch`} type="color" value={(value as string) || "#1657CF"} onChange={(event) => set(field.key, event.target.value)} className="h-10 w-14 rounded-lg border border-[#D9E0EA]" />
                  <input id={fieldId} className={inputClass} value={(value as string) ?? ""} onChange={(event) => set(field.key, event.target.value)} />
                </div>
              </div>
            );
          if (field.type === "textarea")
            return (
              <div key={field.key} className="block text-sm font-semibold sm:col-span-2">
                <FieldLabel label={field.label} htmlFor={fieldId} helpKey={helpKey} />
                <textarea id={fieldId} className={`${inputClass} min-h-20`} value={(value as string) ?? ""} onChange={(event) => set(field.key, event.target.value)} />
              </div>
            );
          return (
            <div key={field.key} className="block text-sm font-semibold">
              <FieldLabel label={field.label} htmlFor={fieldId} helpKey={helpKey} />
              <input
                id={fieldId}
                type={field.type === "email" ? "email" : "text"}
                className={inputClass}
                placeholder={field.placeholder}
                value={(value as string) ?? ""}
                onChange={(event) => set(field.key, event.target.value)}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button disabled={saving} className={buttonClass}>{saving ? "Saving…" : "Save"}</button>
        {message ? <p className={`text-sm font-semibold ${message === "Saved." ? "text-[#18794E]" : "text-[#B42318]"}`} role={message === "Saved." ? "status" : "alert"}>{message}</p> : null}
      </div>
    </form>
  );
}

export function SettingsManager({
  only,
  eyebrow = "Global configuration",
  title = "Settings",
  intro = "Global platform configuration — every value here is served to the public site. Universities, Scholarships and Consultants have their own dedicated sections and are not managed here.",
}: {
  /** Render just these groups. Website Builder uses this for the focused
   * Global Header and Global Footer screens, which read and write the very
   * same settings rows as the full Settings page. */
  only?: string[];
  eyebrow?: string;
  title?: string;
  intro?: string;
} = {}) {
  const focused = useSectionFocus(GROUP_ORDER);
  const [groups, setGroups] = useState<{ group: string; values: Record<string, unknown> }[]>([]);
  const [media, setMedia] = useState<MediaOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setGroups(await api<{ group: string; values: Record<string, unknown> }[]>(""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The state updates happen only after the asynchronous requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void authFetch("/api/v1/admin/media-options")
      .then((response) => response.json())
      .then((body: { data?: MediaOption[] }) => setMedia(body.data ?? []))
      .catch(() => undefined);
  }, [load]);

  function onSaved(group: string, values: Record<string, unknown>) {
    setGroups((current) => current.map((row) => (row.group === group ? { ...row, values } : row)));
  }

  return (
    <section className="mx-auto max-w-[1180px]">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">{intro}</p>
      {error ? <p className="mt-4 text-sm font-semibold text-[#B42318]" role="alert">{error}</p> : null}
      {loading ? (
        <p className="mt-8 text-sm text-[#667085]">Loading…</p>
      ) : (
        <div className="mt-8 grid gap-6">
          {(only ?? (focused ? [focused] : GROUP_ORDER)).map((group) => {
            const row = groups.find((g) => g.group === group);
            if (!row) return null;
            return <GroupForm key={group} group={group} values={row.values} media={media} onSaved={onSaved} />;
          })}
        </div>
      )}
    </section>
  );
}
