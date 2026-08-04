"use client";

/* The dynamic repeaters and relation option sets intentionally share one editor shape. */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";
import { mergeBackendError, scrollToAndFocusField } from "@/lib/field-errors";

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
    error: { code?: string; message?: string } | null;
  };
  if (!response.ok || body.error || body.data === null) {
    const err = new Error(body.error?.message ?? "Unable to save record") as Error & { code?: string };
    err.code = body.error?.code;
    throw err;
  }
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
    if (resource === "scholarships" && values.amount && !values.currencyCode) {
      next.currencyCode = "Select the currency this amount is stated in.";
    }
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
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) window.setTimeout(() => scrollToAndFocusField(firstInvalid), 50);
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
      const typed = error as { code?: string; message?: string };
      setMessage(
        error instanceof Error ? error.message : "Unable to save record",
      );
      const { next, firstField } = mergeBackendError(errors, typed);
      if (firstField) {
        setErrors(next);
        window.setTimeout(() => scrollToAndFocusField(firstField), 50);
      }
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
          onProviderCreated={(provider: Option) =>
            setOptions((current) => ({ ...current, providers: [...current.providers, provider] }))
          }
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
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  textarea?: boolean;
  type?: string;
  name?: string;
}) {
  const fieldId = useId();
  const errorId = useId();
  return (
    <div className="block text-sm font-semibold" data-field={name}>
      <label htmlFor={fieldId}>{label}</label>
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
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  error?: string;
  name?: string;
}) {
  const fieldId = useId();
  const errorId = useId();
  return (
    <div className="block text-sm font-semibold" data-field={name}>
      <label htmlFor={fieldId}>{label}</label>
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
}: {
  legend: string;
  options: Option[];
  selected: string[];
  toggle: (id: string) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
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
}: {
  label: string;
  values: string[];
  draft: string;
  setDraft: (value: string) => void;
  add: () => void;
  remove: (value: string) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
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
}: {
  values: Record<string, string>;
  set: (key: string, value: string) => void;
  errors: Record<string, string>;
  entity?: "name" | "title";
  summaryKey?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={entity === "name" ? "Name" : "Title"}
        value={values[entity] ?? ""}
        onChange={(value) => set(entity, value)}
        error={errors[entity]}
        name={entity}
      />
      <Field
        label="Slug"
        value={values.slug ?? ""}
        onChange={(value) => set("slug", value)}
        error={errors.slug}
        name="slug"
      />
      {summaryKey ? (
        <Field
          label="Short summary"
          value={values[summaryKey] ?? ""}
          onChange={(value) => set(summaryKey, value)}
        />
      ) : null}
      <Field
        label="Display order"
        type="number"
        value={values.displayOrder ?? "0"}
        onChange={(value) => set("displayOrder", value)}
      />
    </div>
  );
}
function FeaturedFields(p: any) {
  return (
    <fieldset className="rounded-xl border border-[#E8ECF3] p-4">
      <legend className="px-1 text-sm font-semibold">Featured placement</legend>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={p.values.isFeatured === "true"}
          onChange={(event) =>
            p.set("isFeatured", event.target.checked ? "true" : "false")
          }
        />
        Featured
      </label>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field
          label="Priority (lower shows first)"
          type="number"
          value={p.values.featuredPriority ?? "0"}
          onChange={(value) => p.set("featuredPriority", value)}
        />
        <Field
          label="Featured from (optional)"
          type="datetime-local"
          value={p.values.featuredFrom ?? ""}
          onChange={(value) => p.set("featuredFrom", value)}
        />
        <Field
          label="Featured until (optional)"
          type="datetime-local"
          value={p.values.featuredUntil ?? ""}
          onChange={(value) => p.set("featuredUntil", value)}
          error={p.errors.featuredUntil}
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
        />
        <Field
          label="Publish until (optional)"
          type="datetime-local"
          value={p.values.publishEndsAt ?? ""}
          onChange={(value) => p.set("publishEndsAt", value)}
          error={p.errors.publishEndsAt}
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
      <Core {...p} entity="name" summaryKey="shortDescription" />
      <Select
        label="Country"
        value={p.values.countryId ?? ""}
        onChange={(value) => p.set("countryId", value)}
        options={p.countries}
        error={p.errors.countryId}
        name="countryId"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Institution type"
          value={p.values.institutionType ?? ""}
          onChange={(value) => p.set("institutionType", value)}
        />
        <Field
          label="Source URL"
          value={p.values.sourceReference ?? ""}
          onChange={(value) => p.set("sourceReference", value)}
        />
        <Select
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          options={p.media ?? []}
        />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.overview ?? ""}
        onChange={(value) => p.set("overview", value)}
      />
      <FeaturedFields {...p} />
      <ScheduledPublishingFields {...p} />
      <Repeater
        title="Campuses"
        rows={p.rows.campuses}
        fields={["name", "city", "state", "address"]}
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
      <Core {...p} entity="name" summaryKey="shortDescription" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="University"
          value={p.values.universityId ?? ""}
          onChange={(value) => p.set("universityId", value)}
          options={p.universities}
          error={p.errors.universityId}
          name="universityId"
        />
        <Select
          label="Generic course"
          value={p.values.genericCourseId ?? ""}
          onChange={(value) => p.set("genericCourseId", value)}
          options={p.courses}
          error={p.errors.genericCourseId}
          name="genericCourseId"
        />
        <Select
          label="Campus (optional)"
          value={p.values.campusId ?? ""}
          onChange={(value) => p.set("campusId", value)}
          options={p.campuses}
        />
        <Select
          label="Course level"
          value={p.values.courseLevelId ?? ""}
          onChange={(value) => p.set("courseLevelId", value)}
          options={p.levels}
          error={p.errors.courseLevelId}
          name="courseLevelId"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Study mode
          <select
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
        </label>
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
        />
        <Field
          label="Source URL"
          value={p.values.sourceReference ?? ""}
          onChange={(value) => p.set("sourceReference", value)}
          name="sourceReference"
        />
        <Select
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          options={p.media ?? []}
        />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.overview ?? ""}
        onChange={(value) => p.set("overview", value)}
      />
      <FeaturedFields {...p} />
      <ScheduledPublishingFields {...p} />
      <Multi
        legend="Intakes"
        options={p.intakes}
        selected={p.selected.intakeIds ?? []}
        toggle={(id) => p.toggle("intakeIds", id)}
      />
      <OfferingSummary {...p} />
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
/** Live summary of the offering being built, so a non-technical user can see
 * what will be linked before saving -- updates as selections change. */
