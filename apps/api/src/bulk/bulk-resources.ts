import { COUNTRY_STATUSES, slugify } from '../catalog/catalog.constants';
import type { PrismaService } from '../prisma/prisma.service';
import {
  boolOrUndefined,
  CLEAR_TOKEN,
  COUNTRY_SECTION_KEYS,
  intOrNull,
  parseCountryRelations,
  reconcileCountry,
  resolveCountryMedia,
  textOrNull,
  type CountryRelations,
  type SectionColumn,
} from './country-bulk';

export type BulkRow = Record<string, string>;
export type BulkField = {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'boolean' | 'number' | 'date' | 'status' | 'relation';
  description?: string;
  /** A closed set enforced by imports and offered by XLSX templates. */
  allowedValues?: readonly string[];
};
export type BulkParseResult =
  | {
      data: Record<string, unknown>;
      /** Resolved non-scalar payload handed to `reconcile`; never written to
       * the record itself. */
      relations?: unknown;
      errors?: undefined;
    }
  | { data?: undefined; relations?: undefined; errors: string[] };

export interface BulkResourceDefinition {
  key: string;
  label: string;
  /** Prisma delegate name for this resource, used generically by the service. */
  model:
    | 'country'
    | 'state'
    | 'city'
    | 'subject'
    | 'course'
    | 'job'
    | 'event'
    | 'university'
    | 'universityCampus'
    | 'universityCourseOffering'
    | 'scholarship'
    | 'consultant'
    | 'consultantLocation';
  /** Column used to match an existing row for upsert/export identity. */
  uniqueColumn: 'slug';
  columns: string[];
  /** The presentation contract powers templates, header validation and export.
   * `columns` remains the legacy/parser representation for backwards-compatible CSV imports. */
  fields?: BulkField[];
  /** Resource-specific values for the shared Status field. */
  statusAllowedValues?: readonly string[];
  requiredColumns: string[];
  exampleRow: BulkRow;
  /** Update-mode-only editable columns (excludes identity/relation columns
   * that bulk *update* should never silently move a record between, even
   * though CSV *import* create mode does resolve them). */
  updatableColumns: string[];
  parseRow(row: BulkRow, prisma: PrismaService): Promise<BulkParseResult>;
  /** Applies relations and profiles for one row inside that row's own
   * transaction, so scalars and relations succeed or fail together. */
  reconcile?(tx: unknown, id: string, relations: unknown): Promise<void>;
  toExportRow(record: Record<string, unknown>): Record<string, unknown>;
  /** Returns a human-readable reason the row can't be archived (e.g. "3
   * cities still reference this state"), or null if it's safe to archive. */
  dependencyCheck?(id: string, prisma: PrismaService): Promise<string | null>;
}

const relationLabels: Record<string, string> = {
  continentSlug: 'Continent',
  countrySlug: 'Country',
  stateSlug: 'State / province',
  subjectSlug: 'Subject',
  courseLevelCode: 'Course level',
  universitySlug: 'University',
  genericCourseSlug: 'Generic course',
  campusSlug: 'Campus',
  providerSlug: 'Scholarship provider',
};

const PUBLISH_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
const ACTIVE_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export function bulkFields(definition: BulkResourceDefinition): BulkField[] {
  const fields: BulkField[] =
    definition.fields ??
    definition.columns
      .filter((key) => key !== 'slug' && !key.endsWith('Id'))
      .map((key) => ({
        key,
        label:
          relationLabels[key] ??
          key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (value) => value.toUpperCase()),
        required: definition.requiredColumns.includes(key),
        type:
          key.endsWith('Slug') || key.endsWith('Code')
            ? 'relation'
            : key.startsWith('is')
              ? 'boolean'
              : key.includes('Order')
                ? 'number'
                : key.includes('Date') || key.includes('At')
                  ? 'date'
                  : key === 'status'
                    ? 'status'
                    : 'text',
      }));
  return fields.map((field) =>
    field.key === 'status' && !field.allowedValues
      ? { ...field, allowedValues: definition.statusAllowedValues }
      : field,
  );
}

/** Validates any field-level constrained value for CSV and XLSX alike. */
export function bulkFieldValueErrors(
  definition: BulkResourceDefinition,
  row: BulkRow,
): string[] {
  return bulkFields(definition).flatMap((field) => {
    const value = row[field.key]?.trim();
    if (!value || !field.allowedValues?.length) return [];
    if (field.allowedValues.includes(value)) return [];
    return [
      `${field.label} "${value}" is invalid. Allowed values: ${field.allowedValues.join(', ')}.`,
    ];
  });
}

function slugOrFallback(row: BulkRow, fallbackSource: string) {
  return row.slug?.trim() || slugify(fallbackSource);
}

