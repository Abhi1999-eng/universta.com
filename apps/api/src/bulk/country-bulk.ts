import type { Prisma } from '../generated/prisma/client';
import { slugify } from '../catalog/catalog.constants';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The Country bulk contract.
 *
 * Countries are the one bulk resource whose client contract reaches past
 * scalar columns into profiles, taxonomies, intakes, FAQs and long-form
 * sections. Rather than flattening those into text on the Country row, this
 * module resolves each one to the records it actually maps to and hands the
 * result to a per-row reconciler that runs inside the row's transaction.
 *
 * Three cell states, and the difference between them is the whole safety
 * story for a spreadsheet round trip:
 *
 *   column absent      -> undefined -> leave the existing assignments alone
 *   column present, "" -> preserve too; a blank cell is the normal state of a
 *                         spreadsheet an editor only partly filled in
 *   "__CLEAR__"        -> the only way to remove every assignment
 *
 * `rowsWithHeader` omits absent columns entirely, which is what makes the
 * first two distinguishable at all.
 */

export const CLEAR_TOKEN = '__CLEAR__';

/** Long-form client fields and the section key each one owns. */
export const COUNTRY_SECTION_KEYS = {
  why_study: 'why-study',
  admission_process: 'admission-process',
  cost_breakdown: 'cost-breakdown',
  visa_process: 'visa-process',
} as const;

export type SectionColumn = keyof typeof COUNTRY_SECTION_KEYS;

export type CellState<T> =
  | { kind: 'absent' }
  | { kind: 'clear' }
  | { kind: 'value'; value: T };

export type CountryRelations = {
  subjects: CellState<string[]>;
  tags: CellState<string[]>;
  intakes: CellState<string[]>;
  faqs: CellState<FaqInput[]>;
  sections: Partial<Record<SectionColumn, CellState<string>>>;
  cost: Record<string, unknown> | null;
  work: Record<string, unknown> | null;
  language: Record<string, unknown> | null;
  statistics: Record<string, unknown> | null;
};

export type FaqInput = {
  question: string;
  answer: string;
  category?: string | null;
  isFeatured?: boolean;
  displayOrder?: number;
};

const trim = (value: string | undefined) => (value ?? '').trim();

/** Splits a pipe-separated taxonomy cell, dropping empty segments. */
export function splitTerms(value: string): string[] {
  return value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** `Engineering > Computer Science` keeps only the parent for assignment; the
 * child is still validated so a wrong path is reported rather than ignored. */
export function splitHierarchy(term: string): { parent: string; child?: string } {
  const [parent, ...rest] = term.split('>').map((part) => part.trim());
  return { parent, child: rest.length ? rest.join(' > ') : undefined };
}

export function cellState<T>(
  raw: string | undefined,
  parse: (value: string) => T,
): CellState<T> {
  if (raw === undefined) return { kind: 'absent' };
  const value = raw.trim();
  if (value === '') return { kind: 'absent' };
  if (value === CLEAR_TOKEN) return { kind: 'clear' };
  return { kind: 'value', value: parse(value) };
}

function decimalOrNull(raw: string | undefined): Prisma.Decimal | null | undefined {
  const value = trim(raw);
  if (raw === undefined || value === '') return undefined;
  if (value === CLEAR_TOKEN) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? (value as unknown as Prisma.Decimal) : undefined;
}

function intOrNull(raw: string | undefined): number | null | undefined {
  const value = trim(raw);
  if (raw === undefined || value === '') return undefined;
  if (value === CLEAR_TOKEN) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function textOrNull(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (value === '') return undefined;
  return value === CLEAR_TOKEN ? null : value;
}

function boolOrUndefined(raw: string | undefined): boolean | undefined {
  const value = trim(raw).toLowerCase();
  if (!value) return undefined;
  if (['true', 'yes', '1'].includes(value)) return true;
  if (['false', 'no', '0'].includes(value)) return false;
  return undefined;
}

/** Only writes a profile when the row actually carried one of its columns, so
 * an import that never mentions PTE cannot blank it. */
function compact(record: Record<string, unknown>): Record<string, unknown> | null {
  const entries = Object.entries(record).filter(([, value]) => value !== undefined);
  return entries.length ? Object.fromEntries(entries) : null;
}

export function parseFaqCell(value: string): FaqInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(
      'faqs must be a JSON array, for example [{"question":"…","answer":"…"}]',
    );
  }
  if (!Array.isArray(parsed)) throw new Error('faqs must be a JSON array');
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object')
      throw new Error(`faqs[${index}] must be an object`);
    const row = entry as Record<string, unknown>;
    const question = typeof row.question === 'string' ? row.question.trim() : '';
    const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
    if (!question) throw new Error(`faqs[${index}].question is required`);
    if (!answer) throw new Error(`faqs[${index}].answer is required`);
    return {
      question,
      answer,
      category: typeof row.category === 'string' ? row.category.trim() : null,
      isFeatured: row.isFeatured === true,
      displayOrder:
        typeof row.displayOrder === 'number' ? row.displayOrder : index,
    };
  });
}

