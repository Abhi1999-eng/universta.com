import {
  COUNTRY_STATUSES,
  COURSE_DURATION_UNITS,
  slugify,
} from '../catalog/catalog.constants';
import type { PrismaService } from '../prisma/prisma.service';
import {
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
  /**
   * Whether this model holds a `deletedKey` that its unique indexes are part
   * of, so a soft-deleted row has to fill it to let the name, slug or code it
   * was using be used again.
   *
   * Only countries carry the column today. Archiving anything else leaves its
   * slug taken, which is a schema question rather than one this service can
   * answer, so nothing pretends otherwise here.
   */
  releasesUniqueKeys?: boolean;
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

type RefRecord = { id: string; slug: string };
type RefTable = {
  findFirst(args: { where: Record<string, unknown> }): Promise<unknown>;
  findMany(args: {
    where: Record<string, unknown>;
    take: number;
  }): Promise<unknown[]>;
};

/** Resolves a relation cell that may carry the record's slug (or code) or its
 * display name. Export writes names -- it is what an editor reads -- and a
 * hand-written file usually carries slugs, so both have to import, or an
 * exported file cannot be edited and uploaded again.
 *
 * The slug is tried first because it is unique. A name is accepted only when
 * it names exactly one record: course names repeat, and so do university
 * names across countries, and guessing between them would attach the row to
 * the wrong parent without a word. Returns `null` when nothing matches, and
 * `false` when the name is ambiguous, having said so in `errors`. */
async function findRef(
  table: unknown,
  term: string,
  column: string,
  errors: string[],
  scope: Record<string, unknown> = { deletedAt: null },
  key: 'slug' | 'code' = 'slug',
): Promise<RefRecord | null | false> {
  const lookup = table as RefTable;
  const value = term.trim();
  const exact = await lookup.findFirst({ where: { ...scope, [key]: value } });
  if (exact) return exact as RefRecord;
  const named = (await lookup.findMany({
    where: { ...scope, name: value },
    take: 2,
  })) as RefRecord[];
  if (named.length === 1) return named[0];
  if (named.length > 1) {
    errors.push(
      `${column} "${value}" matches more than one record; use its ${key} instead`,
    );
    return false;
  }
  return null;
}

const countries: BulkResourceDefinition = {
  key: 'countries',
  label: 'Countries',
  model: 'country',
  uniqueColumn: 'slug',
  /* name, slug, iso2Code and iso3Code are each unique with `deletedKey`. */
  releasesUniqueKeys: true,
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
    { key: 'rank_order', label: 'rank_order', required: false, type: 'number' },
    {
      key: 'faqs',
      label: 'faqs',
      required: false,
      type: 'text',
      description:
        'JSON array of {question, answer, category, isFeatured, displayOrder}.',
    },
    /* Optional, as it is on the record and in the editor: a country saved
       with nothing but a name has none. This field's own flag is what stars
       the column in a downloaded template -- `requiredColumns` is not read
       once a resource lists its fields -- so leaving it true told every
       operator a country cannot be imported without one. */
    { key: 'continent', label: 'continent', required: false, type: 'relation' },
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
  /* Title alone. A continent is optional on the record and in the editor, and
     saying otherwise here marked the column with a star in every template an
     operator downloads -- telling them a country cannot be imported without
     one, which stopped being true when the importer stopped demanding it. */
  requiredColumns: ['title'],
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
    rank_order: '0',
    faqs: '[{"question":"Can I work while studying?","answer":"Yes, within the permitted hours."}]',
    continent: 'asia',
    subject: 'Engineering | Computer Science',
    tag: '',
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
    /* A continent is optional, as it is on the record and in the editor: a
       country saved with nothing but a name has none. Requiring one here
       meant a country's own export could not be fed back in -- every row
       without a continent was rejected, which is what an operator does the
       moment they edit one column of an export and re-upload it. A term that
       is given and does not resolve is still a typo worth reporting. */
    if (continentTerm && !continent)
      errors.push(`continent "${continentTerm}" was not found`);

    const relations = await parseCountryRelations(row, prisma, errors);
    const media = await resolveCountryMedia(row, prisma, errors);
    if (errors.length) return { errors };

    const slug = (row.slug ?? '').trim() || slugify(title);
    const excerpt = (row.excerpt ?? '').trim();
    return {
      data: {
        slug,
        name: title,
        continentId: continent?.id ?? null,
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
    countrySlug: 'Demo Country',
    status: 'DRAFT',
    displayOrder: '0',
  },
  updatableColumns: ['name', 'status', 'displayOrder'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const country = row.countrySlug?.trim()
      ? await findRef(prisma.country, row.countrySlug, 'countrySlug', errors)
      : null;
    if (country === null)
      errors.push(`countrySlug "${row.countrySlug}" was not found`);
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        countryId: (country as RefRecord).id,
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
    'status',
    'displayOrder',
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name', 'countrySlug'],
  exampleRow: {
    slug: '',
    name: 'Demo City',
    countrySlug: 'Demo Country',
    stateSlug: '',
    shortDescription:
      'A fictional demo city used only to show the expected import shape.',
    status: 'DRAFT',
    displayOrder: '0',
  },
  updatableColumns: ['name', 'shortDescription', 'status', 'displayOrder'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const country = row.countrySlug?.trim()
      ? await findRef(prisma.country, row.countrySlug, 'countrySlug', errors)
      : null;
    if (country === null)
      errors.push(`countrySlug "${row.countrySlug}" was not found`);
    let stateId: string | null = null;
    if (row.stateSlug?.trim() && country) {
      const state = await findRef(
        prisma.state,
        row.stateSlug,
        'stateSlug',
        errors,
        {
          countryId: country.id,
          deletedAt: null,
        },
      );
      if (state === null)
        errors.push(
          `stateSlug "${row.stateSlug}" was not found for this country`,
        );
      else if (state) stateId = state.id;
    }
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        countryId: (country as { id: string }).id,
        stateId,
        shortDescription: row.shortDescription?.trim() || null,
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
      status: record.status,
      displayOrder: record.displayOrder,
    };
  },
};

/**
 * A specialization has no sheet of its own and does not need one: its slug is
 * unique inside its subject rather than across the table, so it has no
 * identity a row could carry on its own. It rides on the subject's row
 * instead, as a pipe-separated list of names -- the same shape the country
 * sheet uses for its own taxonomy columns.
 *
 *     Artificial Intelligence | Machine Learning | Cyber Security
 *
 * The slug is derived from the name, exactly as the subject editor derives
 * it, and a name already under that subject is matched rather than added
 * twice, so re-sending a sheet is safe.
 */
type SpecializationInput = { name: string; slug: string };
/** The row's specializations and the publication state it asked for. */
type SpecializationCell = { status: string; rows: SpecializationInput[] };

/** A pipe-separated cell, trimmed and with the blanks dropped. */
function splitList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return [
    ...new Set(
      value
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function parseSpecializations(
  value: string | undefined,
): SpecializationInput[] {
  if (!value?.trim()) return [];
  const seen = new Set<string>();
  const rows: SpecializationInput[] = [];
  for (const part of value.split('|').map((item) => item.trim())) {
    if (!part) continue;
    const slug = slugify(part);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    rows.push({ name: part, slug });
  }
  return rows;
}

/**
 * Adds the specializations a row names and renames the ones already there.
 * It never removes: a specialization has courses hanging off it, and
 * dropping one because a sheet left it out would orphan them somewhere
 * nobody was looking. Removing stays in the subject editor, where what
 * depends on it is on screen.
 */
async function reconcileSpecializations(
  tx: unknown,
  subjectId: string,
  relations: unknown,
) {
  const cell = (relations ?? {
    status: 'DRAFT',
    rows: [],
  }) as SpecializationCell;
  if (!cell.rows.length) return;
  const table = (tx as Record<string, unknown>).subSubject as SubSubjectTable;
  const existing = await table.findMany({ where: { subjectId } });
  const bySlug = new Map(existing.map((row) => [row.slug, row]));
  let order = existing.length;
  /* One row, one publication decision: a sheet that publishes the subject
     publishes what it lists under it, and a draft row stays a draft all the
     way down. Publishing the parent and leaving its children invisible would
     make the sheet's own status column mean two different things. */
  const published = cell.status === 'PUBLISHED';
  const state = published
    ? { status: 'PUBLISHED', publishedAt: new Date() }
    : { status: 'DRAFT' };
  for (const row of cell.rows) {
    const match = bySlug.get(row.slug);
    if (match) {
      if (match.name !== row.name || match.deletedAt)
        await table.update({
          where: { id: match.id },
          data: { name: row.name, deletedAt: null },
        });
      continue;
    }
    await table.create({
      data: {
        subjectId,
        name: row.name,
        slug: row.slug,
        ...state,
        displayOrder: order,
      },
    });
    order += 1;
  }
}

type SubSubjectTable = {
  findMany(args: {
    where: Record<string, unknown>;
  }): Promise<
    Array<{ id: string; name: string; slug: string; deletedAt: Date | null }>
  >;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<unknown>;
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
    'specializations',
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
    specializations: 'Demo Specialization | Second Demo Specialization',
    status: 'DRAFT',
    displayOrder: '0',
  },
  /* `specializations` is deliberately not here. This list drives the
     "apply one value to the selected rows" control, which writes the field
     straight onto the model -- and specializations are rows of their own,
     not a column of `subjects`. Setting the same three on twenty subjects is
     not an operation anyone wants either. The sheet still carries the column;
     only the one-field bulk edit leaves it alone. */
  updatableColumns: ['name', 'shortDescription', 'status', 'displayOrder'],
  async parseRow(row) {
    if (!row.name?.trim()) return { errors: ['name is required'] };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        shortDescription: row.shortDescription?.trim() || null,
        status: row.status?.trim() || 'DRAFT',
        displayOrder: Number(row.displayOrder) || 0,
      },
      relations: {
        status: row.status?.trim() || 'DRAFT',
        rows: parseSpecializations(row.specializations),
      },
    };
  },
  async reconcile(tx, id, relations) {
    await reconcileSpecializations(tx, id, relations);
  },
  toExportRow(record) {
    const children = (record.subSubjects ?? []) as Array<{ name: string }>;
    return {
      slug: record.slug,
      name: record.name,
      shortDescription: record.shortDescription ?? '',
      specializations: children.map((child) => child.name).join(' | '),
      status: record.status,
      displayOrder: record.displayOrder,
    };
  },
};

type CountryCourseTable = {
  findMany(args: {
    where: Record<string, unknown>;
  }): Promise<Array<{ id: string; countryId: string; deletedAt: Date | null }>>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<unknown>;
};

/**
 * Adds the destinations a course row names, and revives one that had been
 * archived. Like the subject's specializations it never removes: a sheet
 * that leaves a destination out is usually a sheet about something else,
 * and an offering carries tuition, intakes and entry requirements that
 * nobody would want dropped by omission. Removing stays in the editor.
 */
async function reconcileCourseOfferings(
  tx: unknown,
  courseId: string,
  relations: unknown,
) {
  const ids = ((relations ?? {}) as { countryIds?: string[] }).countryIds ?? [];
  if (!ids.length) return;
  const table = (tx as Record<string, unknown>)
    .countryCourse as CountryCourseTable;
  const existing = await table.findMany({ where: { courseId } });
  const byCountry = new Map(existing.map((row) => [row.countryId, row]));
  for (const countryId of ids) {
    const match = byCountry.get(countryId);
    if (!match) {
      await table.create({ data: { courseId, countryId } });
      continue;
    }
    if (match.deletedAt)
      await table.update({
        where: { id: match.id },
        data: { deletedAt: null, status: 'ACTIVE' },
      });
  }
}

const courses: BulkResourceDefinition = {
  key: 'courses',
  label: 'Generic courses',
  model: 'course',
  uniqueColumn: 'slug',
  /* A course row carries what its page shows: the qualification and its
     short name, which specialization it sits under, how long it runs, the
     overview and where it leads. The sheet used to stop at a one-line
     summary, so an imported course arrived as a name and a level.
     `countrySlugs` is what makes it public: the course list is built from
     country offerings, so a course with no destination is published and
     still invisible. */
  columns: [
    'slug',
    'name',
    'subjectSlug',
    'specializationSlug',
    'courseLevelCode',
    'countrySlugs',
    'qualificationName',
    'shortName',
    'shortDescription',
    'overview',
    'durationMin',
    'durationMax',
    'durationUnit',
    'careerSummary',
    'displayOrder',
    'status',
  ],
  fields: [
    { key: 'name', label: 'Course Name', required: true, type: 'text' },
    { key: 'subjectSlug', label: 'Subject', required: true, type: 'relation' },
    {
      key: 'specializationSlug',
      label: 'Specialization',
      required: false,
      type: 'relation',
      description:
        'A specialization under the subject above, by its slug or name.',
    },
    {
      key: 'courseLevelCode',
      label: 'Course Level',
      required: true,
      type: 'relation',
    },
    {
      key: 'countrySlugs',
      label: 'Destinations',
      required: false,
      type: 'relation',
      description:
        'Destinations this course is offered in, by slug or name, separated by |. A course with none is not listed publicly.',
    },
    {
      key: 'qualificationName',
      label: 'Qualification',
      required: false,
      type: 'text',
    },
    { key: 'shortName', label: 'Short name', required: false, type: 'text' },
    {
      key: 'shortDescription',
      label: 'Short Description',
      required: false,
      type: 'text',
    },
    { key: 'overview', label: 'Overview', required: false, type: 'text' },
    {
      key: 'durationMin',
      label: 'Duration minimum',
      required: false,
      type: 'number',
    },
    {
      key: 'durationMax',
      label: 'Duration maximum',
      required: false,
      type: 'number',
    },
    {
      key: 'durationUnit',
      label: 'Duration unit',
      required: false,
      type: 'text',
      allowedValues: COURSE_DURATION_UNITS,
    },
    {
      key: 'careerSummary',
      label: 'Career summary',
      required: false,
      type: 'text',
    },
    {
      key: 'displayOrder',
      label: 'Display order',
      required: false,
      type: 'number',
    },
    { key: 'status', label: 'Status', required: false, type: 'status' },
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name', 'subjectSlug', 'courseLevelCode'],
  exampleRow: {
    slug: '',
    name: 'Demo Course',
    subjectSlug: 'Demo Subject',
    specializationSlug: '',
    courseLevelCode: 'UG',
    countrySlugs: '',
    qualificationName: 'Bachelor of Science',
    shortName: 'BSc',
    shortDescription:
      'A fictional demo course used only to show the expected import shape.',
    overview:
      '<p>What the degree covers, how it is taught and what it leads to. HTML is allowed.</p>',
    durationMin: '3',
    durationMax: '4',
    durationUnit: 'YEARS',
    careerSummary: '',
    displayOrder: '0',
    status: 'DRAFT',
  },
  /* `countrySlugs` is deliberately absent, for the reason `specializations`
     is absent from the subject's list: the one-field bulk edit writes its
     value straight onto the model, and an offering is a row of its own. */
  updatableColumns: [
    'name',
    'qualificationName',
    'shortName',
    'shortDescription',
    'overview',
    'durationMin',
    'durationMax',
    'durationUnit',
    'careerSummary',
    'displayOrder',
    'status',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    const subject = row.__subjectId
      ? { id: row.__subjectId }
      : row.subjectSlug?.trim()
        ? await findRef(prisma.subject, row.subjectSlug, 'subjectSlug', errors)
        : null;
    if (subject === null)
      errors.push(`subjectSlug "${row.subjectSlug}" was not found`);
    const courseLevel = row.__courseLevelId
      ? { id: row.__courseLevelId }
      : row.courseLevelCode?.trim()
        ? await findRef(
            prisma.courseLevel,
            row.courseLevelCode,
            'courseLevelCode',
            errors,
            {},
            'code',
          )
        : null;
    if (courseLevel === null)
      errors.push(`courseLevelCode "${row.courseLevelCode}" was not found`);
    if (errors.length) return { errors };
    /* A specialization is named within its subject, so it is looked up
       under the subject this row already resolved -- the same slug can
       belong to two subjects. */
    const specTerm = row.specializationSlug?.trim();
    let specializationId: string | null = null;
    if (specTerm) {
      const found = await findRef(
        prisma.subSubject,
        specTerm,
        'specializationSlug',
        errors,
        { deletedAt: null, subjectId: (subject as { id: string }).id },
      );
      if (found === null)
        errors.push(
          `specializationSlug "${specTerm}" was not found under "${row.subjectSlug}"`,
        );
      else if (found) specializationId = found.id;
    }
    /* Where the course is offered. Each name is resolved here rather than in
       `reconcile`, so a destination nobody recognises is reported against
       its row at validation time instead of failing the import. */
    const countryIds: string[] = [];
    for (const term of splitList(row.countrySlugs)) {
      const found = await findRef(
        prisma.country,
        term,
        'countrySlugs',
        errors,
        { deletedAt: null },
      );
      if (found === null) errors.push(`country "${term}" was not found`);
      else if (found && !countryIds.includes(found.id))
        countryIds.push(found.id);
    }
    const unit = row.durationUnit?.trim().toUpperCase();
    if (unit && !COURSE_DURATION_UNITS.includes(unit as 'YEARS'))
      errors.push(
        `durationUnit must be one of ${COURSE_DURATION_UNITS.join(', ')}`,
      );
    for (const key of ['durationMin', 'durationMax'] as const) {
      const value = row[key]?.trim();
      if (value && !/^\d+(\.\d+)?$/.test(value))
        errors.push(`${key} must be a number`);
    }
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        subjectId: (subject as { id: string }).id,
        subSubjectId: specializationId,
        courseLevelId: (courseLevel as { id: string }).id,
        qualificationName: row.qualificationName?.trim() || null,
        shortName: row.shortName?.trim() || null,
        shortDescription: row.shortDescription?.trim() || null,
        overview: row.overview?.trim() || null,
        durationMin: row.durationMin?.trim() || null,
        durationMax: row.durationMax?.trim() || null,
        durationUnit: unit || null,
        careerSummary: row.careerSummary?.trim() || null,
        displayOrder: Number(row.displayOrder) || 0,
        status: row.status?.trim() || 'DRAFT',
      },
      relations: { countryIds },
    };
  },
  async reconcile(tx, id, relations) {
    await reconcileCourseOfferings(tx, id, relations);
  },
  toExportRow(record) {
    const offerings = (record.countryCourses ?? []) as Array<{
      country?: { slug?: string };
    }>;
    return {
      slug: record.slug,
      name: record.name,
      subjectSlug:
        (record as { subject?: { slug?: string } }).subject?.slug ?? '',
      countrySlugs: offerings
        .map((offering) => offering.country?.slug ?? '')
        .filter(Boolean)
        .join(' | '),
      specializationSlug:
        (record as { subSubject?: { slug?: string } }).subSubject?.slug ?? '',
      courseLevelCode:
        (record as { courseLevel?: { code?: string } }).courseLevel?.code ?? '',
      qualificationName: record.qualificationName ?? '',
      shortName: record.shortName ?? '',
      shortDescription: record.shortDescription ?? '',
      overview: record.overview ?? '',
      durationMin: record.durationMin ?? '',
      durationMax: record.durationMax ?? '',
      durationUnit: record.durationUnit ?? '',
      careerSummary: record.careerSummary ?? '',
      displayOrder: record.displayOrder,
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
  /* A university row carries what its public page shows: the summary under
     the name, the overview that fills the page, its type and ranking, and
     the citation an editor is asked for anywhere a fact is published. The
     sheet used to stop at the summary, which left every imported university
     a name and one line. */
  columns: [
    'slug',
    'name',
    'countrySlug',
    'institutionType',
    'qsRanking',
    'shortDescription',
    'overview',
    'sourceReference',
    'verifiedAt',
    'displayOrder',
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
    { key: 'qsRanking', label: 'QS ranking', required: false, type: 'number' },
    {
      key: 'shortDescription',
      label: 'Short Description',
      required: true,
      type: 'text',
    },
    { key: 'overview', label: 'Overview', required: false, type: 'text' },
    {
      key: 'sourceReference',
      label: 'Official source URL',
      required: false,
      type: 'text',
    },
    {
      key: 'verifiedAt',
      label: 'Verified date',
      required: false,
      type: 'date',
    },
    {
      key: 'displayOrder',
      label: 'Display order',
      required: false,
      type: 'number',
    },
    { key: 'status', label: 'Status', required: false, type: 'status' },
  ],
  statusAllowedValues: PUBLISH_STATUSES,
  requiredColumns: ['name', 'countrySlug', 'shortDescription'],
  exampleRow: {
    slug: '',
    name: 'Demo University',
    countrySlug: 'Demo Country',
    institutionType: 'PUBLIC',
    qsRanking: '',
    shortDescription:
      'A fictional demo university used only to show the expected import shape.',
    overview:
      '<p>A longer description of the university, its campuses and what it is known for. HTML is allowed.</p>',
    sourceReference: '',
    verifiedAt: '',
    displayOrder: '0',
    status: 'DRAFT',
  },
  updatableColumns: [
    'name',
    'institutionType',
    'qsRanking',
    'shortDescription',
    'overview',
    'sourceReference',
    'verifiedAt',
    'displayOrder',
    'status',
  ],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    if (!row.shortDescription?.trim())
      errors.push('shortDescription is required');
    const country = row.__countryId
      ? { id: row.__countryId }
      : row.countrySlug?.trim()
        ? await findRef(prisma.country, row.countrySlug, 'countrySlug', errors)
        : null;
    if (country === null)
      errors.push(`countrySlug "${row.countrySlug}" was not found`);
    if (errors.length) return { errors };
    const ranking = row.qsRanking?.trim();
    if (ranking && !/^\d+$/.test(ranking))
      errors.push('qsRanking must be a whole number');
    const verified = row.verifiedAt?.trim();
    if (verified && Number.isNaN(new Date(verified).getTime()))
      errors.push('verifiedAt must be a date, for example 2026-10-01');
    if (errors.length) return { errors };
    return {
      data: {
        slug: slugOrFallback(row, row.name),
        name: row.name.trim(),
        countryId: (country as { id: string }).id,
        institutionType: row.institutionType?.trim() || null,
        qsRanking: ranking ? Number(ranking) : null,
        shortDescription: row.shortDescription.trim(),
        overview: row.overview?.trim() || null,
        sourceReference: row.sourceReference?.trim() || null,
        verifiedAt: verified ? new Date(verified) : null,
        displayOrder: Number(row.displayOrder) || 0,
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
      qsRanking: record.qsRanking ?? '',
      shortDescription: record.shortDescription ?? '',
      overview: record.overview ?? '',
      sourceReference: record.sourceReference ?? '',
      verifiedAt: record.verifiedAt
        ? (record.verifiedAt as Date).toISOString().slice(0, 10)
        : '',
      displayOrder: record.displayOrder,
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
    universitySlug: 'Demo University',
    city: 'Demo City',
    state: 'Demo Province',
    address: '',
    status: 'ACTIVE',
  },
  updatableColumns: ['name', 'city', 'state', 'address', 'status'],
  async parseRow(row, prisma) {
    const errors: string[] = [];
    if (!row.name?.trim()) errors.push('name is required');
    if (!row.city?.trim()) errors.push('city is required');
    const university = row.universitySlug?.trim()
      ? await findRef(
          prisma.university,
          row.universitySlug,
          'universitySlug',
          errors,
        )
      : null;
    if (university === null)
      errors.push(`universitySlug "${row.universitySlug}" was not found`);
    if (errors.length) return { errors };
    const slug =
      row.slug?.trim() ||
      `${(university as RefRecord).slug}-${slugify(row.name)}`;
    return {
      data: {
        slug,
        name: row.name.trim(),
        universityId: (university as RefRecord).id,
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
    universitySlug: 'Demo University',
    genericCourseSlug: 'Demo Course',
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
      ? await findRef(
          prisma.university,
          row.universitySlug,
          'universitySlug',
          errors,
        )
      : null;
    if (university === null)
      errors.push(`universitySlug "${row.universitySlug}" was not found`);
    const genericCourse = row.genericCourseSlug?.trim()
      ? await findRef(
          prisma.course,
          row.genericCourseSlug,
          'genericCourseSlug',
          errors,
        )
      : null;
    if (genericCourse === null)
      errors.push(`genericCourseSlug "${row.genericCourseSlug}" was not found`);
    let campusId: string | null = null;
    if (row.campusSlug?.trim() && university) {
      const campus = await findRef(
        prisma.universityCampus,
        row.campusSlug,
        'campusSlug',
        errors,
        { universityId: university.id, deletedAt: null },
      );
      if (campus === null)
        errors.push(
          `campusSlug "${row.campusSlug}" was not found for this university`,
        );
      else if (campus) campusId = campus.id;
    }
    let courseLevelId: string | null = null;
    if (row.courseLevelCode?.trim()) {
      const courseLevel = await findRef(
        prisma.courseLevel,
        row.courseLevelCode,
        'courseLevelCode',
        errors,
        {},
        'code',
      );
      if (courseLevel === null)
        errors.push(`courseLevelCode "${row.courseLevelCode}" was not found`);
      else if (courseLevel) courseLevelId = courseLevel.id;
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
        universityId: (university as RefRecord).id,
        genericCourseId: (genericCourse as { id: string }).id,
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
      const provider = await findRef(
        prisma.scholarshipProvider,
        row.providerSlug,
        'providerSlug',
        errors,
      );
      if (provider === null)
        errors.push(`providerSlug "${row.providerSlug}" was not found`);
      else if (provider) providerId = provider.id;
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
    city: 'Demo City',
    state: 'Demo Province',
    countrySlug: 'Demo Country',
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
      const country = await findRef(
        prisma.country,
        row.countrySlug,
        'countrySlug',
        errors,
      );
      if (country === null)
        errors.push(`countrySlug "${row.countrySlug}" was not found`);
      else if (country) countryId = country.id;
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