const countries: BulkResourceDefinition = {
  key: 'countries',
  label: 'Countries',
  model: 'country',
  uniqueColumn: 'slug',
  columns: [
    'uid',
    'slug',
    'title',
    'status',
    'excerpt',
    'content',
    'featured_image',
    'iso_code',
    'iso3_code',
    'capital',
    'currency',
    'language',
    'tagline',
    'tuition_min',
    'tuition_max',
    'tuition_currency',
    'living_min',
    'living_max',
    'application_fee',
    'intakes',
    'visa_type',
    'visa_fee',
    'visa_processing',
    'post_study_work',
    'work_hours',
    'ielts_min',
    'universities_count',
    'intl_students',
    'why_study',
    'admission_process',
    'cost_breakdown',
    'visa_process',
    'flag_image',
    'hero_image',
    'featured',
    'rank_order',
    'faqs',
    'continent',
    'subject',
    'tag',
  ],
  /* Declared explicitly rather than derived, so the exported header row is
   * literally the client's column contract -- and so `slug` survives export,
   * which the derived path strips. */
  fields: [
    {
      key: 'uid',
      label: 'uid',
      required: false,
      type: 'text',
      description:
        'Stable client identifier; matched before slug on re-import.',
    },
    { key: 'slug', label: 'slug', required: false, type: 'text' },
    { key: 'title', label: 'title', required: true, type: 'text' },
    {
      key: 'status',
      label: 'status',
      required: false,
      type: 'status',
      allowedValues: COUNTRY_STATUSES,
    },
    { key: 'excerpt', label: 'excerpt', required: false, type: 'text' },
    { key: 'content', label: 'content', required: false, type: 'text' },
    {
      key: 'featured_image',
      label: 'featured_image',
      required: false,
      type: 'text',
      description: 'Existing media asset id or public URL.',
    },
    { key: 'iso_code', label: 'iso_code', required: false, type: 'text' },
    { key: 'iso3_code', label: 'iso3_code', required: false, type: 'text' },
    { key: 'capital', label: 'capital', required: false, type: 'text' },
    { key: 'currency', label: 'currency', required: false, type: 'text' },
    { key: 'language', label: 'language', required: false, type: 'text' },
    { key: 'tagline', label: 'tagline', required: false, type: 'text' },
    {
      key: 'tuition_min',
      label: 'tuition_min',
      required: false,
      type: 'number',
    },
    {
      key: 'tuition_max',
      label: 'tuition_max',
      required: false,
      type: 'number',
    },
    {
      key: 'tuition_currency',
      label: 'tuition_currency',
      required: false,
      type: 'text',
    },
    { key: 'living_min', label: 'living_min', required: false, type: 'number' },
    { key: 'living_max', label: 'living_max', required: false, type: 'number' },
    {
      key: 'application_fee',
      label: 'application_fee',
      required: false,
      type: 'text',
      description: 'A single fee ("60") or a range ("60-120").',
    },
    {
      key: 'intakes',
      label: 'intakes',
      required: false,
      type: 'relation',
      description: 'Pipe-separated intake names.',
    },
    { key: 'visa_type', label: 'visa_type', required: false, type: 'text' },
    {
      key: 'visa_fee',
      label: 'visa_fee',
      required: false,
      // Text, because the cell carries a currency as well: "185" or "USD 185".
      type: 'text',
      description: 'Amount, optionally prefixed with a currency: "USD 185".',
    },
    {
      key: 'visa_processing',
      label: 'visa_processing',
      required: false,
      type: 'text',
    },
    {
      key: 'post_study_work',
      label: 'post_study_work',
      required: false,
      type: 'number',
    },
    { key: 'work_hours', label: 'work_hours', required: false, type: 'number' },
    { key: 'ielts_min', label: 'ielts_min', required: false, type: 'number' },
    {
      key: 'universities_count',
      label: 'universities_count',
      required: false,
      type: 'number',
    },
    {
      key: 'intl_students',
      label: 'intl_students',
      required: false,
      type: 'number',
    },
    { key: 'why_study', label: 'why_study', required: false, type: 'text' },
    {
      key: 'admission_process',
      label: 'admission_process',
      required: false,
      type: 'text',
    },
    {
      key: 'cost_breakdown',
      label: 'cost_breakdown',
      required: false,
      type: 'text',
    },
    {
      key: 'visa_process',
      label: 'visa_process',
      required: false,
      type: 'text',
    },
    { key: 'flag_image', label: 'flag_image', required: false, type: 'text' },
    { key: 'hero_image', label: 'hero_image', required: false, type: 'text' },
    { key: 'featured', label: 'featured', required: false, type: 'boolean' },
    { key: 'rank_order', label: 'rank_order', required: false, type: 'number' },
    {
      key: 'faqs',
      label: 'faqs',
      required: false,
      type: 'text',
      description:
        'JSON array of {question, answer, category, isFeatured, displayOrder}.',
    },
    { key: 'continent', label: 'continent', required: true, type: 'relation' },
    {
      key: 'subject',
      label: 'subject',
      required: false,
      type: 'relation',
      description: `Pipe-separated Subjects; "${CLEAR_TOKEN}" removes all.`,
    },
    {
      key: 'tag',
      label: 'tag',
      required: false,
      type: 'relation',
      description: `Pipe-separated Tags; "${CLEAR_TOKEN}" removes all.`,
    },
  ],
  statusAllowedValues: COUNTRY_STATUSES,
  requiredColumns: ['title', 'continent'],
  exampleRow: {
    uid: 'demo-country-001',
    slug: '',
    title: 'Demo Country',
    status: 'DRAFT',
    excerpt: 'A fictional demo country used only to show the expected shape.',
    content: 'Longer editorial overview for the country page.',
    featured_image: '',
    iso_code: '',
    iso3_code: '',
    capital: 'Demo City',
    currency: 'DMC',
    language: 'English',
    tagline: 'A fictional destination for import testing.',
    tuition_min: '9000',
    tuition_max: '15000',
    tuition_currency: 'EUR',
    living_min: '700',
    living_max: '1100',
    application_fee: '60-120',
    intakes: 'September | January',
    visa_type: 'Student residence permit',
    visa_fee: 'USD 85',
    visa_processing: '4 to 6 weeks',
    post_study_work: '24',
    work_hours: '20',
    ielts_min: '6.5',
    universities_count: '',
    intl_students: '',
    why_study: 'Why students choose this destination.',
    admission_process: 'How applications are assessed.',
    cost_breakdown: 'What a year costs in practice.',
    visa_process: 'How the study visa is applied for.',
    flag_image: '',
    hero_image: '',
    featured: 'false',
    rank_order: '0',
    faqs: '[{"question":"Can I work while studying?","answer":"Yes, within the permitted hours."}]',
    continent: 'asia',
    subject: 'Engineering | Nursing',
    tag: 'featured | english-speaking',
  },
  updatableColumns: [
    'title',
    'status',
    'excerpt',
    'content',
    'iso_code',
    'iso3_code',
    'capital',
    'currency',
    'language',
    'tagline',
    'featured',
    'rank_order',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    const title = (row.title ?? '').trim();
    if (!title) errors.push('title is required');

    const continentTerm = (row.continent ?? '').trim();
    const continent = continentTerm
      ? await prisma.continent.findFirst({
          where: {
            deletedAt: null,
            OR: [{ slug: slugify(continentTerm) }, { name: continentTerm }],
          },
        })
      : null;
    if (continentTerm && !continent)
      errors.push(`continent "${continentTerm}" was not found`);
    if (!continentTerm) errors.push('continent is required');

    const relations = await parseCountryRelations(row, prisma, errors);
    const media = await resolveCountryMedia(row, prisma, errors);
    if (errors.length) return { errors };

    const slug = (row.slug ?? '').trim() || slugify(title);
    const excerpt = (row.excerpt ?? '').trim();
    return {
      data: {
        slug,
        name: title,
        continentId: continent!.id,
        // The public page heading is not part of the client contract, so it
        // is derived once on create rather than blanked on every import.
        pageHeading: (row.pageHeading ?? '').trim() || `Study in ${title}`,
        shortDescription: excerpt || `Study in ${title}.`,
        overview: textOrNull(row.content),
        externalUid: textOrNull(row.uid),
        iso2Code: textOrNull(row.iso_code)?.toUpperCase(),
        iso3Code: textOrNull(row.iso3_code)?.toUpperCase(),
        capitalCity: textOrNull(row.capital),
        officialLanguage: textOrNull(row.language),
        tagline: textOrNull(row.tagline),
        // Currency arrives as a single client column; the code is the
        // canonical field and the name/symbol are left untouched rather than
        // blanked by an import that does not carry them.
        currencyCode: textOrNull(row.currency)?.toUpperCase(),
        isFeatured: boolOrUndefined(row.featured),
        displayOrder: intOrNull(row.rank_order) ?? undefined,
        status: (row.status ?? '').trim() || 'DRAFT',
        ...media,
      },
      relations,
    };
  },
  async reconcile(tx, id, relations) {
    await reconcileCountry(
      tx as Parameters<typeof reconcileCountry>[0],
      id,
      relations as CountryRelations,
    );
  },
  toExportRow(record) {
    return exportCountryRow(record);
  },
};