/** Resolves taxonomy terms to ids, reporting every unresolved term at once so
 * an editor fixes one row rather than one term per attempt. */
async function resolveSubjects(
  terms: string[],
  prisma: PrismaService,
  errors: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const term of terms) {
    const { parent, child } = splitHierarchy(term);
    const slug = slugify(parent);
    const subject = await prisma.subject.findFirst({
      where: { deletedAt: null, OR: [{ slug }, { name: parent }] },
      select: { id: true, name: true },
    });
    if (!subject) {
      errors.push(`subject "${parent}" was not found`);
      continue;
    }
    if (child) {
      const childSlug = slugify(child);
      const sub = await prisma.subSubject.findFirst({
        where: {
          subjectId: subject.id,
          deletedAt: null,
          OR: [{ slug: childSlug }, { name: child }],
        },
        select: { id: true },
      });
      if (!sub) {
        errors.push(`subject "${child}" is not under "${subject.name}"`);
        continue;
      }
    }
    if (!ids.includes(subject.id)) ids.push(subject.id);
  }
  return ids;
}

async function resolveTags(
  terms: string[],
  prisma: PrismaService,
  errors: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const term of terms) {
    const slug = slugify(term);
    const tag = await prisma.countryTag.findFirst({
      where: { OR: [{ slug }, { name: term }] },
      select: { id: true },
    });
    if (!tag) {
      errors.push(`tag "${term}" was not found`);
      continue;
    }
    if (!ids.includes(tag.id)) ids.push(tag.id);
  }
  return ids;
}

async function resolveIntakes(
  terms: string[],
  prisma: PrismaService,
  errors: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const term of terms) {
    const slug = slugify(term);
    const intake = await prisma.intake.findFirst({
      where: { status: 'ACTIVE', OR: [{ slug }, { name: term }] },
      select: { id: true },
    });
    if (!intake) {
      errors.push(`intake "${term}" was not found`);
      continue;
    }
    if (!ids.includes(intake.id)) ids.push(intake.id);
  }
  return ids;
}

/** Media is referenced, never created: an import must not mint a MediaAsset
 * row pointing at a URL nobody has verified. */
async function resolveMedia(
  raw: string | undefined,
  column: string,
  prisma: PrismaService,
  errors: string[],
): Promise<string | null | undefined> {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (value === '') return undefined;
  if (value === CLEAR_TOKEN) return null;
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      OR: [{ id: value }, { publicUrl: value }],
    },
    select: { id: true },
  });
  if (!asset) {
    errors.push(
      `${column} "${value}" did not match an existing media asset by id or public URL`,
    );
    return undefined;
  }
  return asset.id;
}