function OfferingSummary(p: any) {
  const find = (options: Option[], id: string) =>
    (options ?? []).find((option: Option) => option.id === id);
  const university = find(p.universities, p.values.universityId);
  const course = find(p.courses, p.values.genericCourseId);
  const level = find(p.levels, p.values.courseLevelId);
  const intakeLabels = (p.selected.intakeIds ?? [])
    .map((id: string) => find(p.intakes, id))
    .filter(Boolean)
    .map((option: Option) => label(option));
  return (
    <div className="rounded-xl border border-[#D9E0EA] bg-[#F7F9FC] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
        Offering summary
      </p>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 sm:justify-start">
          <dt className="text-[#667085]">University</dt>
          <dd className="font-semibold">{university ? label(university) : "Not selected"}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:justify-start">
          <dt className="text-[#667085]">Course</dt>
          <dd className="font-semibold">{course ? label(course) : "Not selected"}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:justify-start">
          <dt className="text-[#667085]">Level</dt>
          <dd className="font-semibold">{level ? label(level) : "Not selected"}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:justify-start">
          <dt className="text-[#667085]">Mode</dt>
          <dd className="font-semibold">{p.values.studyMode || "Not selected"}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:justify-start">
          <dt className="text-[#667085]">Intakes</dt>
          <dd className="font-semibold">{intakeLabels.length ? intakeLabels.join(", ") : "None selected"}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:justify-start">
          <dt className="text-[#667085]">Source verification</dt>
          <dd className="font-semibold">{p.values.sourceReference ? "Provided" : "Incomplete"}</dd>
        </div>
      </dl>
    </div>
  );
}
/** Provider select for the Scholarship form: searchable, shows the selected
 * provider's status, warns when it is not active, and can quick-create a new
 * provider without leaving the scholarship form or losing its other values. */