/** Reads the section body back out of the stored typed-body shape. */
/** The canonical `visa_fee` representation: currency and amount when both are
 * stored, the amount alone otherwise. `parseVisaFee` reads both back. */
function visaFeeText(fee: unknown, currency: unknown): string {
  const amount = decimalText(fee);
  if (!amount) return '';
  const code = typeof currency === 'string' ? currency.trim() : '';
  return code ? `${code} ${amount}` : amount;
}

function sectionText(
  record: Record<string, unknown>,
  column: SectionColumn,
): string {
  const sections = (record.contentSections ?? []) as Array<{
    sectionKey: string;
    bodyJson?: unknown;
  }>;
  const match = sections.find(
    (row) => row.sectionKey === COUNTRY_SECTION_KEYS[column],
  );
  if (!match) return '';
  const body = match.bodyJson as { paragraphs?: unknown } | null;
  const paragraphs = Array.isArray(body?.paragraphs) ? body.paragraphs : [];
  return paragraphs.filter((line) => typeof line === 'string').join('\n\n');
}

function decimalText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return (value as { toString: () => string }).toString();
  // Prisma decimals arrive as objects carrying their own toString.
  if (
    typeof value === 'object' &&
    'toString' in value &&
    typeof value.toString === 'function'
  )
    return (value as { toString: () => string }).toString();
  return '';
}

