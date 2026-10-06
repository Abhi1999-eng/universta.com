import { COURSE_TUITION_PERIODS } from '../catalog/catalog.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { BulkRow } from './bulk-resources';

export const OFFERING_DURATION_UNITS = ['YEARS', 'MONTHS', 'WEEKS'] as const;
export const OFFERING_EXTRA_COLUMNS = [
  'courseCode',
  'shortDescription',
  'overview',
  'durationMin',
  'durationMax',
  'durationUnit',
  'tuitionPeriod',
  'applicationUrl',
  'sourceReference',
  'verifiedAt',
  'intakes',
  'ieltsMinimum',
  'toeflMinimum',
  'pteMinimum',
  'academicRequirement',
];

type IntakeRow = { intakeId: string; deadline: Date | null };
type Requirement = {
  category: string;
  title: string;
  description: string | null;
  minimumScore: number | null;
};
export type OfferingRelations = {
  genericCourseId?: string;
  intakes?: IntakeRow[];
  requirements: Requirement[];
};
type OfferingClient = Pick<
  PrismaService,
  'universityCourseIntake' | 'universityCourseRequirement'
>;

function dateCell(value: string, label: string, errors: string[]) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCFullYear() < 1000
  ) {
    errors.push(`${label} must be a valid date in YYYY-MM-DD format`);
    return null;
  }
  return date;
}

export function offeringNumberCell(
  row: BulkRow,
  key: string,
  maximum: number,
  errors: string[],
) {
  const value = row[key]?.trim();
  if (!value) return null;
  const parsed = Number(value);
  if (
    !/^\d+(?:\.\d{1,2})?$/.test(value) ||
    !Number.isFinite(parsed) ||
    parsed > maximum
  ) {
    errors.push(
      `${key} must be a number from 0 to ${maximum}, with at most two decimal places`,
    );
    return null;
  }
  return parsed;
}

export async function parseOfferingDetails(
  row: BulkRow,
  prisma: PrismaService,
  errors: string[],
) {
  const data: Record<string, unknown> = {};
  const relations: OfferingRelations = { requirements: [] };
  for (const [key, maximum] of [
    ['courseCode', 100],
    ['shortDescription', 1000],
    ['overview', Infinity],
    ['applicationUrl', 2048],
    ['sourceReference', 2048],
  ] as const) {
    if (!(key in row)) continue;
    const value = row[key]?.trim() || null;
    if (value && value.length > maximum)
      errors.push(`${key} must be at most ${maximum} characters`);
    data[key] = value;
  }
  for (const key of ['durationMin', 'durationMax']) {
    if (key in row) data[key] = offeringNumberCell(row, key, 9999.99, errors);
  }
  for (const [key, allowed] of [
    ['durationUnit', OFFERING_DURATION_UNITS],
    ['tuitionPeriod', COURSE_TUITION_PERIODS],
  ] as const) {
    if (!(key in row)) continue;
    const value = row[key]?.trim() || null;
    if (value && !(allowed as readonly string[]).includes(value))
      errors.push(`${key} must be one of ${allowed.join(', ')}`);
    data[key] = value;
  }
  if (
    typeof data.durationMin === 'number' &&
    typeof data.durationMax === 'number' &&
    data.durationMin > data.durationMax
  )
    errors.push('durationMax must be greater than or equal to durationMin');
  if ('verifiedAt' in row)
    data.verifiedAt = row.verifiedAt?.trim()
      ? dateCell(row.verifiedAt.trim(), 'verifiedAt', errors)
      : null;

  if (row.intakes?.trim()) {
    const resolved = new Map<string, IntakeRow>();
    for (const token of row.intakes.split(';')) {
      const [reference, deadlineText, ...extra] = token.trim().split(':');
      if (!reference?.trim() || extra.length || deadlineText === '') {
        errors.push(
          `intakes entry "${token}" must be a month or intake slug, optionally followed by :YYYY-MM-DD`,
        );
        continue;
      }
      const name = reference.trim();
      const deadline = deadlineText
        ? dateCell(
            deadlineText.trim(),
            `intakes deadline for "${name}"`,
            errors,
          )
        : null;
      let intake = await prisma.intake.findUnique({ where: { slug: name } });
      intake ??= await prisma.intake.findUnique({ where: { name } });
      if (!intake && /^\d+$/.test(name)) {
        const month = Number(name);
        if (month < 1 || month > 12) {
          errors.push(`intakes month "${name}" must be from 1 to 12`);
          continue;
        }
        const matches = await prisma.intake.findMany({
          where: { startMonth: month },
        });
        if (matches.length > 1) {
          errors.push(
            `intakes month "${name}" matches more than one intake; use its slug`,
          );
          continue;
        }
        intake = matches[0] ?? null;
      }
      if (!intake) {
        errors.push(
          `intakes entry "${name}" was not found; use an existing intake slug, name or month`,
        );
        continue;
      }
      const previous = resolved.get(intake.id);
      if (previous && previous.deadline?.getTime() !== deadline?.getTime()) {
        errors.push(`intakes entry "${name}" has conflicting deadlines`);
        continue;
      }
      resolved.set(intake.id, { intakeId: intake.id, deadline });
    }
    relations.intakes = [...resolved.values()];
  }
  for (const [key, title, maximum] of [
    ['ieltsMinimum', 'IELTS', 9],
    ['toeflMinimum', 'TOEFL', 120],
    ['pteMinimum', 'PTE', 90],
  ] as const) {
    if (!row[key]?.trim()) continue;
    const minimumScore = offeringNumberCell(row, key, maximum, errors);
    if (minimumScore !== null)
      relations.requirements.push({
        category: 'ENGLISH_TEST',
        title,
        description: null,
        minimumScore,
      });
  }
  if (row.academicRequirement?.trim())
    relations.requirements.push({
      category: 'ACADEMIC',
      title: 'Academic entry requirement',
      description: row.academicRequirement.trim(),
      minimumScore: null,
    });
  return { data, relations };
}