function ProviderPicker({
  providers,
  value,
  onChange,
  onCreated,
  error,
}: {
  providers: Option[];
  value: string;
  onChange: (value: string) => void;
  onCreated?: (provider: Option) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const fieldId = useId();
  const filtered = providers.filter((provider) =>
    (provider.name ?? "").toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selected = providers.find((provider) => provider.id === value) as
    | (Option & { status?: string })
    | undefined;

  async function createProvider(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim() || busy) return;
    setBusy(true);
    setCreateError("");
    try {
      const response = await authFetch("/api/v1/admin/scholarship-providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), websiteUrl: newWebsite || undefined }),
      });
      const body = (await response.json()) as { data: Option | null; error: { message?: string } | null };
      if (!response.ok || body.error || !body.data) throw new Error(body.error?.message ?? "Unable to create provider");
      onCreated?.(body.data);
      onChange(body.data.id);
      setNewName("");
      setNewWebsite("");
      setCreating(false);
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : "Unable to create provider");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-sm font-semibold" data-field="providerId">
      <label htmlFor={fieldId}>Provider</label>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search providers"
        aria-label="Search providers"
        className={`${inputClass} mb-2`}
      />
      <select id={fieldId} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">Select provider</option>
        {filtered.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {label(provider)}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs font-normal text-[#B42318]">{error}</span> : null}
      {selected && selected.status && selected.status !== "ACTIVE" ? (
        <p className="mt-1 text-xs font-normal text-[#9A5B00]">
          This provider is {selected.status.toLowerCase()}. Selecting it is fine, but confirm it should still be used.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-normal">
        <button type="button" onClick={() => setCreating((v) => !v)} className="font-semibold text-[#1657CF]">
          {creating ? "Cancel new provider" : "+ New provider"}
        </button>
        <a href="/catalog-masters?section=scholarship-providers" target="_blank" rel="noreferrer" className="font-semibold text-[#1657CF]">
          Manage providers
        </a>
      </div>
      {creating ? (
        <form onSubmit={(event) => void createProvider(event)} className="mt-3 space-y-2 rounded-lg border border-[#E8ECF3] p-3">
          <label className="block text-xs font-semibold">
            Provider name
            <input required autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} className={`${inputClass} mt-1 text-sm font-normal`} />
          </label>
          <label className="block text-xs font-semibold">
            Website URL (optional)
            <input value={newWebsite} onChange={(event) => setNewWebsite(event.target.value)} className={`${inputClass} mt-1 text-sm font-normal`} />
          </label>
          {createError ? <p className="text-xs font-normal text-[#B42318]">{createError}</p> : null}
          <button type="submit" disabled={busy} className="rounded-lg bg-[#1657CF] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            {busy ? "Creating…" : "Create provider"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
function ScholarshipFields(p: any) {
  return (
    <>
      <Core {...p} summaryKey="summary" />
      <div className="grid gap-4 sm:grid-cols-2">
        <ProviderPicker
          providers={p.providers}
          value={p.values.providerId ?? ""}
          onChange={(value: string) => p.set("providerId", value)}
          onCreated={p.onProviderCreated}
          error={p.errors.providerId}
        />
        <Field
          label="Benefit type"
          value={p.values.benefitType ?? ""}
          onChange={(value) => p.set("benefitType", value)}
        />
        <Field
          label="Amount"
          type="number"
          value={p.values.amount ?? ""}
          onChange={(value) => p.set("amount", value)}
          name="amount"
        />
        <Field
          label="Currency"
          value={p.values.currencyCode ?? ""}
          onChange={(value) => p.set("currencyCode", value)}
          error={p.errors.currencyCode}
          name="currencyCode"
        />
        <Field
          label="Deadline"
          type="date"
          value={p.values.deadline ?? ""}
          onChange={(value) => p.set("deadline", value)}
        />
        <Field
          label="Application URL"
          value={p.values.applicationUrl ?? ""}
          onChange={(value) => p.set("applicationUrl", value)}
          name="applicationUrl"
        />
        <Field
          label="Source URL"
          value={p.values.sourceReference ?? ""}
          onChange={(value) => p.set("sourceReference", value)}
          name="sourceReference"
        />
        <Select
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          options={p.media ?? []}
        />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.description ?? ""}
        onChange={(value) => p.set("description", value)}
      />
      <Field
        label="Eligibility"
        textarea
        value={p.values.eligibility ?? ""}
        onChange={(value) => p.set("eligibility", value)}
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
      <Core {...p} entity="name" summaryKey="shortDescription" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Email"
          value={p.values.email ?? ""}
          onChange={(value) => p.set("email", value)}
        />
        <Field
          label="Phone"
          value={p.values.phone ?? ""}
          onChange={(value) => p.set("phone", value)}
        />
        <Field
          label="Website URL"
          value={p.values.websiteUrl ?? ""}
          onChange={(value) => p.set("websiteUrl", value)}
        />
        <label className="text-sm font-semibold">
          Verification state
          <select
            value={p.values.verificationStatus ?? "UNVERIFIED"}
            onChange={(event) =>
              p.set("verificationStatus", event.target.value)
            }
            className={inputClass}
          >
            <option>UNVERIFIED</option>
            <option>VERIFIED</option>
          </select>
        </label>
        <Field
          label="Source URL"
          value={p.values.sourceReference ?? ""}
          onChange={(value) => p.set("sourceReference", value)}
        />
        <Select
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          options={p.media ?? []}
        />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.description ?? ""}
        onChange={(value) => p.set("description", value)}
      />
      <FeaturedFields {...p} />
      <ScheduledPublishingFields {...p} />
      <Multi
        legend="Locations"
        options={p.locations}
        selected={p.selected.locationIds ?? []}
        toggle={(id) => p.toggle("locationIds", id)}
      />
      <Multi
        legend="Destination countries"
        options={p.countries}
        selected={p.selected.countryIds ?? []}
        toggle={(id) => p.toggle("countryIds", id)}
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
      />
    </>
  );
}
function JobFields(p: any) {
  return (
    <>
      <Core {...p} summaryKey="summary" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Department"
          value={p.values.department ?? ""}
          onChange={(value) => p.set("department", value)}
        />
        <Field
          label="Employment type"
          value={p.values.employmentType ?? ""}
          onChange={(value) => p.set("employmentType", value)}
        />
        <Field
          label="Location (free text)"
          value={p.values.location ?? ""}
          onChange={(value) => p.set("location", value)}
        />
        <Select
          label="City (optional, structured)"
          value={p.values.cityId ?? ""}
          onChange={(value) => p.set("cityId", value)}
          options={p.cities}
        />
        <Select
          label="State (optional, structured)"
          value={p.values.stateId ?? ""}
          onChange={(value) => p.set("stateId", value)}
          options={p.states}
        />
        <Select
          label="Country (optional, structured)"
          value={p.values.countryId ?? ""}
          onChange={(value) => p.set("countryId", value)}
          options={p.countries}
        />
        <Field
          label="Remote state"
          value={p.values.remoteStatus ?? ""}
          onChange={(value) => p.set("remoteStatus", value)}
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
        />
        <Field
          label="Application email"
          value={p.values.applicationEmail ?? ""}
          onChange={(value) => p.set("applicationEmail", value)}
        />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.description ?? ""}
        onChange={(value) => p.set("description", value)}
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
      <Core {...p} summaryKey="summary" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Start date and time"
          type="datetime-local"
          value={p.values.startsAt ?? ""}
          onChange={(value) => p.set("startsAt", value)}
          error={p.errors.startsAt}
        />
        <Field
          label="End date and time"
          type="datetime-local"
          value={p.values.endsAt ?? ""}
          onChange={(value) => p.set("endsAt", value)}
          error={p.errors.endsAt}
        />
        <Field
          label="Timezone"
          value={p.values.timezone ?? "Asia/Kolkata"}
          onChange={(value) => p.set("timezone", value)}
        />
        <label className="text-sm font-semibold">
          Event type
          <select
            value={p.values.eventType ?? "OFFLINE"}
            onChange={(event) => p.set("eventType", event.target.value)}
            className={inputClass}
          >
            <option>OFFLINE</option>
            <option>ONLINE</option>
            <option>HYBRID</option>
          </select>
        </label>
        <Field
          label="Venue (free text)"
          value={p.values.venue ?? ""}
          onChange={(value) => p.set("venue", value)}
        />
        <Select
          label="City (optional, structured)"
          value={p.values.cityId ?? ""}
          onChange={(value) => p.set("cityId", value)}
          options={p.cities}
        />
        <Select
          label="State (optional, structured)"
          value={p.values.stateId ?? ""}
          onChange={(value) => p.set("stateId", value)}
          options={p.states}
        />
        <Select
          label="Country (optional, structured)"
          value={p.values.countryId ?? ""}
          onChange={(value) => p.set("countryId", value)}
          options={p.countries}
        />
        <Field
          label="Online URL"
          value={p.values.onlineUrl ?? ""}
          onChange={(value) => p.set("onlineUrl", value)}
        />
        <Field
          label="Registration URL"
          value={p.values.registrationUrl ?? ""}
          onChange={(value) => p.set("registrationUrl", value)}
        />
        <Select
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          options={p.media ?? []}
        />
      </div>
      <Field
        label="Description"
        textarea
        value={p.values.description ?? ""}
        onChange={(value) => p.set("description", value)}
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
      />
    </>
  );
}
function StoryFields(p: any) {
  return (
    <>
      <Core {...p} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Display attribution"
          value={p.values.attribution ?? ""}
          onChange={(value) => p.set("attribution", value)}
        />
        <Select
          label="Country (optional)"
          value={p.values.countryId ?? ""}
          onChange={(value) => p.set("countryId", value)}
          options={p.countries}
        />
        <Select
          label="University (optional)"
          value={p.values.universityId ?? ""}
          onChange={(value) => p.set("universityId", value)}
          options={p.universities}
        />
        <Select
          label="University course offering (optional)"
          value={p.values.offeringId ?? ""}
          onChange={(value) => p.set("offeringId", value)}
          options={p.offerings}
        />
        <Select
          label="Media (optional)"
          value={p.values.featuredMediaId ?? ""}
          onChange={(value) => p.set("featuredMediaId", value)}
          options={p.media}
        />
      </div>
      <Field
        label="Journey content"
        textarea
        value={p.values.journey ?? ""}
        onChange={(value) => p.set("journey", value)}
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
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Display attribution"
          value={p.values.attribution ?? ""}
          onChange={(value) => p.set("attribution", value)}
        />
        <Select
          label="University (optional)"
          value={p.values.universityId ?? ""}
          onChange={(value) => p.set("universityId", value)}
          options={p.universities}
        />
        <Select
          label="University course offering (optional)"
          value={p.values.offeringId ?? ""}
          onChange={(value) => p.set("offeringId", value)}
          options={p.offerings}
        />
        <Select
          label="Media (optional)"
          value={p.values.imageMediaId ?? ""}
          onChange={(value) => p.set("imageMediaId", value)}
          options={p.media}
        />
      </div>
      <Field
        label="Display order"
        type="number"
        value={p.values.displayOrder ?? "0"}
        onChange={(value) => p.set("displayOrder", value)}
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
}: {
  title: string;
  rows: Array<Record<string, string>>;
  fields: string[];
  add: () => void;
  update: (index: number, key: string, value: string) => void;
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
        />
        <Field
          label="Meta description"
          value={values.metaDescription ?? ""}
          onChange={(value) => set("metaDescription", value)}
        />
        <div>
          <Field
            label="Canonical URL"
            value={canonical}
            onChange={(value) => set("canonicalUrl", value)}
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
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Open Graph title"
          value={values.ogTitle ?? ""}
          onChange={(value) => set("ogTitle", value)}
        />
        <Field
          label="Open Graph description"
          value={values.ogDescription ?? ""}
          onChange={(value) => set("ogDescription", value)}
        />
        <Select
          label="Open Graph image (Media Library)"
          value={values.ogMediaId ?? ""}
          onChange={(value) => set("ogMediaId", value)}
          options={media}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Twitter title"
          value={values.twitterTitle ?? ""}
          onChange={(value) => set("twitterTitle", value)}
        />
        <Field
          label="Twitter description"
          value={values.twitterDescription ?? ""}
          onChange={(value) => set("twitterDescription", value)}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={values.robotsIndex !== "false"}
            onChange={(event) =>
              set("robotsIndex", event.target.checked ? "true" : "false")
            }
          />
          Allow search engines to index this page
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={values.robotsFollow !== "false"}
            onChange={(event) =>
              set("robotsFollow", event.target.checked ? "true" : "false")
            }
          />
          Allow search engines to follow its links
        </label>
      </div>
      <p className="mt-2 text-xs text-[#828B9B]">
        Unpublished drafts are never indexable regardless of this setting —
        it only takes effect once the record is Published.
      </p>
    </fieldset>
  );
}
