"use client";

/* The dynamic repeaters and relation option sets intentionally share one editor shape. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { MediaPickerDialog } from "@/features/catalog/editorial/MediaPickerDialog";
import { FieldLabel } from "@/features/shared/FieldLabel";
import { FieldHelpIcon } from "@/features/shared/FieldHelpIcon";
import { commonFieldHelp } from "@/lib/field-help/common";
import { getFieldHelp } from "@/lib/field-help/registry";
import type { FieldHelpContent } from "@/lib/field-help/types";

type Option = {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
  code?: string;
  city?: string;
  universityId?: string;
  countryId?: string;
  altText?: string;
  originalFileName?: string;
};
type Options = {
  countries: Option[];
  universities: Option[];
  offerings: Option[];
  courses: Option[];
  levels: Option[];
  modes: Option[];
  intakes: Option[];
  locations: Option[];
  providers: Option[];
  media: Option[];
  campuses: Option[];
  states: Option[];
  cities: Option[];
};
type Row = Record<string, unknown> & { id?: string };
type Props = {
  resource: string;
  recordId?: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
};

const structured = new Set([
  "universities",
  "offerings",
  "scholarships",
  "consultants",
  "jobs",
  "events",
  "success-stories",
  "testimonials",
]);
const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const emptyOptions: Options = {
  countries: [],
  universities: [],
  offerings: [],
  courses: [],
  levels: [],
  modes: [],
  intakes: [],
  locations: [],
  providers: [],
  media: [],
  campuses: [],
  states: [],
  cities: [],
};

function label(option: Option) {
  return (
    option.name ??
    option.title ??
    option.altText ??
    option.originalFileName ??
    option.slug ??
    option.id
  );
}
function string(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}
function ids(value: unknown, key: string) {
  return Array.isArray(value)
    ? value
        .map((item) =>
          item && typeof item === "object"
            ? string((item as Record<string, unknown>)[key])
            : "",
        )
        .filter(Boolean)
    : [];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/phase1/${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as {
    data: T | null;
    error: { message?: string } | null;
  };
  if (!response.ok || body.error || body.data === null)
    throw new Error(body.error?.message ?? "Unable to save record");
  return body.data;
}

export function isStructuredPhase1Resource(resource: string) {
  return structured.has(resource);
}

export function Phase1StructuredEditor({
  resource,
  recordId,
  onSaved,
  onCancel,
}: Props) {
  const [options, setOptions] = useState<Options>(emptyOptions);
  const [values, setValues] = useState<Record<string, string>>({
    status: "DRAFT",
    displayOrder: "0",
    timezone: "Asia/Kolkata",
    eventType: "OFFLINE",
    verificationStatus: "UNVERIFIED",
  });
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [rows, setRows] = useState<
    Record<string, Array<Record<string, string>>>
  >({ campuses: [], accreditations: [], requirements: [] });
  const [tags, setTags] = useState<Record<string, string[]>>({
    services: [],
    languages: [],
    speakers: [],
  });
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  // New records also depend on asynchronous relationship options; do not let a
  // save race ahead of those options or an existing-record hydration.
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function hydrate(record: Row) {
    const next: Record<string, string> = {};
    for (const key of [
      "name",
      "slug",
      "countryId",
      "institutionType",
      "shortDescription",
      "overview",
      "featuredMediaId",
      "sourceReference",
      "status",
      "universityId",
      "genericCourseId",
      "campusId",
      "courseLevelId",
      "studyMode",
      "durationMin",
      "durationMax",
      "durationUnit",
      "tuitionMin",
      "tuitionMax",
      "currencyCode",
      "tuitionPeriod",
      "applicationUrl",
      "providerId",
      "title",
      "quote",
      "summary",
      "description",
      "benefitType",
      "amount",
      "currencyCode",
      "eligibility",
      "deadline",
      "email",
      "phone",
      "websiteUrl",
      "verificationStatus",
      "department",
      "employmentType",
      "location",
      "remoteStatus",
      "responsibilities",
      "qualifications",
      "applicationEmail",
      "publishedDate",
      "expiryDate",
      "startsAt",
      "endsAt",
      "timezone",
      "eventType",
      "venue",
      "onlineUrl",
      "registrationUrl",
      "journey",
      "attribution",
      "attributionNote",
      "imageMediaId",
      "displayOrder",
      "featuredPriority",
      "featuredFrom",
      "featuredUntil",
      "publishStartsAt",
      "publishEndsAt",
      "cityId",
      "stateId",
    ])
      next[key] = string(record[key]);
    next.isFeatured = record.isFeatured ? "true" : "false";
    if (record.seo && typeof record.seo === "object") {
      const seo = record.seo as Row;
      for (const key of [
        "seoTitle",
        "metaDescription",
        "canonicalUrl",
        "focusKeyword",
        "ogTitle",
        "ogDescription",
        "ogMediaId",
        "twitterTitle",
        "twitterDescription",
        "twitterMediaId",
      ])
        next[key] = string(seo[key]);
      next.robotsIndex = seo.robotsIndex === false ? "false" : "true";
      next.robotsFollow = seo.robotsFollow === false ? "false" : "true";
    } else {
      next.robotsIndex = "true";
      next.robotsFollow = "true";
    }
    next.deadline = next.deadline ? next.deadline.slice(0, 10) : "";
    next.publishedDate = next.publishedDate
      ? next.publishedDate.slice(0, 10)
      : "";
    next.expiryDate = next.expiryDate ? next.expiryDate.slice(0, 10) : "";
    next.startsAt = next.startsAt ? next.startsAt.slice(0, 16) : "";
    next.featuredFrom = next.featuredFrom ? next.featuredFrom.slice(0, 16) : "";
    next.featuredUntil = next.featuredUntil
      ? next.featuredUntil.slice(0, 16)
      : "";
    next.endsAt = next.endsAt ? next.endsAt.slice(0, 16) : "";
    next.publishStartsAt = next.publishStartsAt
      ? next.publishStartsAt.slice(0, 16)
      : "";
    next.publishEndsAt = next.publishEndsAt
      ? next.publishEndsAt.slice(0, 16)
      : "";
    if (Array.isArray(record.intakes))
      for (const item of record.intakes) {
        const intake = item as Row;
        const intakeId = string(intake.intakeId);
        if (intakeId)
          next[`deadline-${intakeId}`] = string(intake.deadline).slice(0, 10);
      }
    setValues((current) => ({ ...current, ...next }));
    setSelected({
      countryIds: ids(record.countries, "countryId"),
      universityIds: ids(record.universities, "universityId"),
      offeringIds: ids(record.offerings, "offeringId"),
      locationIds: ids(record.locations, "locationId"),
      intakeIds: ids(record.intakes, "intakeId"),
    });
    setRows({
      campuses: Array.isArray(record.campuses)
        ? record.campuses.map((item) => ({
            name: string((item as Row).name),
            city: string((item as Row).city),
            state: string((item as Row).state),
            address: string((item as Row).address),
          }))
        : [],
      accreditations: Array.isArray(record.accreditations)
        ? record.accreditations.map((item) => ({
            name: string((item as Row).name),
            accreditor: string((item as Row).accreditor),
            referenceUrl: string((item as Row).referenceUrl),
          }))
        : [],
      requirements: Array.isArray(record.requirements)
        ? record.requirements.map((item) => ({
            category: string((item as Row).category) || "ACADEMIC",
            title: string((item as Row).title),
            description: string((item as Row).description),
            minimumScore: string((item as Row).minimumScore),
          }))
        : [],
    });
    setTags({
      services: Array.isArray(record.services)
        ? record.services
            .map((item) => string((item as Row).name))
            .filter(Boolean)
        : [],
      languages: Array.isArray(record.languages)
        ? record.languages
            .map((item) => string((item as Row).name))
            .filter(Boolean)
        : [],
      speakers: Array.isArray(record.speakersJson)
        ? record.speakersJson.map(string).filter(Boolean)
        : [],
    });
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      api<Options>("form-options"),
      recordId ? api<Row>(`${resource}/${recordId}`) : Promise.resolve(null),
    ])
      .then(([nextOptions, record]) => {
        if (!active) return;
        setOptions(nextOptions);
        if (record) hydrate(record);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(
          error instanceof Error ? error.message : "Unable to load editor",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [recordId, resource]);

  const campuses = useMemo(
    () =>
      options.campuses.filter(
        (item) =>
          !values.universityId || item.universityId === values.universityId,
      ),
    [options.campuses, values.universityId],
  );
  function set(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }
  function toggle(key: string, id: string) {
    setSelected((current) => ({
      ...current,
      [key]: current[key]?.includes(id)
        ? current[key].filter((item) => item !== id)
        : [...(current[key] ?? []), id],
    }));
  }
  function addRow(key: string, row: Record<string, string>) {
    setRows((current) => ({
      ...current,
      [key]: [...(current[key] ?? []), row],
    }));
  }
  function updateRow(key: string, index: number, field: string, value: string) {
    setRows((current) => ({
      ...current,
      [key]: current[key].map((row, itemIndex) =>
        itemIndex === index ? { ...row, [field]: value } : row,
      ),
    }));
  }
  function addTag(key: string) {
    const value = tagDraft[key]?.trim();
    if (!value) return;
    setTags((current) => ({
      ...current,
      [key]: [...new Set([...(current[key] ?? []), value])],
    }));
    setTagDraft((current) => ({ ...current, [key]: "" }));
  }

  function validate() {
    const next: Record<string, string> = {};
    const required =
      resource === "testimonials"
        ? ["quote"]
        : resource === "events"
          ? ["title", "slug", "startsAt"]
          : resource === "offerings"
            ? ["universityId", "genericCourseId", "name", "slug"]
            : [
                resource === "universities" || resource === "consultants"
                  ? "name"
                  : "title",
                ...(resource === "consultants" ? ["slug"] : ["slug"]),
              ];
    for (const field of required)
      if (!values[field]?.trim()) next[field] = "This field is required.";
    if (resource === "universities" && !values.countryId)
      next.countryId = "Select a country.";
    if (resource === "offerings" && !values.courseLevelId)
      next.courseLevelId = "Select a course level.";
    if (resource === "events" && values.startsAt && values.endsAt) {
      if (new Date(values.endsAt) <= new Date(values.startsAt))
        next.endsAt = "End date and time must be after the start.";
    }
    // ISS-037. featuredFrom/featuredUntil and publishStartsAt/publishEndsAt
    // are shared across several resources (only rendered where relevant, so
    // this stays a no-op elsewhere) and had no ordering check at all -- an
    // inverted window saves silently and the record can then never be
    // effectively featured, or never publicly visible, at any point in time.
    if (values.featuredFrom && values.featuredUntil) {
      if (new Date(values.featuredUntil) <= new Date(values.featuredFrom))
        next.featuredUntil = "Featured until must be after featured from.";
    }
    if (values.publishStartsAt && values.publishEndsAt) {
      if (new Date(values.publishEndsAt) <= new Date(values.publishStartsAt))
        next.publishEndsAt = "Publish until must be after publish from.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate() || busy || loading) return;
    setBusy(true);
    setMessage("");
    const payload: Record<string, unknown> = {
      ...values,
      displayOrder: Number(values.displayOrder || 0),
      ...([
        "universities",
        "offerings",
        "scholarships",
        "consultants",
        "jobs",
        "events",
      ].includes(resource)
        ? {
            isFeatured: values.isFeatured === "true",
            featuredPriority: Number(values.featuredPriority || 0),
          }
        : {}),
      ...(resource === "events" ? { speakers: tags.speakers } : {}),
      ...(resource === "universities"
        ? { campuses: rows.campuses, accreditations: rows.accreditations }
        : {}),
      ...(resource === "offerings"
        ? {
            intakes: (selected.intakeIds ?? []).map((intakeId) => ({
              intakeId,
              deadline: values[`deadline-${intakeId}`] ?? "",
            })),
            requirements: rows.requirements,
          }
        : {}),
      ...(resource === "scholarships"
        ? {
            countryIds: selected.countryIds ?? [],
            universityIds: selected.universityIds ?? [],
            offeringIds: selected.offeringIds ?? [],
          }
        : {}),
      ...(resource === "consultants"
        ? {
            locationIds: selected.locationIds ?? [],
            countryIds: selected.countryIds ?? [],
            services: tags.services,
            languages: tags.languages,
          }
        : {}),
      seo: {
        seoTitle: values.seoTitle,
        metaDescription: values.metaDescription,
        canonicalUrl: values.canonicalUrl,
        focusKeyword: values.focusKeyword,
        ogTitle: values.ogTitle,
        ogDescription: values.ogDescription,
        ogMediaId: values.ogMediaId || null,
        twitterTitle: values.twitterTitle,
        twitterDescription: values.twitterDescription,
        twitterMediaId: values.twitterMediaId || null,
        robotsIndex: values.robotsIndex !== "false",
        robotsFollow: values.robotsFollow !== "false",
      },
    };
    for (const [key, value] of Object.entries(payload)) {
      if (value !== "") continue;
      // Empty optional controls clear persisted nullable values on edit.
      // Required values remain absent so the API can return their field error.
      if (["name", "title", "slug", "quote"].includes(key)) delete payload[key];
      else payload[key] = null;
    }
    try {
      await api<Row>(recordId ? `${resource}/${recordId}` : resource, {
        method: recordId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setMessage(recordId ? "Record updated." : "Draft created.");
      await onSaved();
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save record",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-7 space-y-6 rounded-2xl border border-[#E8ECF3] bg-white p-5 sm:p-7"
      aria-label={`${recordId ? "Edit" : "Create"} ${resource}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
            Structured editor
          </p>
          <h3 className="mt-1 text-2xl font-semibold">
            {recordId ? "Edit" : "Create"}{" "}
            {resource === "offerings"
              ? "university course offering"
              : resource.replaceAll("-", " ")}
          </h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
        >
          Close editor
        </button>
      </div>
      {message ? (
        <p
          role="status"
          className="rounded-xl bg-[#E9F8F0] px-4 py-3 text-sm text-[#18794E]"
        >
          {message}
        </p>
      ) : null}
      {loading ? <p role="status" className="text-sm text-[#667085]">Loading record…</p> : null}
      <fieldset disabled={loading} className="contents" aria-busy={loading}>
      {resource === "universities" ? (
        <UniversityFields
          values={values}
          set={set}
          errors={errors}
          countries={options.countries}
          media={options.media}
          rows={rows}
          addRow={addRow}
          updateRow={updateRow}
        />
      ) : null}
      {resource === "offerings" ? (
        <OfferingFields
          values={values}
          set={set}
          errors={errors}
          universities={options.universities}
          courses={options.courses}
          campuses={campuses}
          levels={options.levels}
          modes={options.modes}
          media={options.media}
          intakes={options.intakes}
          selected={selected}
          toggle={toggle}
          rows={rows}
          addRow={addRow}
          updateRow={updateRow}
        />
      ) : null}
      {resource === "scholarships" ? (
        <ScholarshipFields
          values={values}
          set={set}
          errors={errors}
          providers={options.providers}
          media={options.media}
          countries={options.countries}
          universities={options.universities}
          offerings={options.offerings}
          selected={selected}
          toggle={toggle}
        />
      ) : null}
      {resource === "consultants" ? (
        <ConsultantFields
          values={values}
          set={set}
          errors={errors}
          countries={options.countries}
          locations={options.locations}
          media={options.media}
          selected={selected}
          toggle={toggle}
          tags={tags}
          setTags={setTags}
          tagDraft={tagDraft}
          setTagDraft={setTagDraft}
          addTag={addTag}
        />
      ) : null}
      {resource === "jobs" ? (
        <JobFields
          values={values}
          set={set}
          errors={errors}
          cities={options.cities}
          states={options.states}
          countries={options.countries}
        />
      ) : null}
      {resource === "events" ? (
        <EventFields
          values={values}
          set={set}
          errors={errors}
          tags={tags}
          media={options.media}
          cities={options.cities}
          states={options.states}
          countries={options.countries}
          setTags={setTags}
          tagDraft={tagDraft}
          setTagDraft={setTagDraft}
          addTag={addTag}
        />
      ) : null}
      {resource === "success-stories" ? (
        <StoryFields
          values={values}
          set={set}
          errors={errors}
          countries={options.countries}
          universities={options.universities}
          offerings={options.offerings}
          media={options.media}
        />
      ) : null}
      {resource === "testimonials" ? (
        <TestimonialFields
          values={values}
          set={set}
          errors={errors}
          universities={options.universities}
          offerings={options.offerings}
          media={options.media}
        />
      ) : null}
      <SeoFields values={values} set={set} media={options.media} />
      <div className="flex flex-wrap gap-3 border-t border-[#E8ECF3] pt-5">
        <label className="text-sm font-semibold">
          Publish state
          <select
            value={values.status ?? "DRAFT"}
            onChange={(event) => set("status", event.target.value)}
            className={inputClass}
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </label>
        <button
          disabled={busy}
          type="submit"
          className="self-end rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : recordId ? "Save changes" : "Create draft"}
        </button>
      </div>
      </fieldset>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  textarea = false,
  type = "text",
  helpKey,
  help,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  textarea?: boolean;
  type?: string;
  helpKey?: string;
  help?: FieldHelpContent;
  required?: boolean;
}) {
  const fieldId = useId();
  const errorId = useId();
  return (
    <div className="block text-sm font-semibold">
      <FieldLabel label={label} htmlFor={fieldId} helpKey={helpKey} help={help} required={required} />
      {textarea ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} min-h-28`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      )}
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-[#B42318]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  error,
  helpKey,
  help,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  error?: string;
  helpKey?: string;
  help?: FieldHelpContent;
  required?: boolean;
}) {
  const fieldId = useId();
  const errorId = useId();
  return (
    <div className="block text-sm font-semibold">
      <FieldLabel label={label} htmlFor={fieldId} helpKey={helpKey} help={help} required={required} />
      <select
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {(options ?? []).map((option) => (
          <option key={option.id} value={option.id}>
            {labelOf(option)}
          </option>
        ))}
      </select>
      {error ? (
        <span id={errorId} className="mt-1 block text-xs text-[#B42318]">{error}</span>
      ) : null}
    </div>
  );
}
function labelOf(option: Option) {
  return `${label(option)}${option.city ? ` · ${option.city}` : ""}`;
}
function Multi({
  legend,
  options,
  selected,
  toggle,
  help,
  helpKey,
}: {
  legend: string;
  options: Option[];
  selected: string[];
  toggle: (id: string) => void;
  help?: FieldHelpContent;
  helpKey?: string;
}) {
  // The fieldset's own accessible name (what `getByRole('group', { name })`
  // matches) comes from its <legend> child's text content — but only when
  // that <legend> is a *direct* child of the <fieldset>. Both wrapping the
  // icon inside <legend> AND wrapping <legend> itself inside another
  // element (e.g. a flex row div) break that: the fieldset stops being
  // recognised as having a legend at all, and its computed group name goes
  // empty for every Multi/Tags instance, not just ones with an icon. The
  // icon must be a plain sibling of <legend>, both direct fieldset children.
  const resolved = help ?? (helpKey ? getFieldHelp(helpKey) : undefined);
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="flex items-center px-1 text-sm font-semibold">{legend}</legend>
      {resolved ? <FieldHelpIcon fieldLabel={legend} help={resolved} /> : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 rounded-lg border border-[#EDF0F4] px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={() => toggle(option.id)}
            />
            {labelOf(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Tags({
  label,
  values,
  draft,
  setDraft,
  add,
  remove,
  help,
}: {
  label: string;
  values: string[];
  draft: string;
  setDraft: (value: string) => void;
  add: () => void;
  remove: (value: string) => void;
  help?: FieldHelpContent;
}) {
  // Same group-name-pollution concern as Multi above: <legend> must stay a
  // *direct* fieldset child with the icon as its sibling (not wrapped
  // together in another element), or the fieldset's own accessible name
  // goes empty for every Tags instance, not just ones with an icon.
  const resolved = help ?? undefined;
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="flex items-center px-1 text-sm font-semibold">{label}</legend>
      {resolved ? <FieldHelpIcon fieldLabel={label} help={resolved} /> : null}
      <div className="flex gap-2">
        <input
          aria-label={`Add ${label}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className={inputClass}
        />
        <button
          type="button"
          onClick={add}
          className="mt-1 rounded-xl border px-3 text-sm font-semibold"
        >
          Add
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-full bg-[#EDF4FF] px-3 py-1 text-sm"
          >
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => remove(value)}
              className="ml-2 font-bold"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </fieldset>
  );
}
function Core({
  values,
  set,
  errors,
  entity = "title",
  summaryKey,
  resource,
}: {
  values: Record<string, string>;
  set: (key: string, value: string) => void;
  errors: Record<string, string>;
  entity?: "name" | "title";
  summaryKey?: string;
  resource?: string;
}) {
  const helpKey = (field: string) => (resource ? `${resource}.${field}` : undefined);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={entity === "name" ? "Name" : "Title"}
        value={values[entity] ?? ""}
        onChange={(value) => set(entity, value)}
        error={errors[entity]}
        helpKey={helpKey(entity)}
      />
      <Field
        label="Slug"
        value={values.slug ?? ""}
        onChange={(value) => set("slug", value)}
        error={errors.slug}
        helpKey={helpKey("slug")}
      />
      {summaryKey ? (
        <Field
          label="Short summary"
          value={values[summaryKey] ?? ""}
          onChange={(value) => set(summaryKey, value)}
          helpKey={helpKey(summaryKey)}
        />
      ) : null}
      <Field
        label="Display order"
        type="number"
        value={values.displayOrder ?? "0"}
        onChange={(value) => set("displayOrder", value)}
        help={commonFieldHelp.displayOrder}
      />
    </div>
  );
}
function FeaturedFields(p: any) {
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="px-1 text-sm font-semibold">Featured placement</legend>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <input
          id="phase1-is-featured"
          type="checkbox"
          checked={p.values.isFeatured === "true"}
          onChange={(event) =>
            p.set("isFeatured", event.target.checked ? "true" : "false")
          }
        />
        <FieldLabel label="Featured" htmlFor="phase1-is-featured" help={commonFieldHelp.featured} />
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field
          label="Priority (lower shows first)"
          type="number"
          value={p.values.featuredPriority ?? "0"}
          onChange={(value) => p.set("featuredPriority", value)}
          help={{
            purpose: 'Controls the order featured records appear in within a Featured section.',
            input: 'A whole number. Lower numbers appear first.',
            dataType: 'Number',
            required: 'Optional — leave at 0 if the order does not matter.',
            example: '0',
            dependency: 'Only takes effect together with the Featured checkbox.',
            frontendEffect: 'Sorts records within Featured sections on the public site.',
          }}
        />
        <Field
          label="Featured from (optional)"
          type="datetime-local"
          value={p.values.featuredFrom ?? ""}
          onChange={(value) => p.set("featuredFrom", value)}
          help={commonFieldHelp.featuredFrom}
        />
        <Field
          label="Featured until (optional)"
          type="datetime-local"
          value={p.values.featuredUntil ?? ""}
          onChange={(value) => p.set("featuredUntil", value)}
          error={p.errors.featuredUntil}
          help={commonFieldHelp.featuredUntil}
        />
      </div>
      <p className="mt-2 text-xs text-[#667085]">
        Outside this window (or unchecked), the record shows in normal order.
      </p>
    </fieldset>
  );
}
function ScheduledPublishingFields(p: any) {
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="px-1 text-sm font-semibold">Scheduled publishing</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Publish from (optional)"
          type="datetime-local"
          value={p.values.publishStartsAt ?? ""}
          onChange={(value) => p.set("publishStartsAt", value)}
          help={commonFieldHelp.publishStartsAt}
        />
        <Field
          label="Publish until (optional)"
          type="datetime-local"
          value={p.values.publishEndsAt ?? ""}
          onChange={(value) => p.set("publishEndsAt", value)}
          error={p.errors.publishEndsAt}
          help={commonFieldHelp.publishEndsAt}
        />
      </div>
      <p className="mt-2 text-xs text-[#667085]">
        Even while Published, this record is only publicly visible inside
        this window. Leave blank on either side for no limit.
      </p>
    </fieldset>
  );
}
function UniversityFields(p: any) {
  return (
    <>
      <Core {...p} entity="name" summaryKey="shortDescription" resource="universities" />
      <Select
        label="Country"
        value={p.values.countryId ?? ""}
        onChange={(value) => p.set("countryId", value)}
        options={p.countries}
        error={p.errors.countryId}
        helpKey="universities.countryId"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Institution type"
          value={p.values.institutionType ?? ""}
          onChange={(value) => p.set("institutionType", value)}
          helpKey="universities.institutionType"
        />
        <Field
          label="Source URL"
          value={p.values.sourceReference ?? ""}
          onChange={(value) => p.set("sourceReference", value)}
          helpKey="universities.sourceReference"
        />
        <MediaPickerDialog
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          helpKey="universities.featuredMediaId"
          />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.overview ?? ""}
        onChange={(value) => p.set("overview", value)}
        helpKey="universities.overview"
      />
      <FeaturedFields {...p} />
      <ScheduledPublishingFields {...p} />
      <Repeater
        title="Campuses"
        rows={p.rows.campuses}
        fields={["name", "city", "state", "address"]}
        helpPrefix="campuses"
        add={() =>
          p.addRow("campuses", { name: "", city: "", state: "", address: "" })
        }
        update={(i: number, key: string, value: string) =>
          p.updateRow("campuses", i, key, value)
        }
      />
      <Repeater
        title="Accreditations"
        rows={p.rows.accreditations}
        fields={["name", "accreditor", "referenceUrl"]}
        helpPrefix="accreditations"
        add={() =>
          p.addRow("accreditations", {
            name: "",
            accreditor: "",
            referenceUrl: "",
          })
        }
        update={(i: number, key: string, value: string) =>
          p.updateRow("accreditations", i, key, value)
        }
      />
    </>
  );
}
function OfferingFields(p: any) {
  return (
    <>
      <Core {...p} entity="name" summaryKey="shortDescription" resource="offerings" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="University"
          value={p.values.universityId ?? ""}
          onChange={(value) => p.set("universityId", value)}
          options={p.universities}
          error={p.errors.universityId}
          helpKey="offerings.universityId"
        />
        <Select
          label="Generic course"
          value={p.values.genericCourseId ?? ""}
          onChange={(value) => p.set("genericCourseId", value)}
          options={p.courses}
          error={p.errors.genericCourseId}
          helpKey="offerings.genericCourseId"
        />
        <Select
          label="Campus (optional)"
          value={p.values.campusId ?? ""}
          onChange={(value) => p.set("campusId", value)}
          options={p.campuses}
          helpKey="offerings.campusId"
        />
        <Select
          label="Course level"
          value={p.values.courseLevelId ?? ""}
          onChange={(value) => p.set("courseLevelId", value)}
          options={p.levels}
          error={p.errors.courseLevelId}
          helpKey="offerings.courseLevelId"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="text-sm font-semibold">
          <FieldLabel label="Study mode" htmlFor="offering-study-mode" helpKey="offerings.studyMode" />
          <select
            id="offering-study-mode"
            value={p.values.studyMode ?? ""}
            onChange={(event) => p.set("studyMode", event.target.value)}
            className={inputClass}
          >
            <option value="">Select mode</option>
            {p.modes.map((m: Option) => (
              <option key={m.id} value={m.code ?? m.name}>
                {label(m)}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Duration minimum"
          type="number"
          value={p.values.durationMin ?? ""}
          onChange={(value) => p.set("durationMin", value)}
        />
        <Field
          label="Duration maximum"
          type="number"
          value={p.values.durationMax ?? ""}
          onChange={(value) => p.set("durationMax", value)}
        />
        <Field
          label="Duration unit"
          value={p.values.durationUnit ?? "YEARS"}
          onChange={(value) => p.set("durationUnit", value)}
          helpKey="offerings.durationUnit"
        />
        <Field
          label="Tuition minimum"
          type="number"
          value={p.values.tuitionMin ?? ""}
          onChange={(value) => p.set("tuitionMin", value)}
        />
        <Field
          label="Tuition maximum"
          type="number"
          value={p.values.tuitionMax ?? ""}
          onChange={(value) => p.set("tuitionMax", value)}
        />
        <Field
          label="Currency"
          value={p.values.currencyCode ?? ""}
          onChange={(value) => p.set("currencyCode", value)}
          helpKey="offerings.currencyCode"
        />
        <Field
          label="Tuition period"
          value={p.values.tuitionPeriod ?? ""}
          onChange={(value) => p.set("tuitionPeriod", value)}
        />
        <Field
          label="Application URL"
          value={p.values.applicationUrl ?? ""}
          onChange={(value) => p.set("applicationUrl", value)}
          helpKey="offerings.applicationUrl"
        />
        <Field
          label="Source URL"
          value={p.values.sourceReference ?? ""}
          onChange={(value) => p.set("sourceReference", value)}
          helpKey="offerings.sourceReference"
        />
        <MediaPickerDialog
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          helpKey="offerings.featuredMediaId"
          />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.overview ?? ""}
        onChange={(value) => p.set("overview", value)}
        helpKey="offerings.overview"
      />
      <FeaturedFields {...p} />
      <ScheduledPublishingFields {...p} />
      <Multi
        legend="Intakes"
        options={p.intakes}
        selected={p.selected.intakeIds ?? []}
        toggle={(id) => p.toggle("intakeIds", id)}
      />
      {(p.selected.intakeIds ?? []).map((intakeId: string) => {
        const intake = p.intakes.find((item: Option) => item.id === intakeId);
        return (
          <Field
            key={intakeId}
            label={`Deadline for ${label(intake ?? { id: intakeId })}`}
            type="date"
            value={p.values[`deadline-${intakeId}`] ?? ""}
            onChange={(value) => p.set(`deadline-${intakeId}`, value)}
          />
        );
      })}
      <Repeater
        title="Academic and English-test requirements"
        rows={p.rows.requirements}
        fields={["category", "title", "description", "minimumScore"]}
        helpPrefix="requirements"
        add={() =>
          p.addRow("requirements", {
            category: "ACADEMIC",
            title: "",
            description: "",
            minimumScore: "",
          })
        }
        update={(i: number, key: string, value: string) =>
          p.updateRow("requirements", i, key, value)
        }
      />
    </>
  );
}
function ScholarshipFields(p: any) {
  return (
    <>
      <Core {...p} summaryKey="summary" resource="scholarships" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Provider"
          value={p.values.providerId ?? ""}
          onChange={(value) => p.set("providerId", value)}
          options={p.providers}
          helpKey="scholarships.providerId"
        />
        <Field
          label="Benefit type"
          value={p.values.benefitType ?? ""}
          onChange={(value) => p.set("benefitType", value)}
          helpKey="scholarships.benefitType"
        />
        <Field
          label="Amount"
          type="number"
          value={p.values.amount ?? ""}
          onChange={(value) => p.set("amount", value)}
          helpKey="scholarships.amount"
        />
        <Field
          label="Currency"
          value={p.values.currencyCode ?? ""}
          onChange={(value) => p.set("currencyCode", value)}
          helpKey="scholarships.currencyCode"
        />
        <Field
          label="Deadline"
          type="date"
          value={p.values.deadline ?? ""}
          onChange={(value) => p.set("deadline", value)}
          helpKey="scholarships.deadline"
        />
        <Field
          label="Application URL"
          value={p.values.applicationUrl ?? ""}
          onChange={(value) => p.set("applicationUrl", value)}
          helpKey="scholarships.applicationUrl"
        />
        <Field
          label="Source URL"
          value={p.values.sourceReference ?? ""}
          onChange={(value) => p.set("sourceReference", value)}
          helpKey="scholarships.sourceReference"
        />
        <MediaPickerDialog
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          helpKey="scholarships.featuredMediaId"
          />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.description ?? ""}
        onChange={(value) => p.set("description", value)}
        helpKey="scholarships.description"
      />
      <Field
        label="Eligibility"
        textarea
        value={p.values.eligibility ?? ""}
        onChange={(value) => p.set("eligibility", value)}
        helpKey="scholarships.eligibility"
      />
      <FeaturedFields {...p} />
      <ScheduledPublishingFields {...p} />
      <Multi
        legend="Eligible countries"
        options={p.countries}
        selected={p.selected.countryIds ?? []}
        toggle={(id) => p.toggle("countryIds", id)}
      />
      <Multi
        legend="Eligible universities"
        options={p.universities}
        selected={p.selected.universityIds ?? []}
        toggle={(id) => p.toggle("universityIds", id)}
      />
      <Multi
        legend="Eligible university course offerings"
        options={p.offerings}
        selected={p.selected.offeringIds ?? []}
        toggle={(id) => p.toggle("offeringIds", id)}
      />
    </>
  );
}
function ConsultantFields(p: any) {
  return (
    <>
      <Core {...p} entity="name" summaryKey="shortDescription" resource="consultants" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Email"
          value={p.values.email ?? ""}
          onChange={(value) => p.set("email", value)}
          helpKey="consultants.email"
        />
        <Field
          label="Phone"
          value={p.values.phone ?? ""}
          onChange={(value) => p.set("phone", value)}
          helpKey="consultants.phone"
        />
        <Field
          label="Website URL"
          value={p.values.websiteUrl ?? ""}
          onChange={(value) => p.set("websiteUrl", value)}
          helpKey="consultants.websiteUrl"
        />
        <div className="text-sm font-semibold">
          <FieldLabel label="Verification state" htmlFor="consultant-verification-status" helpKey="consultants.verificationStatus" />
          <select
            id="consultant-verification-status"
            value={p.values.verificationStatus ?? "UNVERIFIED"}
            onChange={(event) =>
              p.set("verificationStatus", event.target.value)
            }
            className={inputClass}
          >
            <option>UNVERIFIED</option>
            <option>VERIFIED</option>
          </select>
        </div>
        <Field
          label="Source URL"
          value={p.values.sourceReference ?? ""}
          onChange={(value) => p.set("sourceReference", value)}
          helpKey="consultants.sourceReference"
        />
        <MediaPickerDialog
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          helpKey="consultants.featuredMediaId"
          />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.description ?? ""}
        onChange={(value) => p.set("description", value)}
        helpKey="consultants.description"
      />
      <FeaturedFields {...p} />
      <ScheduledPublishingFields {...p} />
      <Multi
        legend="Locations"
        options={p.locations}
        selected={p.selected.locationIds ?? []}
        toggle={(id) => p.toggle("locationIds", id)}
        help={{
          purpose: 'The physical office locations this consultant operates from.',
          input: 'Tick every existing Consultant Location that applies.',
          dataType: 'Relationship (multi-select)',
          required: 'Optional.',
          frontendEffect: 'Shown as the consultant’s offices and used for location-based filtering.',
        }}
      />
      <Multi
        legend="Destination countries"
        options={p.countries}
        selected={p.selected.countryIds ?? []}
        toggle={(id) => p.toggle("countryIds", id)}
        help={{
          purpose: 'The study-destination countries this consultant specialises in.',
          input: 'Tick every relevant, published Country.',
          dataType: 'Relationship (multi-select)',
          required: 'Optional.',
          frontendEffect: 'Used for country-based filtering on the consultants directory.',
        }}
      />
      <Tags
        label="Services"
        values={p.tags.services ?? []}
        draft={p.tagDraft.services ?? ""}
        setDraft={(value) =>
          p.setTagDraft((x: any) => ({ ...x, services: value }))
        }
        add={() => p.addTag("services")}
        remove={(value) =>
          p.setTags((x: any) => ({
            ...x,
            services: x.services.filter((item: string) => item !== value),
          }))
        }
        help={{
          purpose: 'The services this consultant offers.',
          input: 'Type a service and press Add; repeat for each one.',
          dataType: 'List of short text tags',
          required: 'Optional.',
          example: 'Visa guidance',
          frontendEffect: 'Shown as tags on the consultant profile and used for service-based filtering.',
        }}
      />
      <Tags
        label="Languages"
        values={p.tags.languages ?? []}
        draft={p.tagDraft.languages ?? ""}
        setDraft={(value) =>
          p.setTagDraft((x: any) => ({ ...x, languages: value }))
        }
        add={() => p.addTag("languages")}
        remove={(value) =>
          p.setTags((x: any) => ({
            ...x,
            languages: x.languages.filter((item: string) => item !== value),
          }))
        }
        help={{
          purpose: 'The languages this consultant can support clients in.',
          input: 'Type a language and press Add; repeat for each one.',
          dataType: 'List of short text tags',
          required: 'Optional.',
          example: 'English',
          frontendEffect: 'Shown as tags on the consultant profile and used for language-based filtering.',
        }}
      />
    </>
  );
}
function JobFields(p: any) {
  return (
    <>
      <Core {...p} summaryKey="summary" resource="jobs" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Department"
          value={p.values.department ?? ""}
          onChange={(value) => p.set("department", value)}
          helpKey="jobs.department"
        />
        <Field
          label="Employment type"
          value={p.values.employmentType ?? ""}
          onChange={(value) => p.set("employmentType", value)}
          helpKey="jobs.employmentType"
        />
        <Field
          label="Location (free text)"
          value={p.values.location ?? ""}
          onChange={(value) => p.set("location", value)}
          helpKey="jobs.location"
        />
        <Select
          label="City (optional, structured)"
          value={p.values.cityId ?? ""}
          onChange={(value) => p.set("cityId", value)}
          options={p.cities}
          help={commonFieldHelp.city}
        />
        <Select
          label="State (optional, structured)"
          value={p.values.stateId ?? ""}
          onChange={(value) => p.set("stateId", value)}
          options={p.states}
          help={commonFieldHelp.state}
        />
        <Select
          label="Country (optional, structured)"
          value={p.values.countryId ?? ""}
          onChange={(value) => p.set("countryId", value)}
          options={p.countries}
          help={commonFieldHelp.country}
        />
        <Field
          label="Remote state"
          value={p.values.remoteStatus ?? ""}
          onChange={(value) => p.set("remoteStatus", value)}
          helpKey="jobs.remoteStatus"
        />
        <Field
          label="Published date"
          type="date"
          value={p.values.publishedDate ?? ""}
          onChange={(value) => p.set("publishedDate", value)}
        />
        <Field
          label="Expiry"
          type="date"
          value={p.values.expiryDate ?? ""}
          onChange={(value) => p.set("expiryDate", value)}
        />
        <Field
          label="Application URL"
          value={p.values.applicationUrl ?? ""}
          onChange={(value) => p.set("applicationUrl", value)}
          helpKey="jobs.applicationUrl"
        />
        <Field
          label="Application email"
          value={p.values.applicationEmail ?? ""}
          onChange={(value) => p.set("applicationEmail", value)}
          helpKey="jobs.applicationEmail"
        />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.description ?? ""}
        onChange={(value) => p.set("description", value)}
        helpKey="jobs.description"
      />
      <Field
        label="Responsibilities"
        textarea
        value={p.values.responsibilities ?? ""}
        onChange={(value) => p.set("responsibilities", value)}
      />
      <Field
        label="Qualifications"
        textarea
        value={p.values.qualifications ?? ""}
        onChange={(value) => p.set("qualifications", value)}
      />
      <FeaturedFields {...p} />
      <ScheduledPublishingFields {...p} />
    </>
  );
}
function EventFields(p: any) {
  return (
    <>
      <Core {...p} summaryKey="summary" resource="events" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Start date and time"
          type="datetime-local"
          value={p.values.startsAt ?? ""}
          onChange={(value) => p.set("startsAt", value)}
          error={p.errors.startsAt}
          helpKey="events.startsAt"
        />
        <Field
          label="End date and time"
          type="datetime-local"
          value={p.values.endsAt ?? ""}
          onChange={(value) => p.set("endsAt", value)}
          error={p.errors.endsAt}
          helpKey="events.endsAt"
        />
        <Field
          label="Timezone"
          value={p.values.timezone ?? "Asia/Kolkata"}
          onChange={(value) => p.set("timezone", value)}
          helpKey="events.timezone"
        />
        <div className="text-sm font-semibold">
          <FieldLabel label="Event type" htmlFor="event-type" helpKey="events.eventType" />
          <select
            id="event-type"
            value={p.values.eventType ?? "OFFLINE"}
            onChange={(event) => p.set("eventType", event.target.value)}
            className={inputClass}
          >
            <option>OFFLINE</option>
            <option>ONLINE</option>
            <option>HYBRID</option>
          </select>
        </div>
        <Field
          label="Venue (free text)"
          value={p.values.venue ?? ""}
          onChange={(value) => p.set("venue", value)}
          helpKey="events.venue"
        />
        <Select
          label="City (optional, structured)"
          value={p.values.cityId ?? ""}
          onChange={(value) => p.set("cityId", value)}
          options={p.cities}
          help={commonFieldHelp.city}
        />
        <Select
          label="State (optional, structured)"
          value={p.values.stateId ?? ""}
          onChange={(value) => p.set("stateId", value)}
          options={p.states}
          help={commonFieldHelp.state}
        />
        <Select
          label="Country (optional, structured)"
          value={p.values.countryId ?? ""}
          onChange={(value) => p.set("countryId", value)}
          options={p.countries}
          help={commonFieldHelp.country}
        />
        <Field
          label="Online URL"
          value={p.values.onlineUrl ?? ""}
          onChange={(value) => p.set("onlineUrl", value)}
          helpKey="events.onlineUrl"
        />
        <Field
          label="Registration URL"
          value={p.values.registrationUrl ?? ""}
          onChange={(value) => p.set("registrationUrl", value)}
          helpKey="events.registrationUrl"
        />
        <MediaPickerDialog
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          helpKey="events.featuredMediaId"
          />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.description ?? ""}
        onChange={(value) => p.set("description", value)}
        helpKey="events.description"
      />
      <FeaturedFields {...p} />
      <ScheduledPublishingFields {...p} />
      <Tags
        label="Speakers"
        values={p.tags.speakers ?? []}
        draft={p.tagDraft.speakers ?? ""}
        setDraft={(value) =>
          p.setTagDraft((x: any) => ({ ...x, speakers: value }))
        }
        add={() => p.addTag("speakers")}
        remove={(value) =>
          p.setTags((x: any) => ({
            ...x,
            speakers: x.speakers.filter((item: string) => item !== value),
          }))
        }
        help={{
          purpose: 'The named speakers or hosts for this event.',
          input: 'Type a speaker name and press Add; repeat for each one.',
          dataType: 'List of short text tags',
          required: 'Optional.',
          frontendEffect: 'Shown as the speaker list on the event page.',
        }}
      />
    </>
  );
}
function StoryFields(p: any) {
  return (
    <>
      <Core {...p} resource="success-stories" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Display attribution"
          value={p.values.attribution ?? ""}
          onChange={(value) => p.set("attribution", value)}
          helpKey="success-stories.attribution"
        />
        <Select
          label="Country (optional)"
          value={p.values.countryId ?? ""}
          onChange={(value) => p.set("countryId", value)}
          options={p.countries}
          helpKey="success-stories.countryId"
        />
        <Select
          label="University (optional)"
          value={p.values.universityId ?? ""}
          onChange={(value) => p.set("universityId", value)}
          options={p.universities}
          helpKey="success-stories.universityId"
        />
        <Select
          label="University course offering (optional)"
          value={p.values.offeringId ?? ""}
          onChange={(value) => p.set("offeringId", value)}
          options={p.offerings}
          help={commonFieldHelp.course}
        />
        <MediaPickerDialog
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          helpKey="success-stories.featuredMediaId"
          />
      </div>
      <Field
        label="Journey content"
        textarea
        value={p.values.journey ?? ""}
        onChange={(value) => p.set("journey", value)}
        helpKey="success-stories.journey"
      />
      <ScheduledPublishingFields {...p} />
    </>
  );
}
function TestimonialFields(p: any) {
  return (
    <>
      <Field
        label="Quote"
        textarea
        value={p.values.quote ?? ""}
        onChange={(value) => p.set("quote", value)}
        error={p.errors.quote}
        helpKey="testimonials.quote"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Display attribution"
          value={p.values.attribution ?? ""}
          onChange={(value) => p.set("attribution", value)}
          helpKey="testimonials.attribution"
        />
        <Select
          label="University (optional)"
          value={p.values.universityId ?? ""}
          onChange={(value) => p.set("universityId", value)}
          options={p.universities}
          helpKey="testimonials.universityId"
        />
        <Select
          label="University course offering (optional)"
          value={p.values.offeringId ?? ""}
          onChange={(value) => p.set("offeringId", value)}
          options={p.offerings}
          help={commonFieldHelp.course}
        />
        <MediaPickerDialog
          label="Media (optional)"
          value={p.values.imageMediaId ?? ""}
          onChange={(value) => p.set("imageMediaId", value)}
          helpKey="testimonials.imageMediaId"
          />
      </div>
      <Field
        label="Display order"
        type="number"
        value={p.values.displayOrder ?? "0"}
        onChange={(value) => p.set("displayOrder", value)}
        help={commonFieldHelp.displayOrder}
      />
      <ScheduledPublishingFields {...p} />
    </>
  );
}
function Repeater({
  title,
  rows,
  fields,
  add,
  update,
  helpPrefix,
}: {
  title: string;
  rows: Array<Record<string, string>>;
  fields: string[];
  add: () => void;
  update: (index: number, key: string, value: string) => void;
  helpPrefix?: string;
}) {
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {rows.map((row, index) => (
        <div
          key={index}
          className="mt-3 grid gap-3 rounded-xl bg-[#F8FAFC] p-3 sm:grid-cols-2"
        >
          {fields.map((field) => (
            <Field
              key={field}
              label={field.replace(/([A-Z])/g, " $1")}
              value={row[field] ?? ""}
              onChange={(value) => update(index, field, value)}
              helpKey={helpPrefix ? `${helpPrefix}.${field}` : undefined}
            />
          ))}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="mt-3 rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold"
      >
        Add {title.slice(0, -1)}
      </button>
    </fieldset>
  );
}
function SeoFields({
  values,
  set,
  media,
}: {
  values: Record<string, string>;
  set: (key: string, value: string) => void;
  media: Option[];
}) {
  const canonical = values.canonicalUrl ?? "";
  const canonicalUnsafe =
    canonical.trim() !== "" &&
    !canonical.startsWith("/") &&
    !/^https:\/\/[^/]*universta/i.test(canonical);
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="px-1 text-sm font-semibold">SEO</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="SEO title"
          value={values.seoTitle ?? ""}
          onChange={(value) => set("seoTitle", value)}
          help={commonFieldHelp.seoTitle}
        />
        <Field
          label="Meta description"
          value={values.metaDescription ?? ""}
          onChange={(value) => set("metaDescription", value)}
          help={commonFieldHelp.metaDescription}
        />
        <div>
          <Field
            label="Canonical URL"
            value={canonical}
            onChange={(value) => set("canonicalUrl", value)}
            help={commonFieldHelp.canonicalUrl}
          />
          {canonicalUnsafe ? (
            <p className="mt-1 text-xs font-semibold text-[#B42318]">
              This points off-site. Use a site-relative path (starting with
              &quot;/&quot;) unless an external canonical is intentional.
            </p>
          ) : null}
        </div>
        <Field
          label="Focus keyword"
          value={values.focusKeyword ?? ""}
          onChange={(value) => set("focusKeyword", value)}
          help={commonFieldHelp.focusKeyword}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Open Graph title"
          value={values.ogTitle ?? ""}
          onChange={(value) => set("ogTitle", value)}
          help={commonFieldHelp.ogTitle}
        />
        <Field
          label="Open Graph description"
          value={values.ogDescription ?? ""}
          onChange={(value) => set("ogDescription", value)}
          help={commonFieldHelp.ogDescription}
        />
        <MediaPickerDialog
          label="Open Graph image (Media Library)"
          value={values.ogMediaId ?? ""}
          onChange={(value) => set("ogMediaId", value)}
          help={commonFieldHelp.ogMedia}
          />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Twitter title"
          value={values.twitterTitle ?? ""}
          onChange={(value) => set("twitterTitle", value)}
          help={commonFieldHelp.twitterTitle}
        />
        <Field
          label="Twitter description"
          value={values.twitterDescription ?? ""}
          onChange={(value) => set("twitterDescription", value)}
          help={commonFieldHelp.twitterDescription}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <input
            id="seo-robots-index-phase1"
            type="checkbox"
            checked={values.robotsIndex !== "false"}
            onChange={(event) =>
              set("robotsIndex", event.target.checked ? "true" : "false")
            }
          />
          <FieldLabel label="Allow search engines to index this page" htmlFor="seo-robots-index-phase1" help={commonFieldHelp.robotsIndex} />
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <input
            id="seo-robots-follow-phase1"
            type="checkbox"
            checked={values.robotsFollow !== "false"}
            onChange={(event) =>
              set("robotsFollow", event.target.checked ? "true" : "false")
            }
          />
          <FieldLabel label="Allow search engines to follow its links" htmlFor="seo-robots-follow-phase1" help={commonFieldHelp.robotsFollow} />
        </div>
      </div>
      <p className="mt-2 text-xs text-[#828B9B]">
        Unpublished drafts are never indexable regardless of this setting —
        it only takes effect once the record is Published.
      </p>
    </fieldset>
  );
}
