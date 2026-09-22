"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createConsultantCard,
  createContinent,
  createCountry,
  createCountryEnglishTest,
  createCountryFaq,
  createCountryFeature,
  createEditorialSection,
  deleteConsultantCard,
  deleteCountryFaq,
  deleteCountrySeo,
  deleteEditorialSection,
  getCountry,
  getCountryCurationOptions,
  getCountryEditorial,
  createSubject,
  listAllSubjects,
  listContinents,
  listCountryEnglishTests,
  listCountryFeatures,
  listEditorialMedia,
  publishCountry,
  saveCountrySeo,
  unpublishCountry,
  updateConsultantCard,
  updateCountry,
  updateCountryFaq,
  updateEditorialSection,
} from "./catalog-client";
import type { CountryTaxonomyOption } from "./catalog-client";
import type {
  CatalogMutationError,
  ContinentRecord,
  CountryEditorialBundle,
  CountryCurationOptions,
  CountryRecord,
  EditorialMedia,
  EditorialSeo,
  SubjectRecord,
} from "./catalog.types";
import {
  CountryTaxonomyPicker,
  type CreateOutcome,
} from "./CountryTaxonomyPicker";
import { MediaPickerDialog } from "./editorial/MediaPickerDialog";
import { TypedBodyEditor } from "./editorial/TypedBodyEditor";
import {
  SECTION_TYPES,
  blankSection,
  bodyForApi,
  draftFromSection,
  type SectionDraft,
  type SectionType,
} from "./editorial/editor-types";
import { CatalogDialog } from "./CatalogDialog";
import { FieldLabel } from "@/features/shared/FieldLabel";
import { UnifiedEditorActions } from "@/features/shared/UnifiedEditorActions";
import { variablesForContext } from "@/features/shared/variable-autocomplete";
import type { EditorEntityContext } from "@/features/shared/useEntityAutocomplete";
import { nextAutoSlug, slugFromText } from "@/lib/slug";
import {
  blankUnifiedSeo,
  seoPayload,
  UnifiedSeoFields,
  type UnifiedSeoDraft,
} from "@/features/shared/UnifiedSeoFields";
import {
  FlashBanner,
  queueFlash,
  type Flash,
} from "@/features/shared/Flash";
import { RichTextEditor } from "@/features/shared/RichTextEditor";
import {
  CURRENCY_OPTIONS,
  currencyByCode,
  flagEmojiFromIso,
  matchCurrency,
  type CurrencyOption,
} from "./currency-options";
import {
  CountryProfilesEditor,
  type CountryProfilesHandle,
} from "./CountryProfilesEditor";
import {
  countryFieldRules,
  fieldErrorsFromServer,
  seoFieldRules,
} from "./country-field-rules";

type Intent = "draft" | "publish";
type Core = {
  externalUid: string;
  continentId: string;
  name: string;
  slug: string;
  pageHeading: string;
  shortDescription: string;
  overview: string;
  tagline: string;
  iso2Code: string;
  iso3Code: string;
  capitalCity: string;
  officialLanguage: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  flagMediaId: string;
  listingMediaId: string;
  heroMediaId: string;
  isFeatured: boolean;
  displayOrder: string;
};
type CountryConfiguration = {
  featureCodes: string[];
  acceptedTests: string[];
  intakeMonths: number[];
  postStudyWorkPermitMonths: string;
  /** The budget calculator document, edited as JSON. Empty means no calculator. */
  calculatorConfig: string;
  popularUniversityIds: string[];
  popularCourseIds: string[];
};
type SectionRow = SectionDraft & { id?: string; updatedAt?: string };
export type FaqRow = {
  id?: string;
  updatedAt?: string;
  question: string;
  answer: string;
  category: string;
  isFeatured: boolean;
  status: string;
  displayOrder: string;
};

/** The CTA contract the API enforces (`ConsultantCardDto.ctaUrl`): a site path
 * beginning with a single `/`, an in-page `#anchor`, or an absolute https URL.
 * Deliberately not an `<input type="url">` -- that rejects the relative paths
 * this field is mostly used for, which is exactly how the canonical field
 * became unusable. */