export function exportCountryRow(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const rel = record as {
    continent?: { slug?: string };
    subjectMaps?: Array<{ subject?: { name?: string; slug?: string } }>;
    tagMaps?: Array<{ tag?: { name?: string; slug?: string } }>;
    intakes?: Array<{ intake?: { name?: string } }>;
    faqs?: Array<{
      question: string;
      answer: string;
      category: string | null;
      isFeatured: boolean;
      displayOrder: number;
    }>;
    costProfile?: Record<string, unknown> | null;
    workProfile?: Record<string, unknown> | null;
    languageRequirements?: Record<string, unknown> | null;
    statistics?: Record<string, unknown> | null;
    listingMedia?: { publicUrl?: string } | null;
    flagMedia?: { publicUrl?: string } | null;
    heroMedia?: { publicUrl?: string } | null;
  };
  const cost = rel.costProfile ?? {};
  const work = rel.workProfile ?? {};
  const language = rel.languageRequirements ?? {};
  const statistics = rel.statistics ?? {};
  const feeMin = decimalText(cost.applicationFeeMin);
  const feeMax = decimalText(cost.applicationFeeMax);
  return {
    uid: record.externalUid ?? '',
    slug: record.slug,
    title: record.name,
    status: record.status,
    excerpt: record.shortDescription,
    content: record.overview ?? '',
    featured_image: rel.listingMedia?.publicUrl ?? '',
    iso_code: record.iso2Code ?? '',
    iso3_code: record.iso3Code ?? '',
    capital: record.capitalCity ?? '',
    currency: record.currencyCode ?? '',
    language: record.officialLanguage ?? '',
    tagline: record.tagline ?? '',
    tuition_min: decimalText(cost.tuitionMin),
    tuition_max: decimalText(cost.tuitionMax),
    tuition_currency: cost.currencyCode ?? '',
    living_min: decimalText(cost.livingCostMin),
    living_max: decimalText(cost.livingCostMax),
    // A single stored value round-trips as one number; a genuine range is
    // written as `min-max` rather than silently losing the maximum.
    application_fee:
      feeMin && feeMax && feeMin !== feeMax
        ? `${feeMin}-${feeMax}`
        : feeMin || feeMax,
    intakes: (rel.intakes ?? [])
      .map((row) => row.intake?.name ?? '')
      .filter(Boolean)
      .join(' | '),
    visa_type: work.visaType ?? '',
    // One client column carries both stored values: "USD 185" when a currency
    // is known, the bare amount when none is, rather than inventing one.
    visa_fee: visaFeeText(work.visaFee, work.visaFeeCurrencyCode),
    visa_processing: work.visaProcessingTime ?? '',
    post_study_work: decimalText(work.postStudyWorkMaxMonths),
    work_hours: decimalText(work.partTimeHoursPerWeek),
    ielts_min: decimalText(language.ieltsMinScore),
    universities_count: decimalText(statistics.universitiesCount),
    intl_students: decimalText(statistics.internationalStudentsCount),
    why_study: sectionText(record, 'why_study'),
    admission_process: sectionText(record, 'admission_process'),
    cost_breakdown: sectionText(record, 'cost_breakdown'),
    visa_process: sectionText(record, 'visa_process'),
    flag_image: rel.flagMedia?.publicUrl ?? '',
    hero_image: rel.heroMedia?.publicUrl ?? '',
    featured: record.isFeatured ? 'true' : 'false',
    rank_order: decimalText(record.displayOrder ?? 0),
    faqs: (rel.faqs ?? []).length
      ? JSON.stringify(
          [...(rel.faqs ?? [])]
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((faq) => ({
              question: faq.question,
              answer: faq.answer,
              category: faq.category,
              isFeatured: faq.isFeatured,
              displayOrder: faq.displayOrder,
            })),
        )
      : '',
    continent: rel.continent?.slug ?? '',
    // Slugs, so an export re-imports without depending on display names.
    subject: (rel.subjectMaps ?? [])
      .map((row) => row.subject?.slug ?? '')
      .filter(Boolean)
      .join(' | '),
    tag: (rel.tagMaps ?? [])
      .map((row) => row.tag?.slug ?? '')
      .filter(Boolean)
      .join(' | '),
  };
}

const states: BulkResourceDefinition = {
  key: 'states',
  label: 'States / provinces',
  model: 'state',
  uniqueColumn: 'slug',
  columns: ['slug', 'name', 'countrySlug', 'status', 'displayOrder'],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name', 'countrySlug'],
  exampleRow: {
    slug: '',
    name: 'Demo Province',
    countrySlug: 'demo-country',
    status: 'DRAFT',
    displayOrder: '0',
  },
  updatableColumns: ['name', 'status', 'displayOrder'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const country = row.countrySlug?.trim()
      ? await prisma.country.findFirst({
          where: { slug: row.countrySlug.trim(), deletedAt: null },
        })
      : null;
    if (!country) errors.push(`countrySlug "${row.countrySlug}" was not found`);
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        countryId: country!.id,
        status: row.status?.trim() || 'DRAFT',
        displayOrder: Number(row.displayOrder) || 0,
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      countrySlug:
        (record as { country?: { slug?: string } }).country?.slug ?? '',
      status: record.status,
      displayOrder: record.displayOrder,
    };
  },
  async dependencyCheck(id, prisma) {
    const count = await prisma.city.count({
      where: { stateId: id, deletedAt: null },
    });
    return count > 0
      ? `${count} cit${count === 1 ? 'y' : 'ies'} still reference this state`
      : null;
  },
};

const cities: BulkResourceDefinition = {
  key: 'cities',
  label: 'Cities',
  model: 'city',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'countrySlug',
    'stateSlug',
    'shortDescription',
    'isFeatured',
    'status',
    'displayOrder',
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name', 'countrySlug'],
  exampleRow: {
    slug: '',
    name: 'Demo City',
    countrySlug: 'demo-country',
    stateSlug: '',
    shortDescription:
      'A fictional demo city used only to show the expected import shape.',
    isFeatured: 'false',
    status: 'DRAFT',
    displayOrder: '0',
  },
  updatableColumns: [
    'name',
    'shortDescription',
    'isFeatured',
    'status',
    'displayOrder',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const country = row.countrySlug?.trim()
      ? await prisma.country.findFirst({
          where: { slug: row.countrySlug.trim(), deletedAt: null },
        })
      : null;
    if (!country) errors.push(`countrySlug "${row.countrySlug}" was not found`);
    let stateId: string | null = null;
    if (row.stateSlug?.trim() && country) {
      const state = await prisma.state.findFirst({
        where: {
          slug: row.stateSlug.trim(),
          countryId: country.id,
          deletedAt: null,
        },
      });
      if (!state)
        errors.push(
          `stateSlug "${row.stateSlug}" was not found for this country`,
        );
      else stateId = state.id;
    }
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        countryId: country!.id,
        stateId,
        shortDescription: row.shortDescription?.trim() || null,
        isFeatured: row.isFeatured?.trim().toLowerCase() === 'true',
        status: row.status?.trim() || 'DRAFT',
        displayOrder: Number(row.displayOrder) || 0,
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      countrySlug:
        (record as { country?: { slug?: string } }).country?.slug ?? '',
      stateSlug:
        (record as { state?: { slug?: string } | null }).state?.slug ?? '',
      shortDescription: record.shortDescription ?? '',
      isFeatured: record.isFeatured,
      status: record.status,
      displayOrder: record.displayOrder,
    };
  },
};

