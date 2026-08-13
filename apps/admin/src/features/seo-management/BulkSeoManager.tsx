"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { authFetch } from "@/features/auth/auth-client";

type Template = {
  seoTitleTemplate: string | null;
  metaDescriptionTemplate: string | null;
  ogTitleTemplate: string | null;
  ogDescriptionTemplate: string | null;
  canonicalTemplate: string | null;
  robotsIndex: boolean | null;
  robotsFollow: boolean | null;
};
type TemplateFieldKey = Extract<keyof Template, string>;
type TemplateTextFieldKey = Extract<
  TemplateFieldKey,
  | "seoTitleTemplate"
  | "metaDescriptionTemplate"
  | "ogTitleTemplate"
  | "ogDescriptionTemplate"
  | "canonicalTemplate"
>;
type Variable = { key: string; label: string };
type Definition = {
  key: string;
  label: string;
  variables: Variable[];
  template: Template | null;
};
type Preview = {
  record: { id: string; label: string } | null;
  resolved: {
    seoTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    source: { title: string; description: string };
  } | null;
  message: string | null;
};
type PickerState = {
  field: TemplateTextFieldKey;
  start: number;
  end: number;
  query: string;
  activeIndex: number;
};
type InputElement = HTMLInputElement | HTMLTextAreaElement;

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const previewDelay = 350;
const blank: Template = {
  seoTitleTemplate: "",
  metaDescriptionTemplate: "",
  ogTitleTemplate: "",
  ogDescriptionTemplate: "",
  canonicalTemplate: "",
  robotsIndex: null,
  robotsFollow: null,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/seo-management${path}`, {
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

function normalise(template: Template | null): Template {
  return { ...blank, ...(template ?? {}) };
}

function templateEquals(first: Template, second: Template) {
  return (Object.keys(blank) as TemplateFieldKey[]).every(
    (field) => first[field] === second[field],
  );
}

function readableVariable(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (value) => value.toUpperCase());
}

function templateErrors(template: Template, definition: Definition | null) {
  const errors: Partial<Record<TemplateTextFieldKey, string>> = {};
  if (!definition) return errors;
  const allowed = new Set(definition.variables.map((variable) => variable.key));
  const fields: TemplateTextFieldKey[] = [
    "seoTitleTemplate",
    "metaDescriptionTemplate",
    "ogTitleTemplate",
    "ogDescriptionTemplate",
    "canonicalTemplate",
  ];
  for (const field of fields) {
    const value = template[field] ?? "";
    const match = Array.from(value.matchAll(/\{([^{}]*)\}/g)).find(
      ([, key]) => !allowed.has(key.trim()),
    );
    if (match) {
      errors[field] =
        `${readableVariable(match[1].trim())} is not available for ${definition.label}.`;
    } else if (value.replace(/\{[^{}]*\}/g, "").match(/[{}]/)) {
      errors[field] = "Finish or remove the incomplete variable placeholder.";
    }
  }
  return errors;
}

function recommendedTemplate(definition: Definition): Template {
  const primary =
    definition.variables.find((variable) =>
      /name|title/i.test(variable.label),
    ) ?? definition.variables[0];
  const token = primary ? `{${primary.key}}` : "Universta";
  return {
    ...blank,
    seoTitleTemplate: `${token} | Universta`,
    metaDescriptionTemplate: `Explore ${token} on Universta.`,
  };
}

function placeholderFor(
  definition: Definition | null,
  kind: "title" | "description",
) {
  const primary =
    definition?.variables.find((variable) =>
      /name|title/i.test(variable.label),
    ) ?? definition?.variables[0];
  if (!primary) return kind === "title" ? "SEO title" : "Meta description";
  const token = `{${primary.key}}`;
  return kind === "title"
    ? `${token} | Universta`
    : `Explore ${token} on Universta.`;
}

function TemplateTextField({
  field,
  label,
  value,
  placeholder,
  error,
  multiline = false,
  picker,
  onChange,
  onKeyDown,
  onOpenPicker,
  variables,
  onSelectVariable,
  registerInput,
  helper,
}: {
  field: TemplateTextFieldKey;
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  multiline?: boolean;
  picker: PickerState | null;
  onChange: (event: ChangeEvent<InputElement>) => void;
  onKeyDown: (event: KeyboardEvent<InputElement>) => void;
  onOpenPicker: (field: TemplateTextFieldKey) => void;
  variables: Variable[];
  onSelectVariable: (variable: Variable) => void;
  registerInput: (
    field: TemplateTextFieldKey,
    element: InputElement | null,
  ) => void;
  helper?: string;
}) {
  const id = `bulk-seo-${field}`;
  const menuId = `${id}-variables`;
  const isOpen = picker?.field === field;
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-[#344054]"
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          ref={(element) => registerInput(field, element)}
          className={`${inputClass} min-h-24`}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-autocomplete="list"
        />
      ) : (
        <input
          id={id}
          ref={(element) => registerInput(field, element)}
          className={inputClass}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-autocomplete="list"
        />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-xs leading-5 text-[#667085]">
          {helper ?? "Type { or % to insert a variable."}
        </p>
        <button
          type="button"
          onClick={() => onOpenPicker(field)}
          className="text-xs font-semibold text-[#1657CF] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF]"
        >
          + Insert variable
        </button>
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs font-medium text-[#B42318]"
        >
          {error}
        </p>
      ) : null}
      {isOpen ? (
        <div
          id={menuId}
          role="listbox"
          aria-label="Available template variables"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#C9D7F2] bg-white p-2 shadow-xl sm:right-auto sm:w-80"
        >
          {variables.length ? (
            variables.map((variable, index) => (
              <button
                key={variable.key}
                type="button"
                role="option"
                aria-selected={picker?.activeIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSelectVariable(variable)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF] ${picker?.activeIndex === index ? "bg-[#EAF1FF] text-[#0D3F9E]" : "text-[#344054] hover:bg-[#F7F9FC]"}`}
              >
                <span className="font-semibold">{variable.label}</span>
                <span className="ml-2 text-xs text-[#667085]">{`{${variable.key}}`}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-[#667085]">
              No matching variables.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function BulkSeoManager() {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [value, setValue] = useState<Template>(blank);
  const [savedValue, setSavedValue] = useState<Template>(blank);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [pendingEntityKey, setPendingEntityKey] = useState<string | null>(null);
  const [confirmRecommended, setConfirmRecommended] = useState(false);
  const inputRefs = useRef<Partial<Record<TemplateTextFieldKey, InputElement>>>(
    {},
  );

  const selected = useMemo(
    () =>
      definitions.find((definition) => definition.key === selectedKey) ?? null,
    [definitions, selectedKey],
  );
  const errors = useMemo(
    () => templateErrors(value, selected),
    [selected, value],
  );
  const visibleVariables = useMemo(() => {
    const query = picker?.query.trim().toLowerCase() ?? "";
    return (selected?.variables ?? []).filter(
      (variable) =>
        !query ||
        variable.key.toLowerCase().includes(query) ||
        variable.label.toLowerCase().includes(query),
    );
  }, [picker?.query, selected?.variables]);
  const isDirty = !templateEquals(value, savedValue);

  useEffect(() => {
    void api<Definition[]>("/templates")
      .then((rows) => {
        setDefinitions(rows);
        const initial = rows[0];
        if (initial) {
          const initialTemplate = normalise(initial.template);
          setSelectedKey(initial.key);
          setValue(initialTemplate);
          setSavedValue(initialTemplate);
        }
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load bulk SEO templates",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected || Object.keys(errors).length > 0) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      setPreviewLoading(true);
      void api<Preview>(`/templates/${selected.key}/preview`, {
        method: "POST",
        body: JSON.stringify(value),
      })
        .then((result) => {
          if (active) setPreview(result);
        })
        .catch((error: unknown) => {
          if (active)
            setMessage(
              error instanceof Error
                ? error.message
                : "Unable to render preview",
            );
        })
        .finally(() => {
          if (active) setPreviewLoading(false);
        });
    }, previewDelay);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [errors, selected, value]);

  function switchEntity(key: string) {
    const definition = definitions.find((item) => item.key === key);
    const next = normalise(definition?.template ?? null);
    setSelectedKey(key);
    setValue(next);
    setSavedValue(next);
    setPreview(null);
    setPicker(null);
    setMessage("");
    setPendingEntityKey(null);
    setConfirmRecommended(false);
  }

  function requestEntityChange(key: string) {
    if (key === selectedKey) return;
    if (isDirty) {
      setPendingEntityKey(key);
      setPicker(null);
      return;
    }
    switchEntity(key);
  }

  function set(field: keyof Template, next: string | boolean | null) {
    setValue((current) => ({ ...current, [field]: next }));
    setMessage("");
  }

  function openPicker(field: TemplateTextFieldKey) {
    const element = inputRefs.current[field];
    const start = element?.selectionStart ?? (value[field] ?? "").length;
    const end = element?.selectionEnd ?? start;
    setPicker({ field, start, end, query: "", activeIndex: 0 });
    requestAnimationFrame(() => element?.focus());
  }

  function changeTemplateField(
    field: TemplateTextFieldKey,
    event: ChangeEvent<InputElement>,
  ) {
    const next = event.target.value;
    const cursor = event.target.selectionStart ?? next.length;
    set(field, next);
    const prefix = next.slice(0, cursor);
    const match = prefix.match(/([{%])([^{}%\s]*)$/);
    if (match && match.index !== undefined) {
      setPicker({
        field,
        start: match.index,
        end: cursor,
        query: match[2],
        activeIndex: 0,
      });
    } else if (picker?.field === field) {
      setPicker(null);
    }
  }

  function insertVariable(variable: Variable) {
    if (!picker) return;
    const current = value[picker.field] ?? "";
    const token = `{${variable.key}}`;
    const next = `${current.slice(0, picker.start)}${token}${current.slice(picker.end)}`;
    set(picker.field, next);
    const position = picker.start + token.length;
    const field = picker.field;
    setPicker(null);
    requestAnimationFrame(() => {
      const element = inputRefs.current[field];
      element?.focus();
      element?.setSelectionRange(position, position);
    });
  }

  function handlePickerKeyDown(
    field: TemplateTextFieldKey,
    event: KeyboardEvent<InputElement>,
  ) {
    if (!picker || picker.field !== field) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setPicker(null);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleVariables.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setPicker((current) =>
        current
          ? {
              ...current,
              activeIndex:
                (current.activeIndex + delta + visibleVariables.length) %
                visibleVariables.length,
            }
          : null,
      );
      return;
    }
    if (event.key === "Enter") {
      const variable = visibleVariables[picker.activeIndex];
      if (!variable) return;
      event.preventDefault();
      insertVariable(variable);
    }
  }

  function useRecommendedTemplate() {
    if (!selected) return;
    if (value.seoTitleTemplate || value.metaDescriptionTemplate) {
      setConfirmRecommended(true);
      return;
    }
    setValue(recommendedTemplate(selected));
    setConfirmRecommended(false);
  }

  async function save() {
    if (!selected) return;
    if (Object.keys(errors).length > 0) {
      setMessage("Fix the highlighted template variables before saving.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const saved = await api<Template>(`/templates/${selected.key}`, {
        method: "PUT",
        body: JSON.stringify(value),
      });
      const normalised = normalise(saved);
      setValue(normalised);
      setSavedValue(normalised);
      setDefinitions((current) =>
        current.map((row) =>
          row.key === selected.key ? { ...row, template: saved } : row,
        ),
      );
      setMessage("Saved. Existing manual SEO overrides remain unchanged.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save template",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <p className="mt-6 text-sm text-[#667085]">Loading bulk SEO templates…</p>
    );

  return (
    <div className="mt-6 rounded-2xl border border-[#E8ECF3] bg-white p-5 sm:p-6">
      <div className="max-w-3xl">
        <label
          htmlFor="bulk-seo-entity"
          className="block text-sm font-semibold text-[#344054]"
        >
          Configure SEO for
        </label>
        <select
          id="bulk-seo-entity"
          value={selectedKey}
          onChange={(event) => requestEntityChange(event.target.value)}
          className={`${inputClass} max-w-md`}
        >
          {definitions.map((definition) => (
            <option key={definition.key} value={definition.key}>
              {definition.label}
            </option>
          ))}
        </select>
        <details className="mt-3 text-xs text-[#475467]">
          <summary className="w-fit cursor-pointer font-semibold text-[#1657CF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF]">
            View available variables
          </summary>
          <p className="mt-2 leading-5">
            {selected?.variables
              .map((variable) => `{${variable.key}} — ${variable.label}`)
              .join(" · ")}
          </p>
        </details>
      </div>

      {pendingEntityKey ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-[#F7C948] bg-[#FFFAEB] p-4 text-sm text-[#7A5B00]"
        >
          <p className="font-semibold">
            You have unsaved changes for {selected?.label}.
          </p>
          <p className="mt-1">
            Save them first, or discard them before changing entity type.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPendingEntityKey(null)}
              className="rounded-lg border border-[#C58B00] px-3 py-2 font-semibold"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => switchEntity(pendingEntityKey)}
              className="rounded-lg bg-[#7A5B00] px-3 py-2 font-semibold text-white"
            >
              Discard changes and switch
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        <TemplateTextField
          field="seoTitleTemplate"
          label="SEO title template"
          value={value.seoTitleTemplate ?? ""}
          placeholder={placeholderFor(selected, "title")}
          error={errors.seoTitleTemplate}
          picker={picker}
          onChange={(event) => changeTemplateField("seoTitleTemplate", event)}
          onKeyDown={(event) => handlePickerKeyDown("seoTitleTemplate", event)}
          onOpenPicker={openPicker}
          variables={
            picker?.field === "seoTitleTemplate" ? visibleVariables : []
          }
          onSelectVariable={insertVariable}
          registerInput={(field, element) => {
            inputRefs.current[field] = element ?? undefined;
          }}
        />
        <TemplateTextField
          field="metaDescriptionTemplate"
          label="Meta description template"
          value={value.metaDescriptionTemplate ?? ""}
          placeholder={placeholderFor(selected, "description")}
          error={errors.metaDescriptionTemplate}
          multiline
          picker={picker}
          onChange={(event) =>
            changeTemplateField("metaDescriptionTemplate", event)
          }
          onKeyDown={(event) =>
            handlePickerKeyDown("metaDescriptionTemplate", event)
          }
          onOpenPicker={openPicker}
          variables={
            picker?.field === "metaDescriptionTemplate" ? visibleVariables : []
          }
          onSelectVariable={insertVariable}
          registerInput={(field, element) => {
            inputRefs.current[field] = element ?? undefined;
          }}
        />
      </div>

      <section
        className="mt-6 rounded-xl border border-[#DCE8FF] bg-[#F7FAFF] p-4"
        aria-label="Bulk SEO preview"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#0D1524]">Preview</h3>
          {previewLoading ? (
            <span className="text-xs font-medium text-[#667085]">
              Updating preview…
            </span>
          ) : null}
        </div>
        {preview?.resolved ? (
          <>
            <p className="mt-2 text-xs font-semibold text-[#475467]">
              Previewing: {preview.record?.label}
            </p>
            <p className="mt-3 text-lg font-semibold text-[#1657CF]">
              {preview.resolved.seoTitle}
            </p>
            <p className="mt-1 break-all text-sm text-[#18794E]">
              {preview.resolved.canonicalUrl}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#475467]">
              {preview.resolved.metaDescription}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[#667085]">
            {preview?.message ??
              "A published record will appear here when available."}
          </p>
        )}
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={useRecommendedTemplate}
          className="text-sm font-semibold text-[#1657CF] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF]"
        >
          Use recommended template
        </button>
        {confirmRecommended ? (
          <span className="flex flex-wrap items-center gap-2 text-sm text-[#475467]">
            Replace the current title and description?
            <button
              type="button"
              onClick={() => {
                if (selected) setValue(recommendedTemplate(selected));
                setConfirmRecommended(false);
              }}
              className="font-semibold text-[#1657CF] underline-offset-2 hover:underline"
            >
              Apply recommended template
            </button>
            <button
              type="button"
              onClick={() => setConfirmRecommended(false)}
              className="font-semibold underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </span>
        ) : null}
      </div>

      <details className="mt-6 rounded-xl border border-[#E8ECF3] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#344054] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF]">
          Advanced SEO settings
        </summary>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          Leave optional values blank to inherit the resolved title,
          description, canonical URL, and Default SEO settings.
        </p>
        <div className="mt-5 grid gap-5">
          <TemplateTextField
            field="ogTitleTemplate"
            label="Open Graph title template"
            value={value.ogTitleTemplate ?? ""}
            placeholder="Leave blank to use the resolved SEO title"
            error={errors.ogTitleTemplate}
            picker={picker}
            onChange={(event) => changeTemplateField("ogTitleTemplate", event)}
            onKeyDown={(event) => handlePickerKeyDown("ogTitleTemplate", event)}
            onOpenPicker={openPicker}
            variables={
              picker?.field === "ogTitleTemplate" ? visibleVariables : []
            }
            onSelectVariable={insertVariable}
            registerInput={(field, element) => {
              inputRefs.current[field] = element ?? undefined;
            }}
            helper="Leave blank to use the resolved SEO title. Type { or % to insert a variable."
          />
          <TemplateTextField
            field="ogDescriptionTemplate"
            label="Open Graph description template"
            value={value.ogDescriptionTemplate ?? ""}
            placeholder="Leave blank to use the resolved meta description"
            error={errors.ogDescriptionTemplate}
            multiline
            picker={picker}
            onChange={(event) =>
              changeTemplateField("ogDescriptionTemplate", event)
            }
            onKeyDown={(event) =>
              handlePickerKeyDown("ogDescriptionTemplate", event)
            }
            onOpenPicker={openPicker}
            variables={
              picker?.field === "ogDescriptionTemplate" ? visibleVariables : []
            }
            onSelectVariable={insertVariable}
            registerInput={(field, element) => {
              inputRefs.current[field] = element ?? undefined;
            }}
            helper="Leave blank to use the resolved meta description. Type { or % to insert a variable."
          />
          <TemplateTextField
            field="canonicalTemplate"
            label="Canonical template"
            value={value.canonicalTemplate ?? ""}
            placeholder="Leave blank to use the application canonical URL"
            error={errors.canonicalTemplate}
            picker={picker}
            onChange={(event) =>
              changeTemplateField("canonicalTemplate", event)
            }
            onKeyDown={(event) =>
              handlePickerKeyDown("canonicalTemplate", event)
            }
            onOpenPicker={openPicker}
            variables={
              picker?.field === "canonicalTemplate" ? visibleVariables : []
            }
            onSelectVariable={insertVariable}
            registerInput={(field, element) => {
              inputRefs.current[field] = element ?? undefined;
            }}
            helper="Leave blank to use the application canonical URL. Type { or % to insert a variable."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#344054]">
              Indexing behaviour
              <select
                className={inputClass}
                value={
                  value.robotsIndex === null
                    ? "inherit"
                    : String(value.robotsIndex)
                }
                onChange={(event) =>
                  set(
                    "robotsIndex",
                    event.target.value === "inherit"
                      ? null
                      : event.target.value === "true",
                  )
                }
              >
                <option value="inherit">Inherit Default SEO</option>
                <option value="true">Allow indexing</option>
                <option value="false">Noindex</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#344054]">
              Link following behaviour
              <select
                className={inputClass}
                value={
                  value.robotsFollow === null
                    ? "inherit"
                    : String(value.robotsFollow)
                }
                onChange={(event) =>
                  set(
                    "robotsFollow",
                    event.target.value === "inherit"
                      ? null
                      : event.target.value === "true",
                  )
                }
              >
                <option value="inherit">Inherit Default SEO</option>
                <option value="true">Allow following links</option>
                <option value="false">Nofollow</option>
              </select>
            </label>
          </div>
        </div>
      </details>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Bulk SEO"}
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