export async function parseCountryRelations(
  row: Record<string, string | undefined>,
  prisma: PrismaService,
  errors: string[],
): Promise<CountryRelations> {
  const subjectCell = cellState(row.subject, splitTerms);
  const tagCell = cellState(row.tag, splitTerms);
  const intakeCell = cellState(row.intakes, splitTerms);

  let faqCell: CellState<FaqInput[]> = { kind: 'absent' };
  if (row.faqs !== undefined) {
    const value = row.faqs.trim();
    if (value === CLEAR_TOKEN) faqCell = { kind: 'clear' };
    else if (value !== '') {
      try {
        faqCell = { kind: 'value', value: parseFaqCell(value) };
      } catch (cause) {
        errors.push(cause instanceof Error ? cause.message : 'faqs is invalid');
      }
    }
  }

  const sections: Partial<Record<SectionColumn, CellState<string>>> = {};
  for (const column of Object.keys(COUNTRY_SECTION_KEYS) as SectionColumn[]) {
    const state = cellState(row[column], (value) => value);
    if (state.kind !== 'absent') sections[column] = state;
  }

  return {
    subjects:
      subjectCell.kind === 'value'
        ? {
            kind: 'value',
            value: await resolveSubjects(subjectCell.value, prisma, errors),
          }
        : subjectCell,
    tags:
      tagCell.kind === 'value'
        ? { kind: 'value', value: await resolveTags(tagCell.value, prisma, errors) }
        : tagCell,
    intakes:
      intakeCell.kind === 'value'
        ? {
            kind: 'value',
            value: await resolveIntakes(intakeCell.value, prisma, errors),
          }
        : intakeCell,
    faqs: faqCell,
    sections,
    cost: compact({
      currencyCode: textOrNull(row.tuition_currency)?.toUpperCase(),
      tuitionMin: decimalOrNull(row.tuition_min),
      tuitionMax: decimalOrNull(row.tuition_max),
      livingCostMin: decimalOrNull(row.living_min),
      livingCostMax: decimalOrNull(row.living_max),
      applicationFeeMin: decimalOrNull(row.application_fee),
      applicationFeeMax: decimalOrNull(row.application_fee_max ?? row.application_fee),
    }),
    work: compact({
      visaType: textOrNull(row.visa_type),
      visaFee: decimalOrNull(row.visa_fee),
      visaProcessingTime: textOrNull(row.visa_processing),
      postStudyWorkMaxMonths: intOrNull(row.post_study_work),
      partTimeHoursPerWeek: decimalOrNull(row.work_hours),
    }),
    language: compact({ ieltsMinScore: decimalOrNull(row.ielts_min) }),
    statistics: compact({
      universitiesCount: intOrNull(row.universities_count),
      internationalStudentsCount: intOrNull(row.intl_students),
    }),
  };
}

export async function resolveCountryMedia(
  row: Record<string, string | undefined>,
  prisma: PrismaService,
  errors: string[],
) {
  return compact({
    listingMediaId: await resolveMedia(row.featured_image, 'featured_image', prisma, errors),
    flagMediaId: await resolveMedia(row.flag_image, 'flag_image', prisma, errors),
    heroMediaId: await resolveMedia(row.hero_image, 'hero_image', prisma, errors),
  });
}

export { boolOrUndefined, intOrNull, textOrNull };

type Tx = Prisma.TransactionClient;

/**
 * Applies everything that is not a Country scalar, inside the row's own
 * transaction so a country cannot end up with new scalars and stale relations.
 */