const subjects: BulkResourceDefinition = {
  key: 'subjects',
  label: 'Subjects',
  model: 'subject',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'shortDescription',
    'isFeatured',
    'status',
    'displayOrder',
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name'],
  exampleRow: {
    slug: '',
    name: 'Demo Subject',
    shortDescription:
      'A fictional demo subject used only to show the expected import shape.',
    isFeatured: 'false',
    status: 'DRAFT',
    displayOrder: '0',
  },
  updatableColumns: [
    'name',
    'shortDescription',
    'isFeatured',
    'status',
    'displayOrder',
  ],
  async parseRow(row) {
    if (!row.name?.trim()) return { errors: ['name is required'] };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        shortDescription: row.shortDescription?.trim() || null,
        isFeatured: row.isFeatured?.trim().toLowerCase() === 'true',
        status: row.status?.trim() || 'DRAFT',
        displayOrder: Number(row.displayOrder) || 0,
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      shortDescription: record.shortDescription ?? '',
      isFeatured: record.isFeatured,
      status: record.status,
      displayOrder: record.displayOrder,
    };
  },
};

const courses: BulkResourceDefinition = {
  key: 'courses',
  label: 'Generic courses',
  model: 'course',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'subjectSlug',
    'courseLevelCode',
    'shortDescription',
    'isFeatured',
    'status',
  ],
  fields: [
    { key: 'name', label: 'Course Name', required: true, type: 'text' },
    { key: 'subjectSlug', label: 'Subject', required: true, type: 'relation' },
    {
      key: 'courseLevelCode',
      label: 'Course Level',
      required: true,
      type: 'relation',
    },
    {
      key: 'shortDescription',
      label: 'Short Description',
      required: false,
      type: 'text',
    },
    { key: 'isFeatured', label: 'Featured', required: false, type: 'boolean' },
    { key: 'status', label: 'Status', required: false, type: 'status' },
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name', 'subjectSlug', 'courseLevelCode'],
  exampleRow: {
    slug: '',
    name: 'Demo Course',
    subjectSlug: 'demo-subject',
    courseLevelCode: 'UG',
    shortDescription:
      'A fictional demo course used only to show the expected import shape.',
    isFeatured: 'false',
    status: 'DRAFT',
  },
  updatableColumns: ['name', 'shortDescription', 'isFeatured', 'status'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const subject = row.__subjectId
      ? { id: row.__subjectId }
      : row.subjectSlug?.trim()
        ? await prisma.subject.findFirst({
            where: { slug: row.subjectSlug.trim(), deletedAt: null },
          })
        : null;
    if (!subject) errors.push(`subjectSlug "${row.subjectSlug}" was not found`);
    const courseLevel = row.__courseLevelId
      ? { id: row.__courseLevelId }
      : row.courseLevelCode?.trim()
        ? await prisma.courseLevel.findFirst({
            where: { code: row.courseLevelCode.trim() },
          })
        : null;
    if (!courseLevel)
      errors.push(`courseLevelCode "${row.courseLevelCode}" was not found`);
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        subjectId: subject!.id,
        courseLevelId: courseLevel!.id,
        shortDescription: row.shortDescription?.trim() || null,
        isFeatured: row.isFeatured?.trim().toLowerCase() === 'true',
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      subjectSlug:
        (record as { subject?: { slug?: string } }).subject?.slug ?? '',
      courseLevelCode:
        (record as { courseLevel?: { code?: string } }).courseLevel?.code ?? '',
      shortDescription: record.shortDescription ?? '',
      isFeatured: record.isFeatured,
      status: record.status,
    };
  },
};

