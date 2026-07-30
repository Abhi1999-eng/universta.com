"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { MediaPickerDialog } from "@/features/catalog/editorial/MediaPickerDialog";
import { InternalLinkPicker } from "./InternalLinkPicker";
import { listEditorialMedia } from "@/features/catalog/catalog-client";
import type { EditorialMedia } from "@/features/catalog/catalog.types";

type SectionRow = {
  label: string;
  value: string;
  description?: string;
  url?: string;
};
type SectionBody = {
  paragraphs?: string[];
  supportingText?: string;
  caption?: string;
  imagePosition?: "left" | "right";
  items?: SectionRow[];
  limit?: number;
};
type Section = {
  id: string;
  sectionKey: string;
  sectionType: string;
  eyebrow?: string | null;
  heading?: string | null;
  subheading?: string | null;
  ctaPrimaryLabel?: string | null;
  ctaPrimaryUrl?: string | null;
  mediaId?: string | null;
  media?: { id: string; publicUrl?: string; url?: string; altText?: string | null; title?: string | null } | null;
  bodyJson?: SectionBody | null;
  status: string;
  displayOrder: number;
  startsAt?: string | null;
  endsAt?: string | null;
  configurationJson?: { visibility?: SectionVisibility } | null;
};
/** Per-device visibility. Absent means visible everywhere, so sections created
 * before this feature keep rendering unchanged. */
type SectionVisibility = { desktop?: boolean; tablet?: boolean; mobile?: boolean };
const DEVICES: Array<{ key: keyof SectionVisibility; label: string }> = [
  { key: "desktop", label: "Show on Desktop" },
  { key: "tablet", label: "Show on Tablet" },
  { key: "mobile", label: "Show on Mobile" },
];
type Seo = {
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  focusKeyword?: string | null;
};
type PageTemplateOption = { id: string; name: string; pageFamily: string; isActive: boolean };
type PageRecord = {
  id: string;
  pageType: string;
  title: string;
  slug: string;
  shortDescription?: string | null;
  layoutKey?: string | null;
  templateId?: string | null;
  template?: PageTemplateOption | null;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
  sections?: Section[];
  seo?: Seo | null;
};

const SECTION_TYPES = [
  "HERO",
  "RICH_TEXT",
  "CTA",
  "IMAGE",
  "IMAGE_TEXT",
  "CARD_GRID",
  "STATS",
  "FAQ_GROUP",
  "RELATED_LINKS",
  "COUNTRY_DIRECTORY",
  "UNIVERSITY_DIRECTORY",
  "COURSE_DIRECTORY",
  "SCHOLARSHIP_DIRECTORY",
  "CONSULTANT_DIRECTORY",
  "TESTIMONIALS",
  "SUCCESS_STORIES",
  "LEAD_GENERATION",
  "CUSTOM",
];
const PAGE_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"];
const SECTION_STATUSES = ["DRAFT", "SCHEDULED", "ACTIVE", "ARCHIVED"];
const LAYOUT_KEYS = ["default", "editorial", "landing"];

const DIRECTORY_TYPES = new Set([
  "COUNTRY_DIRECTORY",
  "UNIVERSITY_DIRECTORY",
  "COURSE_DIRECTORY",
  "SCHOLARSHIP_DIRECTORY",
  "CONSULTANT_DIRECTORY",
  "TESTIMONIALS",
  "SUCCESS_STORIES",
]);
const DIRECTORY_LABELS: Record<string, string> = {
  COUNTRY_DIRECTORY: "published countries",
  UNIVERSITY_DIRECTORY: "published universities",
  COURSE_DIRECTORY: "published generic courses",
  SCHOLARSHIP_DIRECTORY: "published scholarships",
  CONSULTANT_DIRECTORY: "published consultants",
  TESTIMONIALS: "published testimonials",
  SUCCESS_STORIES: "published success stories",
};
const ROW_TYPES: Record<
  string,
  { legend: string; primary: string; secondary?: string; hasUrl?: boolean }