function matchesRequirement(
  row: { category: string; title: string },
  desired: Pick<Requirement, 'category' | 'title'>,
) {
  if (row.category.trim().toUpperCase() !== desired.category) return false;
  return desired.category === 'ACADEMIC'
    ? row.title === desired.title
    : new RegExp(`\\b${desired.title}\\b`, 'i').test(row.title);
}

export async function reconcileOfferingDetails(
  client: OfferingClient,
  offeringId: string,
  relations: OfferingRelations,
) {
  if (relations.intakes) {
    await client.universityCourseIntake.deleteMany({
      where: {
        offeringId,
        intakeId: { notIn: relations.intakes.map((entry) => entry.intakeId) },
      },
    });
    for (const entry of relations.intakes) {
      const data = { deadline: entry.deadline, status: 'ACTIVE' };
      await client.universityCourseIntake.upsert({
        where: {
          offeringId_intakeId: { offeringId, intakeId: entry.intakeId },
        },
        create: { offeringId, intakeId: entry.intakeId, ...data },
        update: data,
      });
    }
  }
  if (!relations.requirements.length) return;
  const stored = await client.universityCourseRequirement.findMany({
    where: { offeringId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  /* An older editor row can name two tests. Once it has been assigned to
     one imported test, the next test needs a separate row of its own. */
  const consumed = new Set<string>();
  for (const desired of relations.requirements) {
    const matches = stored.filter(
      (row) => !consumed.has(row.id) && matchesRequirement(row, desired),
    );
    for (const match of matches) consumed.add(match.id);
    const existing =
      matches.find((row) => row.deletedAt === null) ?? matches[0];
    const data = { ...desired, status: 'ACTIVE', deletedAt: null };
    if (existing) {
      await client.universityCourseRequirement.update({
        where: { id: existing.id },
        data,
      });
      if (matches.length > 1)
        await client.universityCourseRequirement.deleteMany({
          where: {
            id: {
              in: matches
                .filter((row) => row.id !== existing.id)
                .map((row) => row.id),
            },
          },
        });
    } else
      await client.universityCourseRequirement.create({
        data: { offeringId, ...data },
      });
  }
}

export async function offeringRelationsChanged(
  client: OfferingClient,
  offeringId: string,
  relations: OfferingRelations,
) {
  if (relations.intakes) {
    const stored = await client.universityCourseIntake.findMany({
      where: { offeringId },
    });
    if (
      stored.length !== relations.intakes.length ||
      relations.intakes.some(
        (desired) =>
          !stored.some(
            (row) =>
              row.intakeId === desired.intakeId &&
              row.status === 'ACTIVE' &&
              row.deadline?.getTime() === desired.deadline?.getTime(),
          ),
      )
    )
      return true;
  }
  if (relations.requirements.length) {
    const stored = await client.universityCourseRequirement.findMany({
      where: { offeringId },
    });
    for (const desired of relations.requirements) {
      const matches = stored.filter((row) => matchesRequirement(row, desired));
      if (matches.length !== 1) return true;
      const row = matches[0];
      if (
        row.status !== 'ACTIVE' ||
        row.deletedAt !== null ||
        row.title !== desired.title ||
        row.description !== desired.description ||
        (row.minimumScore === null ? null : Number(row.minimumScore)) !==
          desired.minimumScore
      )
        return true;
    }
  }
  return false;
}

export function offeringCellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value instanceof Date) return value.toISOString();
  const own = (value as { toString?: () => string }).toString;
  return own && own !== Object.prototype.toString
    ? own.call(value)
    : (JSON.stringify(value) ?? '');
}

export function exportOfferingDetails(record: Record<string, unknown>) {
  const intakes = (record.intakes ?? []) as Array<{
    status: string;
    deadline: Date | null;
    intake: { startMonth: number | null; slug: string };
  }>;
  const requirements = (record.requirements ?? []) as Array<{
    category: string;
    title: string;
    description: string | null;
    minimumScore: unknown;
    status: string;
    deletedAt: Date | null;
  }>;
  const active = requirements.filter(
    (row) => row.status === 'ACTIVE' && !row.deletedAt,
  );
  const result: Record<string, unknown> = {};
  for (const key of OFFERING_EXTRA_COLUMNS.slice(0, 10))
    result[key] =
      key === 'verifiedAt'
        ? record.verifiedAt
          ? (record.verifiedAt as Date).toISOString().slice(0, 10)
          : ''
        : offeringCellText(record[key]);
  result.intakes = intakes
    .filter((row) => row.status === 'ACTIVE')
    .map(
      (row) =>
        `${row.intake.startMonth ?? row.intake.slug}${row.deadline ? `:${row.deadline.toISOString().slice(0, 10)}` : ''}`,
    )
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .join(';');
  for (const [key, title] of [
    ['ieltsMinimum', 'IELTS'],
    ['toeflMinimum', 'TOEFL'],
    ['pteMinimum', 'PTE'],
  ])
    result[key] = offeringCellText(
      active.find((row) =>
        matchesRequirement(row, {
          category: 'ENGLISH_TEST',
          title,
        }),
      )?.minimumScore ?? '',
    );
  result.academicRequirement =
    active.find(
      (row) =>
        row.category.trim().toUpperCase() === 'ACADEMIC' &&
        row.title === 'Academic entry requirement',
    )?.description ?? '';
  return result;
}