export async function reconcileCountry(
  tx: Tx,
  countryId: string,
  relations: CountryRelations,
): Promise<void> {
  if (relations.subjects.kind !== 'absent') {
    const ids =
      relations.subjects.kind === 'clear' ? [] : relations.subjects.value;
    await tx.countrySubject.deleteMany({ where: { countryId } });
    for (const [index, subjectId] of ids.entries())
      await tx.countrySubject.create({
        data: { countryId, subjectId, displayOrder: index },
      });
  }

  if (relations.tags.kind !== 'absent') {
    const ids = relations.tags.kind === 'clear' ? [] : relations.tags.value;
    await tx.countryTagMap.deleteMany({ where: { countryId } });
    for (const tagId of ids)
      await tx.countryTagMap.create({ data: { countryId, tagId } });
  }

  if (relations.intakes.kind !== 'absent') {
    const ids = relations.intakes.kind === 'clear' ? [] : relations.intakes.value;
    const existing = await tx.countryIntake.findMany({ where: { countryId } });
    const keep = new Map(existing.map((row) => [row.intakeId, row]));
    await tx.countryIntake.deleteMany({
      where: { countryId, intakeId: { notIn: ids.length ? ids : ['__none__'] } },
    });
    for (const [index, intakeId] of ids.entries()) {
      const current = keep.get(intakeId);
      if (current) {
        // Membership-only import: the application window, notes and ordering
        // an editor set are not the import's to discard.
        continue;
      }
      await tx.countryIntake.create({
        data: { countryId, intakeId, displayOrder: index },
      });
    }
  }

  if (relations.faqs.kind !== 'absent') {
    const rows = relations.faqs.kind === 'clear' ? [] : relations.faqs.value;
    // Replace-set keyed on the question, so a repeated import updates rather
    // than stacking a second copy of every entry.
    await tx.countryFaq.deleteMany({ where: { countryId } });
    for (const [index, faq] of rows.entries())
      await tx.countryFaq.create({
        data: {
          countryId,
          question: faq.question,
          answer: faq.answer,
          category: faq.category ?? null,
          isFeatured: faq.isFeatured ?? false,
          displayOrder: faq.displayOrder ?? index,
          status: 'ACTIVE',
        },
      });
  }

  for (const [column, state] of Object.entries(relations.sections) as Array<
    [SectionColumn, CellState<string>]
  >) {
    const sectionKey = COUNTRY_SECTION_KEYS[column];
    if (state.kind === 'clear') {
      await tx.countryContentSection.deleteMany({
        where: { countryId, sectionKey },
      });
      continue;
    }
    if (state.kind !== 'value') continue;
    const heading = column.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    // `[countryId, sectionKey]` is unique, so the same key updates in place on
    // every re-import instead of adding another section.
    await tx.countryContentSection.upsert({
      where: { countryId_sectionKey: { countryId, sectionKey } },
      update: { bodyJson: { paragraphs: [state.value] }, status: 'ACTIVE' },
      create: {
        countryId,
        sectionKey,
        sectionType: 'RICH_TEXT',
        heading,
        bodyJson: { paragraphs: [state.value] },
        status: 'ACTIVE',
      },
    });
  }

  if (relations.cost)
    await tx.countryCostProfile.upsert({
      where: { countryId },
      update: relations.cost,
      create: {
        countryId,
        currencyCode: String(relations.cost.currencyCode ?? 'USD'),
        ...relations.cost,
      } as Prisma.CountryCostProfileUncheckedCreateInput,
    });

  if (relations.work)
    await tx.countryWorkProfile.upsert({
      where: { countryId },
      update: relations.work,
      create: {
        countryId,
        ...relations.work,
      } as Prisma.CountryWorkProfileUncheckedCreateInput,
    });

  if (relations.language)
    await tx.countryLanguageRequirement.upsert({
      where: { countryId },
      update: relations.language,
      create: {
        countryId,
        ...relations.language,
      } as Prisma.CountryLanguageRequirementUncheckedCreateInput,
    });

  if (relations.statistics)
    await tx.countryStatistic.upsert({
      where: { countryId },
      // IMPORTED records where the number came from, but a spreadsheet cannot
      // carry a source reference or a verification date -- and without both
      // the read path keeps using the live catalogue count. That is the Slice
      // 1 rule, and an import is exactly the case it exists to guard.
      update: { ...relations.statistics, sourceMode: 'IMPORTED' },
      create: {
        countryId,
        sourceMode: 'IMPORTED',
        ...relations.statistics,
      } as Prisma.CountryStatisticUncheckedCreateInput,
    });
}