> = {
  CARD_GRID: { legend: "Cards", primary: "Title", secondary: "Description", hasUrl: true },
  FAQ_GROUP: { legend: "Questions", primary: "Question", secondary: "Answer" },
  STATS: { legend: "Stats", primary: "Label (e.g. Partner universities)", secondary: "Value (e.g. 120+)" },
  RELATED_LINKS: { legend: "Links", primary: "Link label", hasUrl: true },
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/phase1/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as {
    data?: T;
    error?: { message?: string } | null;
  };
  if (!response.ok || body.error)
    throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  type?: string;
}) {
  const fieldId = useId();
  return (
    <div className="block text-sm font-semibold">
      <label htmlFor={fieldId}>{label}</label>
      {textarea ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} min-h-20`}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const fieldId = useId();
  return (
    <div className="block text-sm font-semibold">
      <label htmlFor={fieldId}>{label}</label>
      <select
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionRowsEditor({
  config,
  rows,
  onChange,
}: {
  config: { legend: string; primary: string; secondary?: string; hasUrl?: boolean };
  rows: SectionRow[];
  onChange: (rows: SectionRow[]) => void;
}) {
  const items = rows.length ? rows : [{ label: "", value: "" }];
  function update(index: number, patch: Partial<SectionRow>) {
    onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="px-1 text-sm font-semibold">{config.legend}</legend>
      <div className="space-y-3">
        {items.map((row, index) => (
          <div key={index} className="rounded-lg border border-[#E8ECF3] p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={config.primary}
                value={row.label}
                onChange={(value) => update(index, { label: value })}
              />
              {config.secondary ? (
                <Field
                  label={config.secondary}
                  value={row.value}
                  onChange={(value) => update(index, { value })}
                />
              ) : null}
              {config.hasUrl ? (
                <InternalLinkPicker
                  label="Link URL (optional)"
                  value={row.url ?? ""}
                  onChange={(value) => update(index, { url: value })}
                />
              ) : null}
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700"
              >
                Remove row
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, { label: "", value: "" }])}
        className="mt-3 rounded-lg border border-[#E8ECF3] px-3 py-2 text-xs font-semibold"
      >
        Add row
      </button>
    </fieldset>
  );
}

function SectionBodyFields({
  sectionType,
  mediaId,
  media,
  mediaOptions,
  body,
  onMediaChange,
  onBodyChange,
}: {
  sectionType: string;
  mediaId?: string | null;
  media?: EditorialMedia[];
  mediaOptions: EditorialMedia[];
  body: SectionBody;
  onMediaChange: (mediaId: string) => void;
  onBodyChange: (body: SectionBody) => void;
}) {
  if (sectionType === "RICH_TEXT") {
    const paragraphs = body.paragraphs?.length ? body.paragraphs : [""];
    return (
      <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
        <legend className="px-1 text-sm font-semibold">Paragraphs</legend>
        <div className="space-y-3">
          {paragraphs.map((paragraph, index) => (
            <div key={index} className="flex gap-2">
              <textarea
                aria-label={`Paragraph ${index + 1}`}
                value={paragraph}
                onChange={(event) =>
                  onBodyChange({
                    ...body,
                    paragraphs: paragraphs.map((item, i) =>
                      i === index ? event.target.value : item,
                    ),
                  })
                }
                className={`${inputClass} min-h-20`}
              />
              {paragraphs.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    onBodyChange({
                      ...body,
                      paragraphs: paragraphs.filter((_, i) => i !== index),
                    })
                  }
                  className="self-start rounded-lg border border-[#E8ECF3] px-2 py-2 text-xs font-semibold"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onBodyChange({ ...body, paragraphs: [...paragraphs, ""] })}
          className="mt-3 rounded-lg border border-[#E8ECF3] px-3 py-2 text-xs font-semibold"
        >
          Add paragraph
        </button>
        <p className="mt-2 text-xs text-[#828B9B]">
          Plain text only — rendered safely without any HTML markup.
        </p>
      </fieldset>
    );
  }
  if (sectionType === "CTA") {
    return (
      <Field
        label="Supporting text (optional)"
        value={body.supportingText ?? ""}
        onChange={(value) => onBodyChange({ ...body, supportingText: value })}
        textarea
      />
    );
  }
  if (sectionType === "IMAGE" || sectionType === "IMAGE_TEXT") {
    return (
      <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
        <legend className="px-1 text-sm font-semibold">Image</legend>
        <div className="space-y-3">
          <MediaPickerDialog
            label="Image"
            value={mediaId ?? ""}
            media={media?.length ? media : mediaOptions}
            onChange={onMediaChange}
          />
          <Field
            label="Caption (optional)"
            value={body.caption ?? ""}
            onChange={(value) => onBodyChange({ ...body, caption: value })}
          />
          {sectionType === "IMAGE_TEXT" ? (
            <Select
              label="Image position"
              value={body.imagePosition ?? "left"}
              options={["left", "right"]}
              onChange={(value) =>
                onBodyChange({ ...body, imagePosition: value as "left" | "right" })
              }
            />
          ) : null}
        </div>
      </fieldset>
    );
  }
  if (ROW_TYPES[sectionType]) {
    return (
      <SectionRowsEditor
        config={ROW_TYPES[sectionType]}
        rows={body.items ?? []}
        onChange={(items) => onBodyChange({ ...body, items })}
      />
    );
  }
  if (DIRECTORY_TYPES.has(sectionType)) {
    return (
      <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
        <legend className="px-1 text-sm font-semibold">Live directory</legend>
        <Field
          label="How many to show"
          type="number"
          value={String(body.limit ?? 6)}
          onChange={(value) => onBodyChange({ ...body, limit: Number(value) || 6 })}
        />
        <p className="mt-2 text-xs text-[#828B9B]">
          This block loads real {DIRECTORY_LABELS[sectionType]} from the database at
          render time — there is no manual content to enter here.
        </p>
      </fieldset>
    );
  }
  if (sectionType === "LEAD_GENERATION") {
    return (
      <p className="text-xs text-[#828B9B]">
        Renders the existing enquiry form. The heading and body above become the
        form&apos;s intro copy.
      </p>
    );
  }
  return null;
}

function SectionCard({
  section,
  index,
  total,
  mediaOptions,
  dragHandleProps,
  dragging,
  cardRef,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  section: Section;
  index: number;
  total: number;
  mediaOptions: EditorialMedia[];
  dragHandleProps?: { onPointerDown: (event: React.PointerEvent) => void };
  dragging?: boolean;
  cardRef?: (element: HTMLDivElement | null) => void;
  onChange: (patch: Partial<Section>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const scheduledFields =
    section.status === "SCHEDULED" || section.status === "ACTIVE";
  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border bg-white p-5 transition-shadow ${
        dragging ? "border-[#1657CF] shadow-lg" : "border-[#E8ECF3]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {dragHandleProps ? (
            <button
              type="button"
              aria-label="Drag to reorder section"
              onPointerDown={dragHandleProps.onPointerDown}
              style={{ touchAction: "none" }}
              className="cursor-grab select-none rounded-lg border border-[#E8ECF3] px-2 py-1 text-sm font-semibold text-[#828B9B] active:cursor-grabbing"
            >
              ⠿
            </button>
          ) : null}
          <span className="rounded-full bg-[#EEF3FF] px-3 py-1 text-xs font-bold text-[#1657CF]">
            {section.sectionType}
          </span>
          <span className="text-xs text-[#828B9B]">{section.sectionKey}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Move section up"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="rounded-lg border border-[#E8ECF3] px-2 py-1 text-xs font-semibold disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move section down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="rounded-lg border border-[#E8ECF3] px-2 py-1 text-xs font-semibold disabled:opacity-40"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-lg border border-[#E8ECF3] px-3 py-1 text-xs font-semibold"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Select
          label="Block type"
          value={section.sectionType}
          options={SECTION_TYPES}
          onChange={(value) => onChange({ sectionType: value })}
        />
        <Select
          label="Status"
          value={section.status}
          options={SECTION_STATUSES}
          onChange={(value) => onChange({ status: value })}
        />
        <Field
          label="Eyebrow (optional)"
          value={section.eyebrow ?? ""}
          onChange={(value) => onChange({ eyebrow: value })}
        />
        <Field
          label="Heading"
          value={section.heading ?? ""}
          onChange={(value) => onChange({ heading: value })}
        />
        <div className="sm:col-span-2">
          <Field
            label="Body"
            value={section.subheading ?? ""}
            onChange={(value) => onChange({ subheading: value })}
            textarea
          />
        </div>
        <Field
          label="CTA label (optional)"
          value={section.ctaPrimaryLabel ?? ""}
          onChange={(value) => onChange({ ctaPrimaryLabel: value })}
        />
        <InternalLinkPicker
          label="CTA URL (optional)"
          value={section.ctaPrimaryUrl ?? ""}
          onChange={(value) => onChange({ ctaPrimaryUrl: value })}
        />
        {scheduledFields ? (
          <>
            <Field
              label="Starts showing at (optional)"
              type="datetime-local"
              value={toDateTimeLocal(section.startsAt)}
              onChange={(value) =>
                onChange({ startsAt: fromDateTimeLocal(value) })
              }
            />
            <Field
              label="Stops showing at (optional)"
              type="datetime-local"
              value={toDateTimeLocal(section.endsAt)}
              onChange={(value) =>
                onChange({ endsAt: fromDateTimeLocal(value) })
              }
            />
          </>
        ) : null}
      </div>

      <fieldset className="mt-4 rounded-xl border border-[#E8ECF3] p-4">
        <legend className="px-1 text-sm font-semibold">Device visibility</legend>
        <p className="mb-3 text-xs text-[#667085]">
          Hidden sections are removed at that screen size and leave no empty
          space. A section must stay visible on at least one device.
        </p>
        <div className="flex flex-wrap gap-4">
          {DEVICES.map((device) => {
            const visibility = section.configurationJson?.visibility ?? {};
            const checked = visibility[device.key] !== false;
            return (
              <label key={device.key} className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const next: SectionVisibility = {
                      desktop: visibility.desktop !== false,
                      tablet: visibility.tablet !== false,
                      mobile: visibility.mobile !== false,
                      [device.key]: event.target.checked,
                    };
                    onChange({
                      configurationJson: {
                        ...(section.configurationJson ?? {}),
                        visibility: next,
                      },
                    });
                  }}
                />
                {device.label}
              </label>
            );
          })}
        </div>
        {(() => {
          const visibility = section.configurationJson?.visibility ?? {};
          const hiddenEverywhere =
            visibility.desktop === false &&
            visibility.tablet === false &&
            visibility.mobile === false;
          return hiddenEverywhere ? (
            <p role="alert" className="mt-3 rounded-lg bg-[#FEF3F2] px-3 py-2 text-sm font-semibold text-[#B42318]">
              This section is hidden on every device and will never appear. Re-enable one, or archive the section instead.
            </p>
          ) : null;
        })()}
      </fieldset>

      <div className="mt-4">
        <SectionBodyFields
          sectionType={section.sectionType}
          mediaId={section.mediaId}
          media={
            section.media
              ? [
                  {
                    id: section.media.id,
                    url: section.media.publicUrl ?? section.media.url ?? "",
                    title: section.media.title ?? null,
                    alt: section.media.altText ?? null,
                    width: null,
                    height: null,
                  },
                ]
              : undefined
          }
          mediaOptions={mediaOptions}
          body={section.bodyJson ?? {}}
          onMediaChange={(mediaId) => onChange({ mediaId })}
          onBodyChange={(bodyJson) => onChange({ bodyJson })}
        />
      </div>
    </div>
  );
}

export function PageCmsEditor({
  recordId,
  onSaved,
  onCancel,
}: {
  recordId?: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [page, setPage] = useState<PageRecord>({
    id: "",
    pageType: "EDITORIAL",
    title: "",
    slug: "",
    shortDescription: "",
    layoutKey: "default",
    status: "DRAFT",
    sections: [],
    seo: {},
  });
  const [sections, setSections] = useState<Section[]>([]);
  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());
  const [newSections, setNewSections] = useState<Section[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(recordId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<PageRecord | null>(null);
  const [mediaOptions, setMediaOptions] = useState<EditorialMedia[]>([]);
  const [templateOptions, setTemplateOptions] = useState<PageTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    listEditorialMedia({ limit: 24 })
      .then((result) => setMediaOptions(result.data))
      .catch(() => undefined);
    authFetch("/api/v1/admin/page-templates")
      .then((response) => response.json())
      .then((body: { data?: PageTemplateOption[] }) => setTemplateOptions(body.data ?? []))
      .catch(() => undefined);
  }, []);

  // Each drag gesture gets its own pair of listeners, created and torn down
  // together, so there is no cross-render stale-closure risk from reusing a
  // memoized handler whose identity could change between add and remove.
  function onDragHandlePointerDown(id: string, event: React.PointerEvent) {
    event.preventDefault();
    dragCleanupRef.current?.();
    dragIdRef.current = id;
    setDraggingId(id);

    function handleMove(moveEvent: PointerEvent) {
      const dragId = dragIdRef.current;
      if (!dragId) return;
      let overId: string | null = null;
      for (const [cardId, element] of cardRefs.current.entries()) {
        const rect = element.getBoundingClientRect();
        if (moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
          overId = cardId;
          break;
        }
      }
      if (!overId || overId === dragId) return;
      setSections((current) => {
        const fromIndex = current.findIndex((section) => section.id === dragId);
        const toIndex = current.findIndex((section) => section.id === overId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
        const next = current.slice();
        const [item] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        return next;
      });
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      dragCleanupRef.current = null;
      if (dragIdRef.current) {
        setDirtySections((current) => new Set(current).add("__order__"));
      }
      dragIdRef.current = null;
      setDraggingId(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    dragCleanupRef.current = handleUp;
  }

  useEffect(() => {
    return () => dragCleanupRef.current?.();
  }, []);

  const load = useCallback(async () => {
    if (!recordId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const record = await api<PageRecord>(`pages/${recordId}`);
      setPage(record);
      setSelectedTemplateId(record.templateId ?? record.template?.id ?? "");
      setSections((record.sections ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load page");
    } finally {
      setLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    // Runs once per recordId to hydrate the editor from the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function setPageField<K extends keyof PageRecord>(key: K, value: PageRecord[K]) {
    setPage((current) => ({ ...current, [key]: value }));
  }

  async function savePage() {
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        pageType: page.pageType,
        title: page.title,
        slug: page.slug,
        shortDescription: page.shortDescription || null,
        layoutKey: page.layoutKey || null,
        status: page.status,
        startsAt: page.status === "SCHEDULED" ? fromDateTimeLocal(toDateTimeLocal(page.startsAt)) : null,
        endsAt: fromDateTimeLocal(toDateTimeLocal(page.endsAt)),
        seo: {
          seoTitle: page.seo?.seoTitle ?? "",
          metaDescription: page.seo?.metaDescription ?? "",
          canonicalUrl: page.seo?.canonicalUrl ?? "",
          focusKeyword: page.seo?.focusKeyword ?? "",
        },
      };
      if (recordId) {
        await api(`pages/${recordId}`, { method: "PATCH", body: JSON.stringify(payload) });
        setMessage("Page saved.");
      } else {
        const created = await api<PageRecord>("pages", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Page created as a Draft. Add sections, then save again to publish.");
        await onSaved();
        return created;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save page");
    } finally {
      setBusy(false);
    }
    return null;
  }

  function addSection() {
    setNewSections((current) => [
      ...current,
      {
        id: `new-${current.length}-${Date.now()}`,
        sectionKey: "",
        sectionType: "CUSTOM",
        heading: "",
        subheading: "",
        status: "DRAFT",
        displayOrder: sections.length + current.length,
      },
    ]);
  }

  function updateExisting(id: string, patch: Partial<Section>) {
    setSections((current) =>
      current.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    );
    setDirtySections((current) => new Set(current).add(id));
  }
  function updateNew(id: string, patch: Partial<Section>) {
    setNewSections((current) =>
      current.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    );
  }

  function move(id: string, direction: -1 | 1) {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirtySections((current) => new Set(current).add("__order__"));
  }

  function removeExisting(id: string) {
    setSections((current) => current.filter((section) => section.id !== id));
    setRemovedIds((current) => [...current, id]);
  }
  function removeNew(id: string) {
    setNewSections((current) => current.filter((section) => section.id !== id));
  }

  async function duplicateExisting(id: string) {
    if (!recordId) return;
    setBusy(true);
    try {
      await api(`pages/${recordId}/sections/${id}/duplicate`, { method: "POST" });
      await load();
      setMessage("Section duplicated as a Draft copy.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to duplicate section");
    } finally {
      setBusy(false);
    }
  }

  async function saveSections() {
    if (!recordId) {
      setMessage("Save the page once before adding sections.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      for (const id of removedIds) {
        await api(`pages/${recordId}/sections/${id}`, { method: "DELETE" });
      }
      for (const section of newSections) {
        if (!section.heading?.trim()) continue;
        await api(`pages/${recordId}/sections`, {
          method: "POST",
          body: JSON.stringify({
            sectionType: section.sectionType,
            heading: section.heading,
            eyebrow: section.eyebrow || null,
            subheading: section.subheading || null,
            ctaPrimaryLabel: section.ctaPrimaryLabel || null,
            ctaPrimaryUrl: section.ctaPrimaryUrl || null,
            mediaId: section.mediaId || null,
            bodyJson: section.bodyJson ?? null,
            status: section.status,
            visibility: section.configurationJson?.visibility ?? undefined,
          }),
        });
      }
      for (const section of sections) {
        if (!dirtySections.has(section.id) && !dirtySections.has("__order__")) continue;
        await api(`pages/${recordId}/sections/${section.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            sectionType: section.sectionType,
            heading: section.heading || null,
            eyebrow: section.eyebrow || null,
            subheading: section.subheading || null,
            ctaPrimaryLabel: section.ctaPrimaryLabel || null,
            ctaPrimaryUrl: section.ctaPrimaryUrl || null,
            mediaId: section.mediaId || null,
            bodyJson: section.bodyJson ?? null,
            status: section.status,
            startsAt: section.startsAt ?? null,
            endsAt: section.endsAt ?? null,
            visibility: section.configurationJson?.visibility ?? undefined,
          }),
        });
      }
      if (dirtySections.has("__order__")) {
        await api(`pages/${recordId}/sections/reorder`, {
          method: "POST",
          body: JSON.stringify({ order: sections.map((section) => section.id) }),
        });
      }
      setMessage("Sections saved.");
      setNewSections([]);
      setRemovedIds([]);
      setDirtySections(new Set());
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save sections");
    } finally {
      setBusy(false);
    }
  }

  async function assignTemplate() {
    if (!recordId) return;
    setTemplateBusy(true);
    setMessage("");
    try {
      await authFetch(`/api/v1/admin/page-templates/assign/${recordId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplateId || null }),
      });
      setMessage("Template assignment saved. Existing sections were not changed.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to assign template");
    } finally {
      setTemplateBusy(false);
    }
  }

  async function applyTemplateDefaults() {
    if (!recordId) return;
    if (!window.confirm("Add this template's default sections to the page? Existing sections are kept as-is.")) return;
    setTemplateBusy(true);
    setMessage("");
    try {
      const response = await authFetch(`/api/v1/admin/page-templates/apply-defaults/${recordId}`, { method: "POST" });
      const body = (await response.json()) as { data?: { created: number }; error?: { message?: string } | null };
      if (!response.ok || body.error) throw new Error(body.error?.message ?? "Unable to apply template defaults");
      setMessage(`Added ${body.data?.created ?? 0} section(s) from the template.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to apply template defaults");
    } finally {
      setTemplateBusy(false);
    }
  }

  async function openPreview() {
    if (!recordId) return;
    try {
      const record = await api<PageRecord>(`pages/${recordId}/preview`);
      setPreview(record);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load preview");
    }
  }

  if (loading) return <p className="mt-6 text-sm text-[#667085]">Loading page…</p>;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
        <h3 className="text-lg font-semibold">Page</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Title" value={page.title} onChange={(value) => setPageField("title", value)} />
          <Field label="Slug" value={page.slug} onChange={(value) => setPageField("slug", value)} />
          <div className="sm:col-span-2">
            <Field
              label="Short description"
              value={page.shortDescription ?? ""}
              onChange={(value) => setPageField("shortDescription", value)}
              textarea
            />
          </div>
          <Select
            label="Layout"
            value={page.layoutKey ?? "default"}
            options={LAYOUT_KEYS}
            onChange={(value) => setPageField("layoutKey", value)}
          />
          <Select
            label="Status"
            value={page.status}
            options={PAGE_STATUSES}
            onChange={(value) => setPageField("status", value)}
          />
          {page.status === "SCHEDULED" ? (
            <Field
              label="Publish at"
              type="datetime-local"
              value={toDateTimeLocal(page.startsAt)}
              onChange={(value) => setPageField("startsAt", fromDateTimeLocal(value))}
            />
          ) : null}
          <Field
            label="Unpublish at (optional)"
            type="datetime-local"
            value={toDateTimeLocal(page.endsAt)}
            onChange={(value) => setPageField("endsAt", fromDateTimeLocal(value))}
          />
        </div>
        <fieldset className="mt-4 rounded-xl border border-[#E8ECF3] p-4">
          <legend className="px-1 text-sm font-semibold">SEO</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="SEO title"
              value={page.seo?.seoTitle ?? ""}
              onChange={(value) => setPageField("seo", { ...page.seo, seoTitle: value })}
            />
            <Field
              label="Meta description"
              value={page.seo?.metaDescription ?? ""}
              onChange={(value) => setPageField("seo", { ...page.seo, metaDescription: value })}
            />
            <Field
              label="Canonical URL (optional)"
              value={page.seo?.canonicalUrl ?? ""}
              onChange={(value) => setPageField("seo", { ...page.seo, canonicalUrl: value })}
            />
            <Field
              label="Focus keyword (optional)"
              value={page.seo?.focusKeyword ?? ""}
              onChange={(value) => setPageField("seo", { ...page.seo, focusKeyword: value })}
            />
          </div>
        </fieldset>
        {recordId ? (
          <fieldset className="mt-4 rounded-xl border border-[#E8ECF3] p-4">
            <legend className="px-1 text-sm font-semibold">Page template</legend>
            <p className="text-xs text-[#828B9B]">
              Assigning a template only remembers which one this page uses — it never changes existing sections.
              Applying its default sections is a separate action below, and skips any section this page already has.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold">
                Template
                <select
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">No template</option>
                  {templateOptions.map((template) => (
                    <option key={template.id} value={template.id} disabled={!template.isActive}>
                      {template.name} ({template.pageFamily.replaceAll("_", " ")}){!template.isActive ? " — archived" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={templateBusy}
                onClick={() => void assignTemplate()}
                className="rounded-xl border border-[#D9E0EA] px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                Save assignment
              </button>
              <button
                type="button"
                disabled={templateBusy || !page.template}
                onClick={() => void applyTemplateDefaults()}
                className="rounded-xl border border-[#D9E0EA] px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                title={page.template ? undefined : "Assign a template first"}
              >
                Apply template&apos;s default sections
              </button>
            </div>
          </fieldset>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void savePage()}
            className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {recordId ? "Save page" : "Create page"}
          </button>
          {recordId ? (
            <button
              type="button"
              onClick={() => void openPreview()}
              className="rounded-xl border border-[#E8ECF3] px-4 py-2 text-sm font-semibold"
            >
              Preview
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#E8ECF3] px-4 py-2 text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>

      {recordId ? (
        <div className="rounded-2xl border border-[#E8ECF3] bg-[#F7F9FC] p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Sections</h3>
            <button
              type="button"
              onClick={addSection}
              className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white"
            >
              Add section
            </button>
          </div>
          <p className="mt-2 text-xs text-[#828B9B]">
            Drag the ⠿ handle to reorder, or use the ↑ / ↓ buttons.
          </p>
          <div className="mt-4 space-y-4">
            {sections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                index={index}
                total={sections.length}
                mediaOptions={mediaOptions}
                dragging={draggingId === section.id}
                dragHandleProps={{
                  onPointerDown: (event) =>
                    onDragHandlePointerDown(section.id, event),
                }}
                cardRef={(element) => {
                  if (element) cardRefs.current.set(section.id, element);
                  else cardRefs.current.delete(section.id);
                }}
                onChange={(patch) => updateExisting(section.id, patch)}
                onMove={(direction) => move(section.id, direction)}
                onDuplicate={() => void duplicateExisting(section.id)}
                onDelete={() => removeExisting(section.id)}
              />
            ))}
            {newSections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                index={index}
                total={newSections.length}
                mediaOptions={mediaOptions}
                onChange={(patch) => updateNew(section.id, patch)}
                onMove={() => {}}
                onDuplicate={() => {}}
                onDelete={() => removeNew(section.id)}
              />
            ))}
            {sections.length === 0 && newSections.length === 0 ? (
              <p className="text-sm text-[#667085]">No sections yet. Add one above.</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveSections()}
            className="mt-4 rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Save sections
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}

      {preview ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="page-preview-title"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 id="page-preview-title" className="text-lg font-semibold">
                Preview — {preview.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-[#E8ECF3] px-3 py-1 text-xs font-semibold"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-[#667085]">
              This shows every non-deleted section regardless of publish state, exactly
              as an editor working ahead of publication would need to see it.
            </p>
            <div className="mt-4 space-y-4">
              {(preview.sections ?? []).map((section) => (
                <div key={section.id} className="rounded-xl border border-[#E8ECF3] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#828B9B]">
                    <span className="rounded-full bg-[#EEF3FF] px-2 py-0.5 text-[#1657CF]">
                      {section.sectionType}
                    </span>
                    <span>{section.status}</span>
                  </div>
                  {section.eyebrow ? (
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#1657CF]">
                      {section.eyebrow}
                    </p>
                  ) : null}
                  <h4 className="mt-1 text-base font-semibold">{section.heading}</h4>
                  {section.subheading ? (
                    <p className="mt-1 text-sm text-[#48505F]">{section.subheading}</p>
                  ) : null}
                  {section.ctaPrimaryLabel ? (
                    <p className="mt-2 text-sm font-semibold text-[#1657CF]">
                      {section.ctaPrimaryLabel} → {section.ctaPrimaryUrl}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