const jobs: BulkResourceDefinition = {
  key: 'jobs',
  label: 'Careers / jobs',
  model: 'job',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'title',
    'department',
    'employmentType',
    'location',
    'remoteStatus',
    'summary',
    'status',
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['title'],
  exampleRow: {
    slug: '',
    title: 'Demo Role',
    department: 'Operations',
    employmentType: 'FULL_TIME',
    location: 'Remote',
    remoteStatus: 'REMOTE',
    summary:
      'A fictional demo role used only to show the expected import shape.',
    status: 'DRAFT',
  },
  updatableColumns: [
    'title',
    'department',
    'employmentType',
    'location',
    'remoteStatus',
    'summary',
    'status',
  ],
  async parseRow(row) {
    if (!row.title?.trim()) return { errors: ['title is required'] };
    return {
      data: {
        slug: slugOrFallback(row, row.title),
        title: row.title.trim(),
        department: row.department?.trim() || null,
        employmentType: row.employmentType?.trim() || null,
        location: row.location?.trim() || null,
        remoteStatus: row.remoteStatus?.trim() || null,
        summary: row.summary?.trim() || null,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      title: record.title,
      department: record.department ?? '',
      employmentType: record.employmentType ?? '',
      location: record.location ?? '',
      remoteStatus: record.remoteStatus ?? '',
      summary: record.summary ?? '',
      status: record.status,
    };
  },
};

const events: BulkResourceDefinition = {
  key: 'events',
  label: 'Events',
  model: 'event',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'title',
    'startsAt',
    'endsAt',
    'eventType',
    'venue',
    'onlineUrl',
    'summary',
    'status',
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['title', 'startsAt'],
  exampleRow: {
    slug: '',
    title: 'Demo Info Session',
    startsAt: '2026-09-01T10:00:00.000Z',
    endsAt: '',
    eventType: 'ONLINE',
    venue: '',
    onlineUrl: 'https://example.com/demo-session',
    summary:
      'A fictional demo event used only to show the expected import shape.',
    status: 'DRAFT',
  },
  updatableColumns: [
    'title',
    'endsAt',
    'eventType',
    'venue',
    'onlineUrl',
    'summary',
    'status',
  ],
  async parseRow(row) {
    const errors: string[] = [];
    if (!row.title?.trim()) errors.push('title is required');
    const startsAt = row.startsAt?.trim()
      ? new Date(row.startsAt.trim())
      : null;
    if (!startsAt || Number.isNaN(startsAt.valueOf()))
      errors.push('startsAt must be a valid ISO date');
    const endsAt = row.endsAt?.trim() ? new Date(row.endsAt.trim()) : null;
    if (row.endsAt?.trim() && (!endsAt || Number.isNaN(endsAt.valueOf())))
      errors.push('endsAt must be a valid ISO date');
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.title),
        title: row.title.trim(),
        startsAt: startsAt!,
        endsAt: endsAt ?? null,
        eventType: row.eventType?.trim() || 'OFFLINE',
        venue: row.venue?.trim() || null,
        onlineUrl: row.onlineUrl?.trim() || null,
        summary: row.summary?.trim() || null,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      title: record.title,
      startsAt: (record.startsAt as Date)?.toISOString?.() ?? '',
      endsAt: (record.endsAt as Date | null)?.toISOString?.() ?? '',
      eventType: record.eventType,
      venue: record.venue ?? '',
      onlineUrl: record.onlineUrl ?? '',
      summary: record.summary ?? '',
      status: record.status,
    };
  },
};

const universities: BulkResourceDefinition = {
  key: 'universities',
  label: 'Universities',
  model: 'university',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'countrySlug',
    'institutionType',
    'shortDescription',
    'status',
  ],
  fields: [
    { key: 'name', label: 'University Name', required: true, type: 'text' },
    { key: 'countrySlug', label: 'Country', required: true, type: 'relation' },
    {
      key: 'institutionType',
      label: 'Institution Type',
      required: false,
      type: 'text',
    },
    {
      key: 'shortDescription',
      label: 'Short Description',
      required: true,
      type: 'text',
    },
    { key: 'status', label: 'Status', required: false, type: 'status' },
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name', 'countrySlug', 'shortDescription'],
  exampleRow: {
    slug: '',
    name: 'Demo University',
    countrySlug: 'canada',
    institutionType: 'PUBLIC',
    shortDescription:
      'A fictional demo university used only to show the expected import shape.',
    status: 'DRAFT',
  },
  updatableColumns: ['name', 'institutionType', 'shortDescription', 'status'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    if (!row.shortDescription?.trim())
      errors.push('shortDescription is required');
    const country = row.__countryId
      ? { id: row.__countryId }
      : row.countrySlug?.trim()
        ? await prisma.country.findFirst({
            where: { slug: row.countrySlug.trim(), deletedAt: null },
          })
        : null;
    if (!country) errors.push(`countrySlug "${row.countrySlug}" was not found`);
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        countryId: country!.id,
        institutionType: row.institutionType?.trim() || null,
        shortDescription: row.shortDescription.trim(),
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      countrySlug:
        (record as { country?: { slug?: string } }).country?.slug ?? '',
      institutionType: record.institutionType ?? '',
      shortDescription: record.shortDescription ?? '',
      status: record.status,
    };
  },
  async dependencyCheck(id, prisma) {
    const [campuses, offerings] = await Promise.all([
      prisma.universityCampus.count({
        where: { universityId: id, deletedAt: null },
      }),
      prisma.universityCourseOffering.count({
        where: { universityId: id, deletedAt: null },
      }),
    ]);
    if (campuses || offerings)
      return `${campuses} campus(es) and ${offerings} course offering(s) still belong to this university`;
    return null;
  },
};

/** UniversityCampus.slug is only unique per-university in the schema
 * (`@@unique([universityId, slug])`), but this bulk engine's identity
 * lookup is a flat global slug match (see BulkOperationsService#import).
 * A blank slug is therefore always generated with the university's own
 * slug as a prefix so two different universities' campuses can never
 * collide; an admin who supplies an explicit slug is responsible for
 * keeping it globally unique for bulk-import purposes. */
