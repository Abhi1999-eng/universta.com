"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createConsultantCard,
  createContinent,
  createCountryTag,
  createCountry,
  createCountryFaq,
  createSubject,
  createEditorialSection,
  deleteConsultantCard,
  deleteCountryFaq,
  deleteCountrySeo,
  deleteEditorialSection,
  getCountry,
  getCountryCurationOptions,
  getCountryEditorial,
  listContinents,
  listCountryTags,
  listEditorialMedia,
  listSubjects,
  publishCountry,
  saveCountrySeo,
  unpublishCountry,
  updateConsultantCard,
  updateCountry,
  updateCountryFaq,
  updateEditorialSection,
} from "./catalog-client";
import type {
  CatalogMutationError,
  ContinentRecord,
  CountryEditorialBundle,
  CountryCurationOptions,
  CountryRecord,
  EditorialMedia,
  EditorialSeo,
  CountryTagRecord,
  SubjectRecord,
} from "./catalog.types";
import {
  CountryTaxonomyPicker,
  type CreateOutcome,
} from "./CountryTaxonomyPicker";
import { MediaPickerDialog } from "./editorial/MediaPickerDialog";
import { TypedBodyEditor } from "./editorial/TypedBodyEditor";
import {
  SECTION_KEYS,
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
import { nextAutoSlug, slugFromText } from "@/lib/slug";
import {
  blankUnifiedSeo,
  seoPayload,
  UnifiedSeoFields,
  type UnifiedSeoDraft,
} from "@/features/shared/UnifiedSeoFields";
import { CountryProfilesEditor } from "./CountryProfilesEditor";

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
  popularUniversityIds: string[];
  popularCourseIds: string[];
};
type SectionRow = SectionDraft & { id?: string; updatedAt?: string };
type FaqRow = {
  id?: string;
  updatedAt?: string;
  question: string;
  answer: string;
  category: string;
  isFeatured: boolean;
  status: string;
  displayOrder: string;
};
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