export function ctaUrlInputError(value: string): string | null {
  const cta = value.trim();
  if (!cta) return null;
  if (/\s/.test(cta) || !/^(?:\/(?!\/)|#[a-zA-Z0-9_-]+$|https:\/\/)/.test(cta))
    return 'Use a site path like /counselling, an #anchor, or an https:// URL.';
  return null;
}

/** Saving a Country used to re-send every FAQ it holds, edited or not, so one
 * FAQ the server would no longer accept blocked every unrelated edit to that
 * Country. A row is only worth sending when the operator actually changed it;
 * a row with no id is new and always is. */
export function faqRowChanged(row: FaqRow, pristine: FaqRow | undefined) {
  if (!row.id || !pristine) return true;
  return (
    row.question !== pristine.question ||
    row.answer !== pristine.answer ||
    row.category !== pristine.category ||
    row.isFeatured !== pristine.isFeatured ||
    row.status !== pristine.status ||
    row.displayOrder !== pristine.displayOrder
  );
}
type DocumentRow = { name: string; details: string; isRequired: boolean };

/* Offered, not applied. These are the papers most destinations ask for, so an
 * author starts from a click rather than a blank list -- but nothing is saved
 * until they add it, and a destination that asks for something else adds its
 * own. */
const SUGGESTED_DOCUMENTS = [
  "Passport",
  "Academic transcripts / marksheets",
  "Degree / qualification certificate",
  "English language test result",
  "Statement of Purpose (SOP)",
  "Letter of Recommendation (LOR)",
  "CV / Resume",
  "Proof of funds / bank statement",
  "Passport-size photographs",
  "Visa / immigration documents",
] as const;

type CardRow = {
  id?: string;
  updatedAt?: string;
  title: string;
  slug: string;
  shortDescription: string;
  overview: string;
  iconMediaId: string;
  featuredMediaId: string;
  isFreeConsultation: boolean;
  ctaLabel: string;
  ctaUrl: string;
  status: string;
  isFeatured: boolean;
  displayOrder: string;
};

const blankCore: Core = {
  externalUid: "",
  continentId: "",
  name: "",
  slug: "",
  pageHeading: "",
  shortDescription: "",
  overview: "",
  tagline: "",
  iso2Code: "",
  iso3Code: "",
  capitalCity: "",
  officialLanguage: "",
  currencyName: "",
  currencyCode: "",
  currencySymbol: "",
  flagMediaId: "",
  listingMediaId: "",
  heroMediaId: "",
  isFeatured: false,
  displayOrder: "0",
};
const blankConfiguration: CountryConfiguration = {
  featureCodes: [],
  acceptedTests: [],
  intakeMonths: [],
  postStudyWorkPermitMonths: "",
  calculatorConfig: "",
  popularUniversityIds: [],
  popularCourseIds: [],
};
const input =
  "mt-2 w-full rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
const optional = (value: string) => (value.trim() ? value.trim() : undefined);
/** An emptied optional field. `undefined` is dropped from the JSON body and the
 * API reads a missing key as "leave this alone", so clearing a value used to
 * report success and change nothing. `null` is the explicit clear the API
 * already understands, so send that instead and keep omission meaning
 * unchanged for other callers. */
const clearable = (value: string) => (value.trim() ? value.trim() : null);
const hasSeo = (value: UnifiedSeoDraft) =>
  Boolean(
    value.seoTitle.trim() ||
    value.metaDescription.trim() ||
    value.canonicalUrl.trim() ||
    value.focusKeyword.trim() ||
    value.ogTitle.trim() ||
    value.ogDescription.trim() ||
    value.ogMediaId ||
    value.twitterTitle.trim() ||
    value.twitterDescription.trim() ||
    value.twitterMediaId,
  );

/* Features and accepted English tests were two literal arrays here, duplicating
 * the API's own. Both are master data now: the lists below are fetched, and an
 * option added from this form is available to every other Country immediately.
 */
const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const blankFaq = (): FaqRow => ({
  question: "",
  answer: "",
  category: "",
  isFeatured: false,
  status: "ACTIVE",
  displayOrder: "0",
});
const blankCard = (): CardRow => ({
  title: "",
  slug: "",
  shortDescription: "",
  overview: "",
  iconMediaId: "",
  featuredMediaId: "",
  isFreeConsultation: true,
  ctaLabel: "View consultants",
  ctaUrl: "",
  status: "DRAFT",
  isFeatured: false,
  displayOrder: "0",
});
const seoFromRecord = (row: EditorialSeo | null): UnifiedSeoDraft =>
  row
    ? {
        seoTitle: row.seoTitle ?? "",
        metaDescription: row.metaDescription ?? "",
        canonicalUrl: row.canonicalUrl ?? "",
        focusKeyword: row.focusKeyword ?? "",
        ogTitle: row.ogTitle ?? "",
        ogDescription: row.ogDescription ?? "",
        ogMediaId: row.ogMediaId ?? "",
        twitterTitle: row.twitterTitle ?? "",
        twitterDescription: row.twitterDescription ?? "",
        twitterMediaId: row.twitterMediaId ?? "",
        robotsIndex: row.robotsIndex,
        robotsFollow: row.robotsFollow,
      }
    : blankUnifiedSeo;

export function CountryForm({ countryId }: { countryId?: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<CountryRecord | null>(null);
  const [continents, setContinents] = useState<ContinentRecord[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [core, setCore] = useState<Core>(blankCore);
  const [configuration, setConfiguration] =
    useState<CountryConfiguration>(blankConfiguration);
  const [curationOptions, setCurationOptions] =
    useState<CountryCurationOptions | null>(null);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  /* Profiles and intakes are separate child records with their own routes, so
   * the first save has to hand them the id the country was just given. */
  const profilesRef = useRef<CountryProfilesHandle>(null);
  const [featureOptions, setFeatureOptions] = useState<CountryTaxonomyOption[]>(
    [],
  );
  const [testOptions, setTestOptions] = useState<CountryTaxonomyOption[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  /** The server's copy of each saved FAQ, so a save can tell an edited row
   * from an untouched one. Refreshed from every server response, never from
   * local edits. */
  const pristineFaqs = useRef<Map<string, FaqRow>>(new Map());
  const rememberFaqs = (rows: FaqRow[]) => {
    pristineFaqs.current = new Map(
      rows.filter((row) => row.id).map((row) => [row.id as string, { ...row }]),
    );
    return rows;
  };
  const [cards, setCards] = useState<CardRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const addDocument = (name: string) => {
    setDocuments((rows) => [...rows, { name, details: "", isRequired: true }]);
    setDirty(true);
  };
  const updateDocument = (index: number, patch: Partial<DocumentRow>) => {
    setDocuments((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setDirty(true);
  };
  const removeDocument = (index: number) => {
    setDocuments((rows) => rows.filter((_, i) => i !== index));
    setDirty(true);
  };
  const [removedSections, setRemovedSections] = useState<SectionRow[]>([]);
  const [removedFaqs, setRemovedFaqs] = useState<FaqRow[]>([]);
  const [removedCards, setRemovedCards] = useState<CardRow[]>([]);
  const [existingSeo, setExistingSeo] = useState<EditorialSeo | null>(null);
  const [seo, setSeo] = useState<UnifiedSeoDraft>(blankUnifiedSeo);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState<Intent | null>(null);
  /* Draft confirmations stay on this page; a publish confirmation is handed
   * to the list instead, because publishing navigates there. */
  const [notice, setNotice] = useState<Flash | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  /** One message per field, shown under that field. The banner stays for
   * whole-record problems; anything a single control can explain belongs on
   * that control. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** Runs when the operator leaves a field, and again on every save. */
  const checkField = (field: string, value: string) => {
    const rule = countryFieldRules[field] ?? seoFieldRules[field];
    const error = rule ? rule(value) : null;
    setFieldErrors((current) => {
      if (error) return { ...current, [field]: error };
      if (!(field in current)) return current;
      // Correcting a field clears its message immediately -- the operator
      // should not have to save again to find out they fixed it.
      const next = { ...current };
      delete next[field];
      return next;
    });
    return error;
  };

  /** Every rule at once, for the moment Save is pressed. */
  const validateAllFields = () => {
    const found: Record<string, string> = {};
    for (const [field, rule] of Object.entries(countryFieldRules)) {
      const error = rule(String(core[field as keyof Core] ?? ""));
      if (error) found[field] = error;
    }
    if (hasSeo(seo))
      for (const [field, rule] of Object.entries(seoFieldRules)) {
        const error = rule(String(seo[field as keyof UnifiedSeoDraft] ?? ""));
        if (error) found[field] = error;
      }
    setFieldErrors(found);
    return found;
  };

  /** Put the operator on the first thing they have to fix. */
  const focusField = (field: string) => {
    const el = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  };
  const [dirty, setDirty] = useState(false);

  /* Stable identity: the profiles editor memoises its per-card setters against
   * this, so a fresh closure each render would rebuild all four every time. */
  const markDirty = useCallback(() => setDirty(true), []);

  /* What the shared editor's inline `%` autocomplete is told about this
   * record. `countryId` ranks this country's own universities and cities above
   * unrelated ones; the values let `%country` resolve what is currently in the
   * form, so it works on a country that has never been saved. */
  const entityContext = useMemo(
    () => ({
      countryId: record?.id,
      variableContext: "country",
      variableValues: {
        countryName: core.name,
        countrySlug: core.slug,
      },
    }),
    [core.name, core.slug, record?.id],
  );
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        /* Tag options are still not fetched: the form does not offer that
         * picker. A country's tag mappings load below and are sent back
         * untouched, as they were before. */
        const [continentResult, mediaResult, featureResult, testResult, subjectRows] =
          await Promise.all([
            listContinents({ limit: 100 }),
            listEditorialMedia({ limit: 50 }),
            listCountryFeatures(),
            listCountryEnglishTests(),
            /* Caught on its own, and only on its own. This pages through the
             * whole taxonomy to fill one picker, and the editor is not worth
             * risking for it -- a rejection here once took the whole Country
             * form down, leaving it with no continents. Catching it inside the
             * batch keeps the load a single awaited step, so every option list
             * still lands together, while a failure costs nothing more than an
             * empty picker. The country's own `subjectIds` round-trip
             * untouched either way. */
            Promise.resolve(listAllSubjects()).catch(() => []),
          ]);
        if (!active) return;
        setContinents(continentResult.data);
        setMedia(mediaResult.data);
        setFeatureOptions(featureResult.data ?? []);
        setTestOptions(testResult.data ?? []);
        setSubjects(subjectRows ?? []);
        if (!countryId) return;
        const [countryResult, editorialResult, curationResult] =
          await Promise.all([
            getCountry(countryId),
            getCountryEditorial(countryId),
            getCountryCurationOptions(countryId),
          ]);
        if (!active) return;

        const country = countryResult.data;
        setRecord(country);
        setCore({
          externalUid: country.externalUid ?? "",
          /* Optional since Country became a CMS record: a country saved with
           * nothing but a name has no continent, and reading through it threw
           * before the form had loaded a single field -- so the editor came up
           * empty and then complained that the name was missing. */
          continentId: country.continent?.id ?? "",
          name: country.name,
          slug: country.slug,
          /* Nullable for the same reason as the continent above, and every
           * control here is a controlled string -- a null reached `.trim()` on
           * the next save and took the whole editor down with it. */
          pageHeading: country.pageHeading ?? "",
          shortDescription: country.shortDescription ?? "",
          overview: country.overview ?? "",
          tagline: country.tagline ?? "",
          iso2Code: country.iso2Code ?? "",
          iso3Code: country.iso3Code ?? "",
          capitalCity: country.capitalCity ?? "",
          officialLanguage: country.officialLanguage ?? "",
          currencyName: country.currencyName ?? "",
          currencyCode: country.currency?.code ?? "",
          currencySymbol: country.currency?.symbol ?? "",
          // Blank placeholders here used to clear the country's media and
          // currency name on the next save, because the form submits whatever
          // it is holding.
          flagMediaId: country.flagMediaId ?? "",
          listingMediaId: country.listingMediaId ?? "",
          heroMediaId: country.heroMediaId ?? "",
          isFeatured: country.featured,
          displayOrder: String(country.displayOrder),
        });
        setDocuments(
          (country.documents ?? []).map((row) => ({
            name: row.name,
            details: row.details ?? "",
            isRequired: row.isRequired,
          })),
        );
        setSubjectIds(country.subjectIds ?? []);
        setTagIds(country.tagIds ?? []);
        setConfiguration({
          featureCodes:
            country.configuration?.features.map((feature) => feature.code) ??
            [],
          acceptedTests:
            country.configuration?.acceptedTests.map((test) => test.code) ?? [],
          intakeMonths: country.configuration?.intakeMonths ?? [],
          calculatorConfig: country.configuration?.calculator
            ? JSON.stringify(country.configuration.calculator, null, 2)
            : "",
          postStudyWorkPermitMonths:
            country.configuration?.postStudyWorkPermitMonths === null ||
            country.configuration?.postStudyWorkPermitMonths === undefined
              ? ""
              : String(country.configuration.postStudyWorkPermitMonths),
          popularUniversityIds: country.popularUniversityIds ?? [],
          popularCourseIds: country.popularCourseIds ?? [],
        });
        setCurationOptions(curationResult.data);

        const editorialBundle: CountryEditorialBundle = editorialResult.data;
        setSections(
          editorialBundle.sections.map((row) => ({
            ...draftFromSection(row),
            id: row.id,
            updatedAt: row.updatedAt,
          })),
        );
        setFaqs(
          rememberFaqs(
            editorialBundle.faqs.map((row) => ({
              id: row.id,
              updatedAt: row.updatedAt,
              question: row.question,
              answer: row.answer,
              category: row.category ?? "",
              isFeatured: row.isFeatured,
              status: row.status,
              displayOrder: String(row.displayOrder),
            })),
          ),
        );
        setCards(
          editorialBundle.consultantCards.map((row) => ({
            id: row.id,
            updatedAt: row.updatedAt,
            title: row.title,
            slug: row.slug,
            shortDescription: row.shortDescription,
            overview: row.overview ?? "",
            iconMediaId: row.iconMediaId ?? "",
            featuredMediaId: row.featuredMediaId ?? "",
            isFreeConsultation: row.isFreeConsultation,
            ctaLabel: row.ctaLabel,
            ctaUrl: row.ctaUrl ?? "",
            status: row.status,
            isFeatured: row.isFeatured,
            displayOrder: String(row.displayOrder),
          })),
        );
        setExistingSeo(editorialBundle.seo);
        setSeo(seoFromRecord(editorialBundle.seo));
      } catch (cause: unknown) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load country editor",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [countryId]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setCoreField = <K extends keyof Core>(key: K, value: Core[K]) => {
    if (key === "slug") setSlugEdited(true);
    setCore((current) => ({
      ...current,
      [key]: value,
      ...(key === "name"
        ? {
            slug: nextAutoSlug({
              sourceValue: String(value),
              currentSlug: current.slug,
              existingRecord: Boolean(countryId),
              manuallyOverridden: slugEdited,
            }),
          }
        : {}),
    }));
    setDirty(true);
    setIssues([]);
  };
  /** Adds a reusable option and selects it on this Country.
   *
   * The option is global on purpose: the operator who needs "Scholarship
   * friendly" for Ireland is the same operator who will want it for Canada
   * next week, and a Country-local string would leave the public side with a
   * code it has no label for. An option that already exists comes back from
   * the API rather than erroring, so adding a duplicate simply selects it. */
  const addTaxonomyOption = async (
    kind: "feature" | "englishTest",
    name: string,
  ) => {
    const create = kind === "feature" ? createCountryFeature : createCountryEnglishTest;
    const setOptions = kind === "feature" ? setFeatureOptions : setTestOptions;
    const key = kind === "feature" ? "featureCodes" : "acceptedTests";
    const { data } = await create({ name });
    if (!data) return;
    setOptions((current) =>
      current.some((option) => option.code === data.code)
        ? current
        : [...current, data],
    );
    setConfiguration((current) =>
      (current[key] as string[]).includes(data.code)
        ? current
        : { ...current, [key]: [...(current[key] as string[]), data.code] },
    );
  };

  const toggleConfiguration = (
    key:
      | "featureCodes"
      | "acceptedTests"
      | "intakeMonths"
      | "popularUniversityIds"
      | "popularCourseIds",
    value: string | number,
  ) => {
    setConfiguration((current) => {
      const values = current[key] as Array<string | number>;
      const included = values.includes(value);
      return {
        ...current,
        [key]: included
          ? values.filter((item) => item !== value)
          : [...values, value],
      } as CountryConfiguration;
    });
    setDirty(true);
  };
  const updateSection = (index: number, patch: Partial<SectionRow>) => {
    setSections((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setDirty(true);
  };
  const updateFaq = (index: number, patch: Partial<FaqRow>) => {
    setFaqs((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setDirty(true);
  };
  const updateCard = (index: number, patch: Partial<CardRow>) => {
    setCards((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setDirty(true);
  };
  const removeSection = (index: number) => {
    const row = sections[index];
    if (row.id) setRemovedSections((old) => [...old, row]);
    setSections((rows) => rows.filter((_, i) => i !== index));
    setDirty(true);
  };
  const removeFaq = (index: number) => {
    const row = faqs[index];
    if (row.id) setRemovedFaqs((old) => [...old, row]);
    setFaqs((rows) => rows.filter((_, i) => i !== index));
    setDirty(true);
  };
  const removeCard = (index: number) => {
    const row = cards[index];
    if (row.id) setRemovedCards((old) => [...old, row]);
    setCards((rows) => rows.filter((_, i) => i !== index));
    setDirty(true);
  };

  const activeSections = useMemo(
    () =>
      sections.filter(
        (row) => row.id || row.heading.trim() || row.eyebrow.trim(),
      ),
    [sections],
  );
  const activeFaqs = useMemo(
    () =>
      faqs.filter((row) => row.id || row.question.trim() || row.answer.trim()),
    [faqs],
  );
  const activeCards = useMemo(
    () =>
      cards.filter(
        (row) => row.id || row.title.trim() || row.shortDescription.trim(),
      ),
    [cards],
  );

  function validate() {
    const next: string[] = [];
    /* Per-field rules are the primary signal and render under their own
     * control; the list below stays for the things no single field can
     * explain, and for repeatable rows that have no control of their own. */
    const perField = validateAllFields();
    const firstInvalid = Object.keys(perField)[0];
    if (firstInvalid) {
      next.push(
        Object.keys(perField).length === 1
          ? "One field needs attention — see the message under it."
          : `${Object.keys(perField).length} fields need attention — see the messages under them.`,
      );
      focusField(firstInvalid);
    }
    activeSections.forEach((row, index) => {
      if (!row.heading.trim())
        next.push(`Content section ${index + 1}: heading is required.`);
      if (
        row.ctaUrl &&
        !/^\/(?!\/)|^#[a-zA-Z0-9_-]+$|^https:\/\//.test(row.ctaUrl)
      )
        next.push(`Content section ${index + 1}: CTA URL is invalid.`);
    });
    activeFaqs.forEach((row, index) => {
      if (!row.question.trim() || !row.answer.trim())
        next.push(`FAQ ${index + 1}: question and answer are required.`);
    });
    activeCards.forEach((row, index) => {
      if (!row.title.trim() || !row.shortDescription.trim())
        next.push(
          `Guidance card ${index + 1}: title and short description are required.`,
        );
    });
    if (hasSeo(seo) && (!seo.seoTitle.trim() || !seo.metaDescription.trim()))
      next.push(
        "SEO title and meta description are required when SEO is configured.",
      );
    // A malformed CTA used to pass the browser untouched and come back from the
    // API as a bare "Invalid catalog request", naming no field at all.
    for (const [index, row] of activeCards.entries()) {
      const ctaError = ctaUrlInputError(row.ctaUrl);
      if (ctaError)
        next.push(
          `Guidance card ${row.title.trim() || index + 1} — CTA URL: ${ctaError}`,
        );
    }
    setIssues(next);
    return next.length === 0;
  }
  async function syncEditorial(id: string) {
    for (const row of removedSections)
      if (row.id) await deleteEditorialSection(id, row.id, row.updatedAt);
    const nextSections: SectionRow[] = [];
    // The list itself is the running order — a section has no display-order
    // field of its own, so without this every section saved as 0 and came back
    // in whatever order the database chose.
    for (const [index, row] of activeSections.entries()) {
      const payload = {
        sectionKey: row.sectionKey,
        sectionType: row.sectionType,
        eyebrow: optional(row.eyebrow),
        heading: row.heading.trim(),
        subheading: optional(row.subheading),
        bodyJson: bodyForApi(row),
        primaryMediaId: row.primaryMediaId || undefined,
        secondaryMediaId: row.secondaryMediaId || undefined,
        ctaLabel: optional(row.ctaLabel),
        ctaUrl: optional(row.ctaUrl),
        /* An explicit Display order wins; otherwise the position in the list
         * supplies it, which is what a row left at the default 0 wants. It
         * used to always be the index, so a number typed into the visible
         * Display order field was accepted and then silently discarded. */
        displayOrder: row.displayOrder > 0 ? row.displayOrder : index,
        status: row.status,
        ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}),
      };
      const result = row.id
        ? await updateEditorialSection(id, row.id, payload)
        : await createEditorialSection(id, payload);
      nextSections.push({
        ...draftFromSection(result.data),
        id: result.data.id,
        updatedAt: result.data.updatedAt,
      });
    }
    setSections(nextSections);
    setRemovedSections([]);
    for (const row of removedFaqs)
      if (row.id) await deleteCountryFaq(id, row.id, row.updatedAt);
    const nextFaqs: FaqRow[] = [];
    for (const row of activeFaqs) {
      // An untouched FAQ is left exactly as the server holds it. Re-sending it
      // gains nothing and, when its stored answer predates a validation rule,
      // fails the whole Country save over content nobody was editing.
      if (!faqRowChanged(row, row.id ? pristineFaqs.current.get(row.id) : undefined)) {
        nextFaqs.push(row);
        continue;
      }
      const payload = {
        question: row.question.trim(),
        answer: row.answer.trim(),
        category: optional(row.category),
        isFeatured: row.isFeatured,
        status: row.status,
        displayOrder: Number(row.displayOrder) || 0,
        ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}),
      };
      /* A FAQ's validation error names a property, not a form field, so the
         page could only say "Invalid catalog request". Say which FAQ, and
         what the API said about it. */
      let result: Awaited<ReturnType<typeof updateCountryFaq>>;
      try {
        result = row.id
          ? await updateCountryFaq(id, row.id, payload)
          : await createCountryFaq(id, payload);
      } catch (cause: unknown) {
        const details = (cause as { details?: unknown }).details;
        const reasons = Array.isArray(details)
          ? details
              .map((entry) => (entry as { message?: unknown }).message)
              .filter((message): message is string => typeof message === "string")
          : [];
        throw new Error(
          `The FAQ “${payload.question}” could not be saved${
            reasons.length ? `: ${reasons.join("; ")}.` : "."
          }`,
        );
      }
      nextFaqs.push({
        id: result.data.id,
        updatedAt: result.data.updatedAt,
        question: result.data.question,
        answer: result.data.answer,
        category: result.data.category ?? "",
        isFeatured: result.data.isFeatured,
        status: result.data.status,
        displayOrder: String(result.data.displayOrder),
      });
    }
    setFaqs(rememberFaqs(nextFaqs));
    setRemovedFaqs([]);
    for (const row of removedCards)
      if (row.id) await deleteConsultantCard(id, row.id, row.updatedAt);
    const nextCards: CardRow[] = [];
    for (const row of activeCards) {
      const payload = {
        title: row.title.trim(),
        slug: row.slug.trim() || slugify(row.title),
        shortDescription: row.shortDescription.trim(),
        overview: optional(row.overview),
        iconMediaId: row.iconMediaId || undefined,
        featuredMediaId: row.featuredMediaId || undefined,
        isFreeConsultation: row.isFreeConsultation,
        ctaLabel: row.ctaLabel.trim() || "View consultants",
        ctaUrl: optional(row.ctaUrl),
        status: row.status,
        isFeatured: row.isFeatured,
        displayOrder: Number(row.displayOrder) || 0,
        ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}),
      };
      const result = row.id
        ? await updateConsultantCard(id, row.id, payload)
        : await createConsultantCard(id, payload);
      const saved = result.data;
      nextCards.push({
        id: saved.id,
        updatedAt: saved.updatedAt,
        title: saved.title,
        slug: saved.slug,
        shortDescription: saved.shortDescription,
        overview: saved.overview ?? "",
        iconMediaId: saved.iconMediaId ?? "",
        featuredMediaId: saved.featuredMediaId ?? "",
        isFreeConsultation: saved.isFreeConsultation,
        ctaLabel: saved.ctaLabel,
        ctaUrl: saved.ctaUrl ?? "",
        status: saved.status,
        isFeatured: saved.isFeatured,
        displayOrder: String(saved.displayOrder),
      });
    }
    setCards(nextCards);
    setRemovedCards([]);
    if (hasSeo(seo)) {
      const result = await saveCountrySeo(id, {
        ...seoPayload(seo),
        // The Country editorial contract distinguishes an omitted legacy
        // field from an intentional clear. The shared draft uses an empty
        // string for an empty input, so send null only on this endpoint.
        canonicalUrl: seo.canonicalUrl.trim() || null,
        ...(existingSeo ? { expectedUpdatedAt: existingSeo.updatedAt } : {}),
        ...(existingSeo?.schemaJson
          ? { schemaJson: existingSeo.schemaJson }
          : {}),
        ...(existingSeo?.hreflangJson
          ? { hreflangJson: existingSeo.hreflangJson }
          : {}),
      });
      setExistingSeo(result.data);
      setSeo(seoFromRecord(result.data));
    } else if (existingSeo) {
      await deleteCountrySeo(id, existingSeo.updatedAt);
      setExistingSeo(null);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const intent: Intent = submitter?.value === "publish" ? "publish" : "draft";
    if (!validate()) return;
    /* Read before the writes below move it, so "moved to draft" is only said
     * when this save is what unpublished the country. */
    const wasPublished = record?.status === "PUBLISHED";
    setSaving(true);
    setSavingIntent(intent);
    setError("");
    setNotice(null);
    try {
      const payload = {
        /* An unpicked continent is an empty select value, and the API reads
         * that as a malformed id rather than as "none" -- so a country
         * carrying nothing but a name, the one thing this editor now
         * guarantees can be saved, came back as an invalid request naming no
         * field at all. */
        continentId: clearable(core.continentId),
        name: core.name.trim(),
        slug: core.slug.trim() || slugify(core.name),
        pageHeading: core.pageHeading.trim(),
        shortDescription: core.shortDescription.trim(),
        // The client's own import identity. It belongs to the Country row --
        // it used to be sent on each editorial section instead, where there is
        // no such column, so a UID typed here was silently never stored.
        externalUid: clearable(core.externalUid),
        overview: clearable(core.overview),
        tagline: clearable(core.tagline),
        iso2Code: optional(core.iso2Code),
        iso3Code: optional(core.iso3Code),
        capitalCity: clearable(core.capitalCity),
        officialLanguage: clearable(core.officialLanguage),
        currencyName: clearable(core.currencyName),
        currencyCode: clearable(core.currencyCode),
        currencySymbol: clearable(core.currencySymbol),
        flagMediaId: clearable(core.flagMediaId),
        listingMediaId: clearable(core.listingMediaId),
        heroMediaId: clearable(core.heroMediaId),
        subjectIds,
        tagIds,
        isFeatured: core.isFeatured,
        displayOrder: Number(core.displayOrder) || 0,
        /* Edited as one list on the Country itself, so it travels with the
         * record rather than through a save of its own. */
        documents: documents
          .filter((row) => row.name.trim())
          .map((row) => ({
            name: row.name.trim(),
            details: row.details.trim() || undefined,
            isRequired: row.isRequired,
          })),
        featureCodes: configuration.featureCodes,
        acceptedTests: configuration.acceptedTests,
        intakeMonths: configuration.intakeMonths,
        /* An emptied box clears the figure. Sending nothing left it as it
           was, so once saved it could never be removed from the guide. */
        postStudyWorkPermitMonths:
          configuration.postStudyWorkPermitMonths.trim() === ""
            ? null
            : Number(configuration.postStudyWorkPermitMonths),
        /* An empty box clears the calculator; anything else is sent as the
           parsed document so the API validates the real shape, not a string. */
        calculatorConfig: configuration.calculatorConfig.trim()
          ? (JSON.parse(configuration.calculatorConfig) as Record<string, unknown>)
          : null,
        popularUniversityIds: configuration.popularUniversityIds,
        popularCourseIds: configuration.popularCourseIds,
        ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
      };
      let saved = record
        ? (await updateCountry(record.id, payload)).data
        : (await createCountry(payload)).data;
      /* The country row is written now, and everything after this can still
       * fail -- an editorial record the server rejects, say. When that happens
       * the operator corrects that field and saves again, so the version token
       * has to advance with the server at the moment it advances, not once the
       * whole sequence succeeds. Holding the pre-write token made that retry
       * fail as "changed in another session" when nothing else had touched it.
       * It also pins a newly created country's id, so a retry updates it
       * instead of trying to create the same slug twice. */
      setRecord(saved);
      /* Every save, not only the one that created the row. A profile card the
       * author filled in is part of what the button in front of them says it
       * saves, and skipping it here is what made Work and visa values vanish on
       * reopen. Only cards they actually edited are written, and each still
       * carries the version token it was read with, so another session's edit
       * is refused as stale rather than overwritten. */
      await profilesRef.current?.persistDrafts(saved.id);
      await syncEditorial(saved.id);
      const refreshed = (await getCountry(saved.id)).data;
      saved =
        intent === "publish"
          ? refreshed.status === "PUBLISHED"
            ? refreshed
            : (await publishCountry(refreshed.id, refreshed.updatedAt)).data
          : refreshed.status === "PUBLISHED"
            ? (await unpublishCountry(refreshed.id, refreshed.updatedAt)).data
            : refreshed;
      setRecord(saved);
      setDirty(false);
      /* Publishing is the end of the editing session, so it hands the
       * confirmation to the list and goes there. Saving a draft is the middle
       * of one, so it confirms in place and leaves the operator where they
       * were typing. Both only run past the awaits above, so a rejected save
       * never reaches either. */
      if (intent === "publish") {
        queueFlash({
          tone: "success",
          message: `${saved.name} published successfully.`,
        });
        router.push("/countries");
        return;
      }
      setNotice({
        tone: "neutral",
        message:
          wasPublished && saved.status !== "PUBLISHED"
            ? "Country moved to draft."
            : "Draft saved.",
      });
      if (!countryId) router.replace(`/countries/${saved.id}`);
      router.refresh();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      /* The API names the offending field -- in `details` for a readiness
       * failure, in the code for a conflict. Routing it back to that field is
       * the difference between "Invalid catalog request" and a message the
       * operator can act on without leaving the control they are editing. */
      const serverFields = fieldErrorsFromServer(cause);
      if (Object.keys(serverFields).length) {
        setFieldErrors((current) => ({ ...current, ...serverFields }));
        focusField(Object.keys(serverFields)[0]);
        setError(
          Object.keys(serverFields).length === 1
            ? "One field needs attention — see the message under it."
            : `${Object.keys(serverFields).length} fields need attention — see the messages under them.`,
        );
      } else {
        setError(
          typed.message ??
            (cause instanceof Error ? cause.message : "Unable to save country"),
        );
      }
    } finally {
      setSaving(false);
      setSavingIntent(null);
    }
  }

  if (loading)
    return (
      <section className="mx-auto max-w-[1100px] rounded-2xl border border-[#E8ECF3] bg-white p-8">
        <p className="text-sm text-[#667085]">
          Loading complete country editor…
        </p>
      </section>
    );

  return (
    <section
      className="mx-auto w-full min-w-0 max-w-[1180px] px-4 sm:px-6 lg:px-0"
      aria-labelledby="country-form-heading"
    >
      <Link href="/countries" className="text-sm font-semibold text-[#1657CF]">
        ← Countries
      </Link>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
            Unified country editor
          </p>
          <h2 id="country-form-heading" className="mt-2 text-3xl font-semibold">
            {record ? "Edit country" : "Create country"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
            Editorial country information, configuration and curated
            relationships. University and offering facts are derived
            automatically.
          </p>
        </div>
        <span className="rounded-full border border-[#D9E0EA] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#667085]">
          {record?.status ?? "DRAFT"}
        </span>
      </div>
      <FlashBanner flash={notice} onDismiss={dismissNotice} />
      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] px-4 py-3 text-sm font-semibold text-[#B42318]"
        >
          {error}
        </p>
      ) : null}
      {issues.length ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-[#F2C5C5] bg-[#FFF7F7] p-4 text-sm text-[#B42318]"
        >
          <p className="font-semibold">Fix these fields:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <form onSubmit={submit} className="mt-8 space-y-6">
        <Card
          eyebrow="Country"
          title="Identity & listing"
          description="Core catalogue identity and public listing content. ISO and currency are filled from local canonical country metadata."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="UID"
              value={core.externalUid}
              name="externalUid"
              error={fieldErrors.externalUid}
              onBlur={() => checkField("externalUid", core.externalUid)}
              onChange={(value) => setCoreField("externalUid", value)}
            />
            <ContinentField
              value={core.continentId}
              continents={continents}
              onSelect={(value) => setCoreField("continentId", value)}
              onCreated={(created) => {
                setContinents((rows) => [...rows, created]);
                setCoreField("continentId", created.id);
              }}
            />
            <Input
              label="Country name"
              value={core.name}
              name="name"
              error={fieldErrors.name}
              onBlur={() => checkField("name", core.name)}
              onChange={(value) => setCoreField("name", value)}
            />
            <Input
              label="Slug"
              value={core.slug}
              name="slug"
              error={fieldErrors.slug}
              onBlur={() => checkField("slug", core.slug)}
              onChange={(value) => setCoreField("slug", value)}
            />
            {/* Display order is no longer edited here: it is a listing concern,
              * not country content. The value is still loaded and sent back
              * unchanged, so existing ordering and imports keep working. */}
            <Input
              label="Page heading"
              value={core.pageHeading}
              name="pageHeading"
              error={fieldErrors.pageHeading}
              onBlur={() => checkField("pageHeading", core.pageHeading)}
              onChange={(value) => setCoreField("pageHeading", value)}
              span
            />
            <div className="sm:col-span-2">
              <RichTextEditor
                label="Short description"
                value={core.shortDescription}
                onChange={(value) => setCoreField("shortDescription", value)}
                allowedVariables={variablesForContext("country")}
                entityContext={entityContext}
                enableImages={false}
                minHeight="min-h-28"
              />
              {fieldErrors.shortDescription ? (
                <p role="alert" className="mt-1 text-xs font-semibold text-[#B42318]">
                  {fieldErrors.shortDescription}
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <RichTextEditor
                label="Overview"
                value={core.overview}
                onChange={(value) => setCoreField("overview", value)}
                allowedVariables={variablesForContext("country")}
                entityContext={entityContext}
                media={media}
                minHeight="min-h-40"
              />
            </div>
            <Input
              label="Tagline"
              value={core.tagline}
              name="tagline"
              error={fieldErrors.tagline}
              onBlur={() => checkField("tagline", core.tagline)}
              onChange={(value) => setCoreField("tagline", value)}
              span
            />
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Input
              label="ISO"
              value={core.iso2Code}
              name="iso2Code"
              error={fieldErrors.iso2Code}
              onBlur={() => checkField("iso2Code", core.iso2Code)}
              onChange={(value) =>
                setCoreField("iso2Code", value.toUpperCase())
              }
              maxLength={2}
              pattern="[A-Za-z]{2}"
            />
            {/* ISO3 is not edited here any more. It stays on the record and the
              * API still derives it from a recognised country name, so nothing
              * that reads it had to change. */}
            <FlagPreview iso2={core.iso2Code} />
            <Input
              label="Capital"
              value={core.capitalCity}
              name="capitalCity"
              error={fieldErrors.capitalCity}
              onBlur={() => checkField("capitalCity", core.capitalCity)}
              onChange={(value) => setCoreField("capitalCity", value)}
            />
            <Input
              label="Official language"
              value={core.officialLanguage}
              name="officialLanguage"
              error={fieldErrors.officialLanguage}
              onBlur={() => checkField("officialLanguage", core.officialLanguage)}
              onChange={(value) => setCoreField("officialLanguage", value)}
            />
            {/* Featured is not an author's decision, so the checkbox is gone
              * from this editor. The value itself is untouched: it is still
              * loaded from the record and sent back on every save, so a
              * country that is already featured stays featured and the public
              * `?featured=` filter keeps answering the same way. It is a grid
              * cell that simply is not filled, so nothing is left holding a
              * gap where it used to be. */}
          </div>
          <CurrencyRow
            code={core.currencyCode}
            name={core.currencyName}
            symbol={core.currencySymbol}
            onChange={(next) => {
              setCoreField("currencyName", next.name);
              setCoreField("currencyCode", next.code);
              setCoreField("currencySymbol", next.symbol);
            }}
          />
          {/* The flag is derived from the ISO code rather than uploaded -- see
            * FlagPreview above. Any flag media a country already has stays on
            * the record and is sent back untouched. */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <MediaPickerDialog
              label="Listing image"
              value={core.listingMediaId}
              media={media}
              onChange={(value) => setCoreField("listingMediaId", value)}
            />
            <MediaPickerDialog
              label="Hero image"
              value={core.heroMediaId}
              media={media}
              onChange={(value) => setCoreField("heroMediaId", value)}
            />
          </div>
          {/* Subjects are edited here again. The country guide publishes them
            * as its "Popular subjects" section, so an editor needs somewhere
            * to say which fields a destination is known for; until this came
            * back, the only way in was a bulk import.
            *
            * Tags stay out of this editor. They are still loaded into `tagIds`
            * and sent back unchanged on every save, so existing relations, the
            * list filters and importers keep working exactly as before. */}
          <div className="mt-6">
            <CountryTaxonomyPicker
              title="Subjects"
              singular="Subject"
              testId="country-subjects"
              rows={subjects.map((row) => ({
                id: row.id,
                label: row.name,
                usage: row.courseCount ?? 0,
                children: (row.subSubjects ?? []).map((child) => ({
                  id: child.id,
                  label: child.name,
                })),
              }))}
              selected={subjectIds}
              onChange={setSubjectIds}
              onCreate={async (name): Promise<CreateOutcome> => {
                const created = (
                  await createSubject({ name, slug: slugFromText(name) })
                ).data;
                setSubjects((rows) => [...rows, created]);
                return { kind: "created", id: created.id, label: created.name };
              }}
            />
          </div>
        </Card>
        <Card
          eyebrow="Configuration"
          title="Study destination setup"
          description="Only country-level editorial configuration belongs here. Tuition, rankings, statistics and admission scores are derived from published university and offering data."
        >
          <div className="space-y-6">
            <CheckboxGroup
              title="Features"
              options={featureOptions.map((option) => ({
                value: option.code,
                label: option.name,
              }))}
              selected={configuration.featureCodes}
              onToggle={(value) => toggleConfiguration("featureCodes", value)}
              addLabel="Add a feature"
              addPlaceholder="e.g. Scholarship friendly"
              onAdd={(name) => addTaxonomyOption("feature", name)}
            />
            <CheckboxGroup
              title="Accepted English tests"
              options={testOptions.map((option) => ({
                value: option.code,
                label: option.name,
              }))}
              selected={configuration.acceptedTests}
              onToggle={(value) => toggleConfiguration("acceptedTests", value)}
              addLabel="Add an English test"
              addPlaceholder="e.g. Duolingo"
              onAdd={(name) => addTaxonomyOption("englishTest", name)}
            />
            <CheckboxGroup
              title="Available intake months"
              options={monthOptions.map((label, index) => ({
                value: index + 1,
                label,
              }))}
              selected={configuration.intakeMonths.map(String)}
              onToggle={(value) =>
                toggleConfiguration("intakeMonths", Number(value))
              }
            />
            <CalculatorField
              value={configuration.calculatorConfig}
              onChange={(value) => {
                setConfiguration((current) => ({
                  ...current,
                  calculatorConfig: value,
                }));
                setDirty(true);
              }}
            />
            <Input
              label="Maximum post-study work permit (months)"
              value={configuration.postStudyWorkPermitMonths}
              onChange={(value) => {
                setConfiguration((current) => ({
                  ...current,
                  postStudyWorkPermitMonths: value,
                }));
                setDirty(true);
              }}
              type="number"
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <RelationPicker
                title="Popular Universities"
                description="Published universities in this country only."
                options={curationOptions?.universities ?? []}
                selected={configuration.popularUniversityIds}
                onToggle={(value) =>
                  toggleConfiguration("popularUniversityIds", value)
                }
                disabled={!record}
              />
              <RelationPicker
                title="Popular Courses"
                description="Published courses available in this country only."
                options={curationOptions?.courses ?? []}
                selected={configuration.popularCourseIds}
                onToggle={(value) =>
                  toggleConfiguration("popularCourseIds", value)
                }
                disabled={!record}
              />
            </div>
          </div>
        </Card>
        <Card
          eyebrow="Admissions"
          title="Documents required to study here"
          description="What a student needs in hand for this destination. Nothing is added until you add it, and a destination that asks for something else can have its own."
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[#344054]">Suggestions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED_DOCUMENTS.filter(
                  (name) => !documents.some((row) => row.name === name),
                ).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addDocument(name)}
                    className="rounded-full border border-[#D9E0EA] px-3 py-1.5 text-xs font-semibold text-[#344054]"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
            {documents.length ? (
              documents.map((row, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"
                >
                  <div className="flex justify-between">
                    <h4 className="font-semibold">Document {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeDocument(index)}
                      className="text-sm font-semibold text-[#B42318]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Document name"
                      value={row.name}
                      onChange={(value) => updateDocument(index, { name: value })}
                    />
                    <BooleanField
                      label="Required"
                      checked={row.isRequired}
                      onChange={(checked) =>
                        updateDocument(index, { isRequired: checked })
                      }
                    />
                    <div className="sm:col-span-2">
                      <RichTextEditor
                        label={`Details ${index + 1}`}
                        ariaLabel={`Details ${index + 1}`}
                        value={row.details}
                        onChange={(value) =>
                          updateDocument(index, { details: value })
                        }
                        allowedVariables={variablesForContext("country")}
                        entityContext={entityContext}
                        enableImages={false}
                        minHeight="min-h-20"
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#667085]">
                No documents listed. The public page leaves the section out
                until you add one.
              </p>
            )}
            <button
              type="button"
              onClick={() => addDocument("")}
              className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
            >
              + Add document
            </button>
          </div>
        </Card>
        {/* Rendered from the start, with or without a country row. Its cards
          * hold their values locally until the first save creates the parent,
          * and `persistDrafts` below writes them then. */}
        {/* The visa fee is quoted in the Country's currency, so the profile
          * card is told which one that is rather than asking for it again --
          * and it follows the selector above as soon as it changes. */}
        <CountryProfilesEditor
          ref={profilesRef}
          countryId={record?.id}
          currencyCode={core.currencyCode}
          /* So an edit made only in a profile card counts as an unsaved
           * change on the form that will write it. */
          onDirty={markDirty}
          entityContext={entityContext}
        />
        <Card
          eyebrow="Editorial"
          title="Content sections"
          description="All public country sections are edited here; no separate section save."
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSections((rows) => [...rows, { ...blankSection }]);
                setDirty(true);
              }}
              className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]"
            >
              + Add section
            </button>
          </div>
          <div className="mt-5 space-y-5">
            {sections.length === 0 ? (
              <Empty text="No editorial sections yet." />
            ) : (
              sections.map((row, index) => (
                <CountrySection
                entityContext={entityContext}
                  key={row.id ?? `section-${index}`}
                  index={index}
                  row={row}
                  media={media}
                  onChange={(patch) => updateSection(index, patch)}
                  onRemove={() => removeSection(index)}
                />
              ))
            )}
          </div>
        </Card>
        <Card
          eyebrow="Questions"
          title="FAQs"
          description="FAQs are part of the country save flow."
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setFaqs((rows) => [...rows, blankFaq()]);
                setDirty(true);
              }}
              className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]"
            >
              + Add FAQ
            </button>
          </div>
          <div className="mt-5 space-y-4">
            {faqs.length === 0 ? (
              <Empty text="No FAQs yet." />
            ) : (
              faqs.map((row, index) => (
                <div
                  key={row.id ?? `faq-${index}`}
                  className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"
                >
                  <div className="flex justify-between">
                    <h4 className="font-semibold">FAQ {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeFaq(index)}
                      className="text-sm font-semibold text-[#B42318]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Question"
                      value={row.question}
                      onChange={(value) =>
                        updateFaq(index, { question: value })
                      }
                      span
                    />
                    <div className="sm:col-span-2">
                      <RichTextEditor
                        label="Answer"
                        value={row.answer}
                        onChange={(value) => updateFaq(index, { answer: value })}
                        allowedVariables={variablesForContext("country")}
                        entityContext={entityContext}
                        enableImages={false}
                        minHeight="min-h-28"
                      />
                    </div>
                    <Input
                      label="Category"
                      value={row.category}
                      onChange={(value) =>
                        updateFaq(index, { category: value })
                      }
                    />
                    <Input
                      label="Display order"
                      value={row.displayOrder}
                      onChange={(value) =>
                        updateFaq(index, { displayOrder: value })
                      }
                      type="number"
                    />
                    <BooleanField
                      label="Featured FAQ"
                      checked={row.isFeatured}
                      onChange={(checked) =>
                        updateFaq(index, { isFeatured: checked })
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card
          eyebrow="Guidance"
          title="Consultant cards"
          description="Optional guidance cards are staged here and saved with the country."
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setCards((rows) => [...rows, blankCard()]);
                setDirty(true);
              }}
              className="rounded-xl border border-[#1657CF] px-4 py-2 text-sm font-semibold text-[#1657CF]"
            >
              + Add guidance card
            </button>
          </div>
          <div className="mt-5 space-y-5">
            {cards.length === 0 ? (
              <Empty text="No guidance cards yet." />
            ) : (
              cards.map((row, index) => (
                <div
                  key={row.id ?? `card-${index}`}
                  className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5"
                >
                  <div className="flex justify-between">
                    <h4 className="font-semibold">Guidance card {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeCard(index)}
                      className="text-sm font-semibold text-[#B42318]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Title"
                      value={row.title}
                      onChange={(value) =>
                        updateCard(index, {
                          title: value,
                          slug: row.slug || slugify(value),
                        })
                      }
                    />
                    <Input
                      label="Slug"
                      value={row.slug}
                      onChange={(value) => updateCard(index, { slug: value })}
                    />
                    <div className="sm:col-span-2">
                      <RichTextEditor
                        label="Short description"
                        value={row.shortDescription}
                        onChange={(value) =>
                          updateCard(index, { shortDescription: value })
                        }
                        allowedVariables={variablesForContext("country")}
                        entityContext={entityContext}
                        enableImages={false}
                        minHeight="min-h-24"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <RichTextEditor
                        label="Overview"
                        value={row.overview}
                        onChange={(value) =>
                          updateCard(index, { overview: value })
                        }
                        allowedVariables={variablesForContext("country")}
                        entityContext={entityContext}
                        enableImages={false}
                        minHeight="min-h-28"
                      />
                    </div>
                    <MediaPickerDialog
                      label="Icon media"
                      value={row.iconMediaId}
                      media={media}
                      onChange={(value) =>
                        updateCard(index, { iconMediaId: value })
                      }
                    />
                    <MediaPickerDialog
                      label="Featured media"
                      value={row.featuredMediaId}
                      media={media}
                      onChange={(value) =>
                        updateCard(index, { featuredMediaId: value })
                      }
                    />
                    <Input
                      label="CTA label"
                      value={row.ctaLabel}
                      onChange={(value) =>
                        updateCard(index, { ctaLabel: value })
                      }
                    />
                    <Input
                      label="CTA URL"
                      value={row.ctaUrl}
                      onChange={(value) => updateCard(index, { ctaUrl: value })}
                    />
                    <Input
                      label="Display order"
                      value={row.displayOrder}
                      onChange={(value) =>
                        updateCard(index, { displayOrder: value })
                      }
                      type="number"
                    />
                    {/* Cards are staged as drafts, and without this there was
                      * no way to ever publish one: the public page shows only
                      * ACTIVE cards, so every card built here stayed invisible. */}
                    <Select
                      label="Status"
                      value={row.status}
                      onChange={(value) => updateCard(index, { status: value })}
                      /* A card goes public on PUBLISHED -- that is the status
                       * the public page filters cards on. Sections and FAQs
                       * publish on ACTIVE instead, so offering ACTIVE here
                       * looked right and still left the card invisible. */
                      options={[
                        { id: "DRAFT", label: "Draft — not shown publicly" },
                        { id: "PUBLISHED", label: "Published — shown on the country page" },
                        { id: "INACTIVE", label: "Inactive — retired" },
                      ]}
                    />
                    <BooleanField
                      label="Free consultation"
                      checked={row.isFreeConsultation}
                      onChange={(checked) =>
                        updateCard(index, { isFreeConsultation: checked })
                      }
                    />
                    <BooleanField
                      label="Featured card"
                      checked={row.isFeatured}
                      onChange={(checked) =>
                        updateCard(index, { isFeatured: checked })
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
        <UnifiedSeoFields
          value={seo}
          onChange={(next) => {
            setSeo(next);
            setDirty(true);
          }}
          media={media}
        />
        <UnifiedEditorActions
          cancelHref="/countries"
          busy={saving}
          savingIntent={savingIntent}
          published={record?.status === "PUBLISHED"}
          sticky={false}
        />
      </form>
    </section>
  );
}

function Card({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-[#E8ECF3] bg-white p-6 sm:p-8">
      <legend className="sr-only">{title}</legend>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1657CF]">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#667085]">{description}</p>
      <div className="mt-6">{children}</div>
    </fieldset>
  );
}
/**
 * The budget calculator's configuration.
 *
 * It is one document -- base costs, then factor groups with their options --
 * and it is edited as JSON rather than through a bespoke builder, because that
 * is the honest shape of it and a builder would be a screen of its own for
 * something a handful of destinations will ever use. The text is checked for
 * being valid JSON as it is typed, and the API refuses anything the public
 * guide could not render, so a mistake surfaces here rather than as a missing
 * calculator nobody can explain.
 *
 * Empty means the destination has no calculator, which is a normal state.
 */
function CalculatorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const problem = (() => {
    if (!value.trim()) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return "This should be a single JSON object.";
      const record = parsed as Record<string, unknown>;
      if (!record.base) return "Missing the `base` costs.";
      if (!Array.isArray(record.factors) || record.factors.length === 0)
        return "Missing the `factors` list.";
      return null;
    } catch {
      return "This is not valid JSON yet.";
    }
  })();

  return (
    <label className="block text-sm font-semibold">
      Budget calculator
      <span className="mt-1 block text-xs font-normal text-[#667085]">
        Factor groups for the Study Abroad guide. Leave empty for no calculator.
        Base living costs come from the Cost and budget card; this only varies
        them.
      </span>
      <textarea
        className="mt-2 h-48 w-full rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 font-mono text-xs font-normal outline-none focus:border-[#1657CF]"
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        placeholder={'{\n  "base": { "livingMin": 850, "livingMax": 1200, "insurance": 130, "semesterFee": 275 },\n  "factors": [ ... ]\n}'}
      />
      {problem ? (
        <span className="mt-1 block text-xs font-normal text-[#B42318]">{problem}</span>
      ) : null}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] p-5 text-sm text-[#667085]">
      {text}
    </div>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
  textarea = false,
  span = false,
  rows = 3,
  min,
  max,
  step,
  maxLength,
  pattern,
  error,
  onBlur,
  name,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
  span?: boolean;
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  pattern?: string;
  /** Shown under this field. The operator should never have to hunt up the
   * page to find out which control the complaint is about. */
  error?: string;
  onBlur?: () => void;
  /** Lets Save focus the first field the operator still has to fix. */
  name?: string;
}) {
  // A label-derived id alone collides wherever a field repeats: every content
  // section renders a "Section key", so the sections shared one id, both labels
  // pointed at the first control, and the rest were left with none.
  const unique = useId();
  const id = `country-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${unique}`;
  const errorId = `${id}-error`;
  const shared = {
    id,
    className: `${input} ${error ? "border-[#D92D20] focus:border-[#D92D20]" : ""}`,
    value,
    maxLength,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    "data-field": name,
    onBlur,
  } as const;
  return (
    <div className={`min-w-0 text-sm font-semibold ${span ? "sm:col-span-2" : ""}`}>
      <FieldLabel label={label} htmlFor={id} />
      {textarea ? (
        <textarea
          {...shared}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...shared}
          type={type}
          min={min}
          max={max}
          step={step}
          pattern={pattern}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-sm font-medium text-[#B42318]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  const unique = useId();
  const id = `country-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${unique}`;
  return (
    <div className="text-sm font-semibold">
      <FieldLabel label={label} htmlFor={id} />
      <select
        id={id}
        className={input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The continent picker, plus a way out of the dead end where the continent a
 * country belongs to does not exist yet. Adding one here creates the real
 * catalogue record through the same endpoint the Continents screen uses — this
 * is not a country-local value — and selects it, so the half-typed country is
 * never lost to a detour.
 *
 * A name that already exists selects that continent instead of making a second
 * one. The id stays `country-continent` because that is what gives the field
 * its "Continent *" label and its help content.
 */
function ContinentField({
  value,
  continents,
  onSelect,
  onCreated,
}: {
  value: string;
  continents: ContinentRecord[];
  onSelect: (id: string) => void;
  onCreated: (record: ContinentRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", slug: "", code: "" });
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setOpen(false);
    setDraft({ name: "", slug: "", code: "" });
    setSlugEdited(false);
    setError("");
    setBusy(false);
  };

  async function submit() {
    const name = draft.name.trim();
    if (!name || busy) return;
    const slug = slugFromText(draft.slug || name);
    const existing = continents.find(
      (row) =>
        row.slug === slug ||
        row.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      // Already in the catalogue. Selecting beats creating a duplicate, but an
      // inactive continent cannot be chosen for a country, so say so plainly.
      if (existing.status === "ACTIVE") {
        onSelect(existing.id);
        close();
        return;
      }
      setError(
        `“${existing.name}” already exists but is inactive. Activate it on the Continents screen first.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createContinent({
        name,
        slug,
        code: draft.code.trim() || undefined,
        status: "ACTIVE",
      });
      onCreated(created.data);
      close();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(
        typed.message ??
          (cause instanceof Error
            ? cause.message
            : "Unable to create continent"),
      );
      setBusy(false);
    }
  }

  return (
    <div className="text-sm font-semibold">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel label="Continent" htmlFor="country-continent" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-[#1657CF] focus:outline-none focus:underline"
        >
          + Add continent
        </button>
      </div>
      <select
        id="country-continent"
        className={input}
        value={value}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">Select</option>
        {continents
          .filter((row) => row.status === "ACTIVE")
          .map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
      </select>
      {open ? (
        <CatalogDialog
          title="Add continent"
          description="This creates a catalogue continent straight away and selects it for this country."
          onClose={close}
        >
          {/* Deliberately not a <form>: CatalogDialog renders inline, so a form
           * here would be nested inside the country form. The parser drops the
           * inner tag, which turns this dialog's submit button into a submit
           * button for the country. Enter is handled here for the same reason
           * -- otherwise it would submit the half-filled country behind the
           * dialog. */}
          <div
            className="space-y-4"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
          >
            <div className="text-sm font-semibold">
              <FieldLabel label="Continent name" htmlFor="new-continent-name" />
              {/* No `required`: the country form is this input's real form
               * owner, so a required marker here would block the country's own
               * save. The Add button is disabled on an empty name instead. */}
              <input
                id="new-continent-name"
                autoFocus
                className={input}
                value={draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    name,
                    slug: slugEdited ? current.slug : slugFromText(name),
                  }));
                  setError("");
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="text-sm font-semibold">
                <FieldLabel label="Slug" htmlFor="new-continent-slug" />
                <input
                  id="new-continent-slug"
                  className={input}
                  value={draft.slug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setDraft((current) => ({
                      ...current,
                      slug: event.target.value,
                    }));
                  }}
                />
              </div>
              <div className="text-sm font-semibold">
                <FieldLabel label="Code" htmlFor="new-continent-code" />
                <input
                  id="new-continent-code"
                  className={input}
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-[#B42318]">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy || !draft.name.trim()}
                className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Adding…" : "Add continent"}
              </button>
            </div>
          </div>
        </CatalogDialog>
      ) : null}
    </div>
  );
}
function BooleanField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 self-end rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />{" "}
      {label}
    </label>
  );
}
function CheckboxGroup({
  title,
  options,
  selected,
  onToggle,
  addLabel,
  addPlaceholder,
  onAdd,
}: {
  title: string;
  options: Array<{ value: string | number; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  /* Only the two reusable taxonomies pass these; intake months are a fixed
   * twelve and there is nothing to add to them. */
  addLabel?: string;
  addPlaceholder?: string;
  onAdd?: (name: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const submitNew = async () => {
    const name = draft.trim();
    if (!name || !onAdd) return;
    setAdding(true);
    setAddError("");
    try {
      await onAdd(name);
      setDraft("");
    } catch (cause) {
      setAddError(
        cause instanceof Error ? cause.message : "Could not add that option",
      );
    } finally {
      setAdding(false);
    }
  };
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[#344054]">{title}</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label
            key={String(option.value)}
            className="flex items-center gap-3 rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-medium"
          >
            <input
              type="checkbox"
              checked={selected.includes(String(option.value))}
              onChange={() => onToggle(String(option.value))}
            />{" "}
            {option.label}
          </label>
        ))}
      </div>
      {onAdd ? (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              aria-label={addLabel}
              placeholder={addPlaceholder}
              className="min-w-0 flex-1 rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm"
              value={draft}
              disabled={adding}
              onChange={(event) => setDraft(event.target.value)}
              /* Enter adds the option rather than submitting the whole
               * Country, which is what a bare input inside this form would
               * otherwise do. */
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void submitNew();
              }}
            />
            <button
              type="button"
              className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold disabled:opacity-60"
              disabled={adding || !draft.trim()}
              onClick={() => void submitNew()}
            >
              {adding ? "Adding…" : addLabel}
            </button>
          </div>
          <p className="mt-2 text-xs text-[#667085]">
            Added options are available on every country.
          </p>
          {addError ? (
            <p role="alert" className="mt-1 text-xs text-[#B42318]">
              {addError}
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
function RelationPicker({
  title,
  description,
  options,
  selected,
  onToggle,
  disabled,
}: {
  title: string;
  description: string;
  options: Array<{
    id: string;
    name: string;
    slug: string;
    qsRanking?: number | null;
  }>;
  selected: string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="rounded-xl border border-[#D9E0EA] p-4">
      <legend className="px-1 text-sm font-semibold text-[#344054]">
        {title}
      </legend>
      <p className="mt-1 text-sm text-[#667085]">
        {disabled
          ? "Save the country first, then curate published records."
          : description}
      </p>
      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {options.length ? (
          options.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
            >
              <input
                disabled={disabled}
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => onToggle(option.id)}
              />{" "}
              <span>
                {option.name}
                {option.qsRanking ? ` · QS #${option.qsRanking}` : ""}
              </span>
            </label>
          ))
        ) : (
          <p className="text-sm text-[#667085]">
            No eligible published records yet.
          </p>
        )}
      </div>
    </fieldset>
  );
}
function CountrySection({
  index,
  row,
  media,
  entityContext,
  onChange,
  onRemove,
}: {
  index: number;
  row: SectionRow;
  media: EditorialMedia[];
  entityContext: EditorEntityContext;
  onChange: (patch: Partial<SectionRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#E8ECF3] bg-[#FBFCFE] p-5">
      <div className="flex justify-between">
        <h4 className="font-semibold">Content section {index + 1}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm font-semibold text-[#B42318]"
        >
          Remove
        </button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* A free-text identifier, not a chosen one. The public page has
          * dedicated renderers for a set of conventional keys and falls back
          * to the section type for anything else, so an author is no longer
          * limited to that set -- and a key they invent still anchors,
          * orders and renders. */}
        <Input
          label="Section key"
          value={row.sectionKey}
          onChange={(value) => onChange({ sectionKey: value })}
        />
        <Select
          label="Section type"
          value={row.sectionType}
          onChange={(value) => onChange({ sectionType: value as SectionType })}
          options={SECTION_TYPES.map((id) => ({
            id,
            label: id.replaceAll("_", " "),
          }))}
        />
        <Input
          label="Eyebrow"
          value={row.eyebrow}
          onChange={(value) => onChange({ eyebrow: value })}
        />
        <Input
          label="Heading"
          value={row.heading}
          onChange={(value) => onChange({ heading: value })}
        />
        <div className="sm:col-span-2">
          <RichTextEditor
            label="Subheading"
            value={row.subheading}
            onChange={(value) => onChange({ subheading: value })}
            allowedVariables={variablesForContext("country")}
            entityContext={entityContext}
            enableImages={false}
            minHeight="min-h-24"
          />
        </div>
        <Input
          label="Display order"
          value={String(row.displayOrder)}
          onChange={(value) => onChange({ displayOrder: Number(value) || 0 })}
          type="number"
        />
        <MediaPickerDialog
          label="Primary media"
          value={row.primaryMediaId}
          media={media}
          onChange={(value) => onChange({ primaryMediaId: value })}
        />
        <MediaPickerDialog
          label="Secondary media"
          value={row.secondaryMediaId}
          media={media}
          onChange={(value) => onChange({ secondaryMediaId: value })}
        />
        <Input
          label="CTA label"
          value={row.ctaLabel}
          onChange={(value) => onChange({ ctaLabel: value })}
        />
        <Input
          label="CTA URL"
          value={row.ctaUrl}
          onChange={(value) => onChange({ ctaUrl: value })}
        />
      </div>
      <div className="mt-5">
        <TypedBodyEditor
          entityContext={entityContext}
          type={row.sectionType}
          value={row.body}
          onChange={(body) => onChange({ body })}
          variables={variablesForContext("country")}
        />
      </div>
    </div>
  );
}

/**
 * Currency name, code and symbol are one fact, so they are chosen once. Any of
 * the three selectors sets all three, which is what stops "Euro / USD / £" --
 * a combination the three free-text inputs used to accept without complaint.
 */
function CurrencyRow({
  code,
  name,
  symbol,
  onChange,
}: {
  code: string;
  name: string;
  symbol: string;
  onChange: (value: { code: string; name: string; symbol: string }) => void;
}) {
  const selected = matchCurrency({ code, name, symbol });
  const apply = (option: CurrencyOption | null) =>
    onChange(
      option
        ? { code: option.code, name: option.name, symbol: option.symbol }
        : { code: "", name: "", symbol: "" },
    );
  const field = (label: string, render: (option: CurrencyOption) => string) => (
    <label className="block text-sm font-semibold">
      {label}
      <select
        className="mt-2 w-full rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 font-normal outline-none focus:border-[#1657CF]"
        value={selected?.code ?? ""}
        onChange={(event) => apply(currencyByCode(event.target.value))}
      >
        <option value="">Not set</option>
        {CURRENCY_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {render(option)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="mt-6">
      <div className="grid gap-5 sm:grid-cols-3">
        {field("Currency name", (option) => option.name)}
        {field("Currency code", (option) => option.code)}
        {field("Currency symbol", (option) => `${option.symbol} · ${option.code}`)}
      </div>
      {code && !selected ? (
        <p className="mt-2 text-xs text-[#667085]">
          {`This country stores ${code}${symbol ? ` (${symbol})` : ""}, which is not in the selectable list. Choosing a currency above will replace it.`}
        </p>
      ) : null}
    </div>
  );
}

/** The flag is the ISO code rendered as regional indicators -- nothing to
 * upload, and it cannot drift from the country's identity. */
function FlagPreview({ iso2 }: { iso2: string }) {
  const emoji = flagEmojiFromIso(iso2);
  return (
    <div className="text-sm font-semibold">
      <span className="block">Flag</span>
      <div
        data-testid="country-flag-emoji"
        className="mt-2 flex items-center gap-3 rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 font-normal"
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          {emoji || "—"}
        </span>
        <span className="text-xs text-[#667085]">
          {emoji
            ? `Derived from ISO ${iso2.toUpperCase()}`
            : "Set the ISO code to show this country's flag"}
        </span>
      </div>
    </div>
  );
}