const campuses: BulkResourceDefinition = {
  key: 'campuses',
  label: 'University campuses',
  model: 'universityCampus',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'universitySlug',
    'city',
    'state',
    'address',
    'status',
  ],
  statusAllowedValues: ACTIVE_STATUSES,
  requiredColumns: ['name', 'universitySlug', 'city'],
  exampleRow: {
    slug: '',
    name: 'Main Campus',
    universitySlug: 'demo-university',
    city: 'Toronto',
    state: 'Ontario',
    address: '',
    status: 'ACTIVE',
  },
  updatableColumns: ['name', 'city', 'state', 'address', 'status'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    if (!row.city?.trim()) errors.push('city is required');
    const university = row.universitySlug?.trim()
      ? await prisma.university.findFirst({
          where: { slug: row.universitySlug.trim(), deletedAt: null },
        })
      : null;
    if (!university)
      errors.push(`universitySlug "${row.universitySlug}" was not found`);
    if (errors.length) return { errors };
    const slug = row.slug?.trim() || `${university!.slug}-${slugify(row.name)}`;
    return {
      data: {
        slug,
        name: row.name.trim(),
        universityId: university!.id,
        city: row.city.trim(),
        state: row.state?.trim() || null,
        address: row.address?.trim() || null,
        status: row.status?.trim() || 'ACTIVE',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      universitySlug:
        (record as { university?: { slug?: string } }).university?.slug ?? '',
      city: record.city ?? '',
      state: record.state ?? '',
      address: record.address ?? '',
      status: record.status,
    };
  },
  async dependencyCheck(id, prisma) {
    const offerings = await prisma.universityCourseOffering.count({
      where: { campusId: id, deletedAt: null },
    });
    if (offerings)
      return `${offerings} course offering(s) still use this campus`;
    return null;
  },
};

const offerings: BulkResourceDefinition = {
  key: 'offerings',
  label: 'University course offerings',
  model: 'universityCourseOffering',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'universitySlug',
    'genericCourseSlug',
    'campusSlug',
    'courseLevelCode',
    'studyMode',
    'currencyCode',
    'tuitionMin',
    'tuitionMax',
    'status',
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name', 'universitySlug', 'genericCourseSlug'],
  exampleRow: {
    slug: '',
    name: 'Bachelor of Demo Studies',
    universitySlug: 'demo-university',
    genericCourseSlug: 'demo-subject-course',
    campusSlug: '',
    courseLevelCode: 'UG',
    studyMode: 'FULL_TIME',
    currencyCode: 'CAD',
    tuitionMin: '18000',
    tuitionMax: '22000',
    status: 'DRAFT',
  },
  updatableColumns: [
    'name',
    'studyMode',
    'currencyCode',
    'tuitionMin',
    'tuitionMax',
    'status',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const university = row.universitySlug?.trim()
      ? await prisma.university.findFirst({
          where: { slug: row.universitySlug.trim(), deletedAt: null },
        })
      : null;
    if (!university)
      errors.push(`universitySlug "${row.universitySlug}" was not found`);
    const genericCourse = row.genericCourseSlug?.trim()
      ? await prisma.course.findFirst({
          where: { slug: row.genericCourseSlug.trim(), deletedAt: null },
        })
      : null;
    if (!genericCourse)
      errors.push(`genericCourseSlug "${row.genericCourseSlug}" was not found`);
    let campusId: string | null = null;
    if (row.campusSlug?.trim() && university) {
      const campus = await prisma.universityCampus.findFirst({
        where: {
          slug: row.campusSlug.trim(),
          universityId: university.id,
          deletedAt: null,
        },
      });
      if (!campus)
        errors.push(
          `campusSlug "${row.campusSlug}" was not found for this university`,
        );
      else campusId = campus.id;
    }
    let courseLevelId: string | null = null;
    if (row.courseLevelCode?.trim()) {
      const courseLevel = await prisma.courseLevel.findFirst({
        where: { code: row.courseLevelCode.trim() },
      });
      if (!courseLevel)
        errors.push(`courseLevelCode "${row.courseLevelCode}" was not found`);
      else courseLevelId = courseLevel.id;
    }
    const tuitionMin = row.tuitionMin?.trim() ? Number(row.tuitionMin) : null;
    if (row.tuitionMin?.trim() && Number.isNaN(tuitionMin))
      errors.push('tuitionMin must be a number');
    const tuitionMax = row.tuitionMax?.trim() ? Number(row.tuitionMax) : null;
    if (row.tuitionMax?.trim() && Number.isNaN(tuitionMax))
      errors.push('tuitionMax must be a number');
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        universityId: university!.id,
        genericCourseId: genericCourse!.id,
        campusId,
        courseLevelId,
        studyMode: row.studyMode?.trim() || null,
        currencyCode: row.currencyCode?.trim() || null,
        tuitionMin,
        tuitionMax,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      universitySlug:
        (record as { university?: { slug?: string } }).university?.slug ?? '',
      genericCourseSlug:
        (record as { genericCourse?: { slug?: string } }).genericCourse?.slug ??
        '',
      campusSlug: (record as { campus?: { slug?: string } }).campus?.slug ?? '',
      courseLevelCode:
        (record as { courseLevel?: { code?: string } }).courseLevel?.code ?? '',
      studyMode: record.studyMode ?? '',
      currencyCode: record.currencyCode ?? '',
      tuitionMin: record.tuitionMin ?? '',
      tuitionMax: record.tuitionMax ?? '',
      status: record.status,
    };
  },
};