const featureOptions = [
  ["BUDGET_FRIENDLY", "Budget friendly"],
  ["IELTS_OPTIONAL", "IELTS optional"],
  ["HIGH_VISA_SUCCESS", "High visa success"],
  ["PR_FRIENDLY", "PR friendly"],
  ["TOP_RANKED_UNIVERSITIES", "Top ranked universities"],
  ["PART_TIME_ALLOWED", "Part-time allowed"],
  ["POST_STUDY_WORK_AVAILABLE", "Post-study work available"],
  ["LANGUAGE_WAIVER", "Language waiver"],
] as const;
const testOptions = ["IELTS", "TOEFL", "PTE"];
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
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [tags, setTags] = useState<CountryTagRecord[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [core, setCore] = useState<Core>(blankCore);
  const [configuration, setConfiguration] =
    useState<CountryConfiguration>(blankConfiguration);
  const [curationOptions, setCurationOptions] =
    useState<CountryCurationOptions | null>(null);
  const [media, setMedia] = useState<EditorialMedia[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [removedSections, setRemovedSections] = useState<SectionRow[]>([]);
  const [removedFaqs, setRemovedFaqs] = useState<FaqRow[]>([]);
  const [removedCards, setRemovedCards] = useState<CardRow[]>([]);
  const [existingSeo, setExistingSeo] = useState<EditorialSeo | null>(null);
  const [seo, setSeo] = useState<UnifiedSeoDraft>(blankUnifiedSeo);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingIntent, setSavingIntent] = useState<Intent | null>(null);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [continentResult, mediaResult, subjectResult, tagResult] =
          await Promise.all([
            listContinents({ limit: 100 }),
            listEditorialMedia({ limit: 50 }),
            listSubjects({ limit: 200 }),
            listCountryTags(),
          ]);
        if (!active) return;
        setContinents(continentResult.data);
        setMedia(mediaResult.data);
        setSubjects(subjectResult.data);
        setTags(tagResult.data);
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
          continentId: country.continent.id,
          name: country.name,
          slug: country.slug,
          pageHeading: country.pageHeading,
          shortDescription: country.shortDescription,
          overview: country.overview ?? "",
          tagline: country.tagline ?? "",
          iso2Code: country.iso2Code ?? "",
          iso3Code: country.iso3Code ?? "",
          capitalCity: country.capitalCity ?? "",
          officialLanguage: country.officialLanguage ?? "",
          currencyName: "",
          currencyCode: country.currency?.code ?? "",
          currencySymbol: country.currency?.symbol ?? "",
          flagMediaId: "",
          listingMediaId: "",
          heroMediaId: "",
          isFeatured: country.featured,
          displayOrder: String(country.displayOrder),
        });
        setSubjectIds(country.subjectIds ?? []);
        setTagIds(country.tagIds ?? []);
        setConfiguration({
          featureCodes:
            country.configuration?.features.map((feature) => feature.code) ??
            [],
          acceptedTests: country.configuration?.acceptedTests ?? [],
          intakeMonths: country.configuration?.intakeMonths ?? [],
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
    if (!core.continentId) next.push("Continent is required.");
    if (!core.name.trim()) next.push("Country name is required.");
    if (!core.slug.trim()) next.push("Slug is required.");
    if (!core.pageHeading.trim()) next.push("Page heading is required.");
    if (!core.shortDescription.trim())
      next.push("Short description is required.");
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
    setIssues(next);
    return next.length === 0;
  }
  async function syncEditorial(id: string) {
    for (const row of removedSections)
      if (row.id) await deleteEditorialSection(id, row.id, row.updatedAt);
    const nextSections: SectionRow[] = [];
    for (const row of activeSections) {
      const payload = {
        externalUid: optional(core.externalUid),
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
        displayOrder: row.displayOrder,
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
      const payload = {
        question: row.question.trim(),
        answer: row.answer.trim(),
        category: optional(row.category),
        isFeatured: row.isFeatured,
        status: row.status,
        displayOrder: Number(row.displayOrder) || 0,
        ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}),
      };
      const result = row.id
        ? await updateCountryFaq(id, row.id, payload)
        : await createCountryFaq(id, payload);
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
    setFaqs(nextFaqs);
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
        ...(existingSeo?.schemaJson
          ? { schemaJson: existingSeo.schemaJson }
          : {}),
        ...(existingSeo?.hreflangJson
          ? { hreflangJson: existingSeo.hreflangJson }
          : {}),
      });
      setExistingSeo(result.data);
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
    setSaving(true);
    setSavingIntent(intent);
    setError("");
    try {
      const payload = {
        continentId: core.continentId,
        name: core.name.trim(),
        slug: core.slug.trim() || slugify(core.name),
        pageHeading: core.pageHeading.trim(),
        shortDescription: core.shortDescription.trim(),
        overview: optional(core.overview),
        tagline: optional(core.tagline),
        iso2Code: optional(core.iso2Code),
        iso3Code: optional(core.iso3Code),
        capitalCity: optional(core.capitalCity),
        officialLanguage: optional(core.officialLanguage),
        currencyName: optional(core.currencyName),
        currencyCode: optional(core.currencyCode),
        currencySymbol: optional(core.currencySymbol),
        flagMediaId: optional(core.flagMediaId),
        listingMediaId: optional(core.listingMediaId),
        heroMediaId: optional(core.heroMediaId),
        subjectIds,
        tagIds,
        isFeatured: core.isFeatured,
        displayOrder: Number(core.displayOrder) || 0,
        featureCodes: configuration.featureCodes,
        acceptedTests: configuration.acceptedTests,
        intakeMonths: configuration.intakeMonths,
        postStudyWorkPermitMonths:
          configuration.postStudyWorkPermitMonths === ""
            ? undefined
            : Number(configuration.postStudyWorkPermitMonths),
        popularUniversityIds: configuration.popularUniversityIds,
        popularCourseIds: configuration.popularCourseIds,
        ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
      };
      let saved = record
        ? (await updateCountry(record.id, payload)).data
        : (await createCountry(payload)).data;
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
      if (!countryId) router.replace(`/countries/${saved.id}`);
      router.refresh();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(
        typed.message ??
          (cause instanceof Error ? cause.message : "Unable to save country"),
      );
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
      className="mx-auto max-w-[1180px]"
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
              onChange={(value) => setCoreField("name", value)}
            />
            <Input
              label="Slug"
              value={core.slug}
              onChange={(value) => setCoreField("slug", value)}
            />
            <Input
              label="Display order"
              value={core.displayOrder}
              onChange={(value) => setCoreField("displayOrder", value)}
              type="number"
            />
            <Input
              label="Page heading"
              value={core.pageHeading}
              onChange={(value) => setCoreField("pageHeading", value)}
              span
            />
            <Input
              label="Short description"
              value={core.shortDescription}
              onChange={(value) => setCoreField("shortDescription", value)}
              textarea
              span
              rows={4}
            />
            <Input
              label="Overview"
              value={core.overview}
              onChange={(value) => setCoreField("overview", value)}
              textarea
              span
              rows={6}
            />
            <Input
              label="Tagline"
              value={core.tagline}
              onChange={(value) => setCoreField("tagline", value)}
              span
            />
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Input
              label="ISO2"
              value={core.iso2Code}
              onChange={(value) =>
                setCoreField("iso2Code", value.toUpperCase())
              }
            />
            <Input
              label="ISO3"
              value={core.iso3Code}
              onChange={(value) =>
                setCoreField("iso3Code", value.toUpperCase())
              }
            />
            <Input
              label="Capital"
              value={core.capitalCity}
              onChange={(value) => setCoreField("capitalCity", value)}
            />
            <Input
              label="Official language"
              value={core.officialLanguage}
              onChange={(value) => setCoreField("officialLanguage", value)}
            />
            <Input
              label="Currency name"
              value={core.currencyName}
              onChange={(value) => setCoreField("currencyName", value)}
            />
            <Input
              label="Currency code"
              value={core.currencyCode}
              onChange={(value) =>
                setCoreField("currencyCode", value.toUpperCase())
              }
            />
            <Input
              label="Currency symbol"
              value={core.currencySymbol}
              onChange={(value) => setCoreField("currencySymbol", value)}
            />
            <BooleanField
              label="Featured"
              checked={core.isFeatured}
              onChange={(value) => setCoreField("isFeatured", value)}
            />
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            <MediaPickerDialog
              label="Flag image"
              value={core.flagMediaId}
              media={media}
              onChange={(value) => setCoreField("flagMediaId", value)}
            />
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
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
                  await createSubject({ name, slug: slugify(name) })
                ).data;
                setSubjects((rows) => [...rows, created]);
                return { kind: "created", id: created.id, label: created.name };
              }}
            />
            <CountryTaxonomyPicker
              title="Tags"
              singular="Tag"
              testId="country-tags"
              rows={tags.map((row) => ({ id: row.id, label: row.name }))}
              selected={tagIds}
              onChange={setTagIds}
              onCreate={async (name): Promise<CreateOutcome> => {
                const created = (
                  await createCountryTag({ name, slug: slugify(name) })
                ).data;
                setTags((rows) => [...rows, created]);
                // The API returns the existing active tag rather than a
                // duplicate, so a matching id means it was already there.
                const existed = tags.some((row) => row.id === created.id);
                return {
                  kind: existed ? "existing" : "created",
                  id: created.id,
                  label: created.name,
                };
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
              options={featureOptions.map(([value, label]) => ({
                value,
                label,
              }))}
              selected={configuration.featureCodes}
              onToggle={(value) => toggleConfiguration("featureCodes", value)}
            />
            <CheckboxGroup
              title="Accepted English tests"
              options={testOptions.map((value) => ({ value, label: value }))}
              selected={configuration.acceptedTests}
              onToggle={(value) => toggleConfiguration("acceptedTests", value)}
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
        {record ? <CountryProfilesEditor countryId={record.id} /> : <section className="rounded-2xl border border-dashed border-[#D9E0EA] p-6 text-sm text-[#667085]">Save this Country first to edit its detailed profiles and intakes.</section>}
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
                    <Input
                      label="Answer"
                      value={row.answer}
                      onChange={(value) => updateFaq(index, { answer: value })}
                      textarea
                      span
                      rows={4}
                    />
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
                    <Input
                      label="Short description"
                      value={row.shortDescription}
                      onChange={(value) =>
                        updateCard(index, { shortDescription: value })
                      }
                      textarea
                      span
                    />
                    <Input
                      label="Overview"
                      value={row.overview}
                      onChange={(value) =>
                        updateCard(index, { overview: value })
                      }
                      textarea
                      span
                    />
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
  span?: boolean;
  rows?: number;
}) {
  const id = `country-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={`text-sm font-semibold ${span ? "sm:col-span-2" : ""}`}>
      <FieldLabel label={label} htmlFor={id} />
      {textarea ? (
        <textarea
          id={id}
          rows={rows}
          className={input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          type={type}
          className={input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
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
  const id = `country-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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
}: {
  title: string;
  options: Array<{ value: string | number; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
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
  onChange,
  onRemove,
}: {
  index: number;
  row: SectionRow;
  media: EditorialMedia[];
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
        <Select
          label="Section key"
          value={row.sectionKey}
          onChange={(value) =>
            onChange({ sectionKey: value as SectionRow["sectionKey"] })
          }
          options={SECTION_KEYS.map((id) => ({ id, label: id }))}
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
        <Input
          label="Subheading"
          value={row.subheading}
          onChange={(value) => onChange({ subheading: value })}
          textarea
          span
        />
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
          type={row.sectionType}
          value={row.body}
          onChange={(body) => onChange({ body })}
          variables={variablesForContext("country")}
        />
      </div>
    </div>
  );
}