const scholarships: BulkResourceDefinition = {
  key: 'scholarships',
  label: 'Scholarships',
  model: 'scholarship',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'title',
    'providerSlug',
    'summary',
    'benefitType',
    'amount',
    'currencyCode',
    'deadline',
    'status',
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['title'],
  exampleRow: {
    slug: '',
    title: 'Demo Merit Scholarship',
    providerSlug: '',
    summary:
      'A fictional demo scholarship used only to show the expected import shape.',
    benefitType: 'PARTIAL_TUITION',
    amount: '5000',
    currencyCode: 'USD',
    deadline: '',
    status: 'DRAFT',
  },
  updatableColumns: [
    'title',
    'summary',
    'benefitType',
    'amount',
    'currencyCode',
    'deadline',
    'status',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.title?.trim()) errors.push('title is required');
    let providerId: string | null = null;
    if (row.providerSlug?.trim()) {
      const provider = await prisma.scholarshipProvider.findFirst({
        where: { slug: row.providerSlug.trim(), deletedAt: null },
      });
      if (!provider)
        errors.push(`providerSlug "${row.providerSlug}" was not found`);
      else providerId = provider.id;
    }
    const amount = row.amount?.trim() ? Number(row.amount) : null;
    if (row.amount?.trim() && Number.isNaN(amount))
      errors.push('amount must be a number');
    const deadline = row.deadline?.trim()
      ? new Date(row.deadline.trim())
      : null;
    if (row.deadline?.trim() && (!deadline || Number.isNaN(deadline.valueOf())))
      errors.push('deadline must be a valid date');
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.title),
        title: row.title.trim(),
        providerId,
        summary: row.summary?.trim() || null,
        benefitType: row.benefitType?.trim() || null,
        amount,
        currencyCode: row.currencyCode?.trim() || null,
        deadline,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      title: record.title,
      providerSlug:
        (record as { provider?: { slug?: string } }).provider?.slug ?? '',
      summary: record.summary ?? '',
      benefitType: record.benefitType ?? '',
      amount: record.amount ?? '',
      currencyCode: record.currencyCode ?? '',
      deadline: (record.deadline as Date | null)?.toISOString?.() ?? '',
      status: record.status,
    };
  },
};

const consultants: BulkResourceDefinition = {
  key: 'consultants',
  label: 'Consultants',
  model: 'consultant',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'email',
    'phone',
    'websiteUrl',
    'verificationStatus',
    'shortDescription',
    'status',
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name'],
  exampleRow: {
    slug: '',
    name: 'Demo Consultancy',
    email: 'contact@example.com',
    phone: '',
    websiteUrl: 'https://example.com',
    verificationStatus: 'UNVERIFIED',
    shortDescription:
      'A fictional demo consultancy used only to show the expected import shape.',
    status: 'DRAFT',
  },
  updatableColumns: [
    'name',
    'email',
    'phone',
    'websiteUrl',
    'verificationStatus',
    'shortDescription',
    'status',
  ],
  async parseRow(row) {
    if (!row.name?.trim()) return { errors: ['name is required'] };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        websiteUrl: row.websiteUrl?.trim() || null,
        verificationStatus: row.verificationStatus?.trim() || 'UNVERIFIED',
        shortDescription: row.shortDescription?.trim() || null,
        status: row.status?.trim() || 'DRAFT',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      email: record.email ?? '',
      phone: record.phone ?? '',
      websiteUrl: record.websiteUrl ?? '',
      verificationStatus: record.verificationStatus,
      shortDescription: record.shortDescription ?? '',
      status: record.status,
    };
  },
};

const consultantLocations: BulkResourceDefinition = {
  key: 'consultant-locations',
  label: 'Consultant locations',
  model: 'consultantLocation',
  uniqueColumn: 'slug',
  columns: [
    'slug',
    'name',
    'city',
    'state',
    'countrySlug',
    'overview',
    'status',
  ],
  statusAllowedValues: ACTIVE_STATUSES,
  requiredColumns: ['name', 'city'],
  exampleRow: {
    slug: '',
    name: 'Demo City Branch',
    city: 'Toronto',
    state: 'Ontario',
    countrySlug: 'canada',
    overview: '',
    status: 'ACTIVE',
  },
  updatableColumns: ['name', 'city', 'state', 'overview', 'status'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    if (!row.city?.trim()) errors.push('city is required');
    let countryId: string | null = null;
    if (row.countrySlug?.trim()) {
      const country = await prisma.country.findFirst({
        where: { slug: row.countrySlug.trim(), deletedAt: null },
      });
      if (!country)
        errors.push(`countrySlug "${row.countrySlug}" was not found`);
      else countryId = country.id;
    }
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        city: row.city.trim(),
        state: row.state?.trim() || null,
        countryId,
        overview: row.overview?.trim() || null,
        status: row.status?.trim() || 'ACTIVE',
      },
    };
  },
  toExportRow(record) {
    return {
      slug: record.slug,
      name: record.name,
      city: record.city ?? '',
      state: record.state ?? '',
      countrySlug:
        (record as { country?: { slug?: string } }).country?.slug ?? '',
      overview: record.overview ?? '',
      status: record.status,
    };
  },
  async dependencyCheck(id, prisma) {
    const mapped = await prisma.consultantLocationMap.count({
      where: { locationId: id },
    });
    if (mapped)
      return `${mapped} consultant(s) are still linked to this location`;
    return null;
  },
};

/** All 13 resources named in the Phase 1 bulk-management scope are now
 * registered. The underlying engine (parse/dry-run/import/export/
 * bulk-update/bulk-archive, file security) is fully generic -- each entry
 * below is only a column/relation mapping, no engine code. Deliberately
 * out of scope for every resource, matching the existing seven: many-to-
 * many assignment (e.g. a scholarship's eligible countries/universities,
 * a consultant's services/languages/serviced countries) stays a
 * structured-editor-only concern, consistent with how `courses` here
 * already leaves its own many-to-many `countries` relation unmanaged by
 * bulk CSV. */
export const BULK_RESOURCES: Record<string, BulkResourceDefinition> = {
  countries,
  states,
  cities,
  subjects,
  courses,
  jobs,
  events,
  universities,
  campuses,
  offerings,
  scholarships,
  consultants,
  'consultant-locations': consultantLocations,
};

export function bulkResource(key: string): BulkResourceDefinition {
  const definition = BULK_RESOURCES[key];
  if (!definition) throw new Error(`Unknown bulk resource: ${key}`);
  return definition;
}
