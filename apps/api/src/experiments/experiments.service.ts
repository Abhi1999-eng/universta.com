import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const BOT_ANONYMOUS_ID = 'bot';
const CONVERSION_KINDS = ['CTA_CLICK', 'CONTACT_SUBMIT', 'COUNSELLING_SUBMIT'];

type VariantLike = {
  id: string;
  key: string;
  isControl: boolean;
  trafficWeight: number;
};
type VariantOverride = VariantLike & {
  eyebrow: string | null;
  heading: string | null;
  subheading: string | null;
  ctaPrimaryLabel: string | null;
  ctaPrimaryUrl: string | null;
};

/** A small, dependency-free deterministic hash: the same (anonymousId,
 * experimentId) pair always maps to the same point in [0, 1), so a visitor's
 * variant never changes while the experiment stays configured the same way. */
export function hashToUnitInterval(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (Math.imul(hash, 31) + input.charCodeAt(index)) >>> 0;
  }
  return hash / 0xffffffff;
}

/** Picks a variant by cumulative traffic weight. Falls back to the control
 * variant (or the first variant if none is marked control) whenever the
 * configuration is invalid — no active variants, or weights that don't sum
 * to a usable positive total. */
export function assignVariant<T extends VariantLike>(
  variants: T[],
  unit: number,
): T | null {
  if (!variants.length) return null;
  const totalWeight = variants.reduce((sum, v) => sum + v.trafficWeight, 0);
  const control = variants.find((v) => v.isControl) ?? variants[0];
  if (totalWeight <= 0) return control;
  const target = unit * totalWeight;
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.trafficWeight;
    if (target < cumulative) return variant;
  }
  return control;
}

function isBot(anonymousId: string | undefined): boolean {
  return !anonymousId || anonymousId === BOT_ANONYMOUS_ID;
}

@Injectable()
export class ExperimentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** For each of the given sections, returns the active experiment's
   * assigned-variant overrides (heading/subheading/cta), keyed by
   * sectionId. Bots and requests without an anonymous id always get the
   * control variant and are never logged as an exposure, so crawlers see a
   * stable canonical experience and impression counts stay meaningful. */
  async resolveOverridesForSections(
    sectionIds: string[],
    anonymousId: string | undefined,
    now: Date,
  ) {
    if (!sectionIds.length)
      return new Map<string, VariantOverride & { experimentKey: string }>();
    const experiments = await this.prisma.experiment.findMany({
      where: {
        sectionId: { in: sectionIds },
        deletedAt: null,
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      include: {
        variants: {
          where: { deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    const overrides = new Map<
      string,
      VariantOverride & { experimentKey: string }
    >();
    const bot = isBot(anonymousId);
    for (const experiment of experiments) {
      const variants = experiment.variants;
      if (!variants.length) continue;
      const variant = bot
        ? (variants.find((v) => v.isControl) ?? variants[0])
        : assignVariant(
            variants,
            hashToUnitInterval(`${anonymousId}:${experiment.id}`),
          );
      if (!variant) continue;
      overrides.set(experiment.sectionId, {
        ...variant,
        experimentKey: experiment.key,
      });
      if (!bot) {
        // Awaited so exposure counts are immediately consistent (and testable);
        // a logging failure is swallowed so it never breaks the page render.
        await this.prisma.experimentExposure
          .create({
            data: {
              experimentId: experiment.id,
              variantId: variant.id,
              anonymousId: anonymousId!,
            },
          })
          .catch(() => undefined);
      }
    }
    return overrides;
  }

  async recordConversion(
    experimentKey: string,
    anonymousId: string | undefined,
    kind: string,
  ) {
    if (isBot(anonymousId)) return;
    if (!CONVERSION_KINDS.includes(kind))
      throw new BadRequestException({
        code: 'INVALID_CONVERSION_KIND',
        message: `kind must be one of ${CONVERSION_KINDS.join(', ')}`,
        details: null,
      });
    const experiment = await this.prisma.experiment.findFirst({
      where: { key: experimentKey, deletedAt: null },
    });
    if (!experiment) return; // Unknown/removed experiment — nothing to attribute to.
    const variants = await this.prisma.experimentVariant.findMany({
      where: { experimentId: experiment.id, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
    const variant = assignVariant(
      variants,
      hashToUnitInterval(`${anonymousId}:${experiment.id}`),
    );
    if (!variant) return;
    await this.prisma.experimentConversion.create({
      data: {
        experimentId: experiment.id,
        variantId: variant.id,
        anonymousId: anonymousId!,
        kind,
      },
    });
  }

  async adminList() {
    return this.prisma.experiment.findMany({
      where: { deletedAt: null },
      include: {
        section: {
          select: { id: true, heading: true, sectionKey: true, pageId: true },
        },
        variants: {
          where: { deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminDetail(id: string) {
    const experiment = await this.prisma.experiment.findFirst({
      where: { id, deletedAt: null },
      include: {
        section: {
          select: { id: true, heading: true, sectionKey: true, pageId: true },
        },
        variants: {
          where: { deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    if (!experiment)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Experiment not found',
        details: null,
      });
    return experiment;
  }

  async stats(id: string) {
    await this.adminDetail(id);
    const [exposures, conversions] = await Promise.all([
      this.prisma.experimentExposure.groupBy({
        by: ['variantId'],
        where: { experimentId: id },
        _count: { _all: true },
      }),
      this.prisma.experimentConversion.groupBy({
        by: ['variantId'],
        where: { experimentId: id },
        _count: { _all: true },
      }),
    ]);
    const exposureByVariant = new Map(
      exposures.map((row) => [row.variantId, row._count._all]),
    );
    const conversionByVariant = new Map(
      conversions.map((row) => [row.variantId, row._count._all]),
    );
    const variants = await this.prisma.experimentVariant.findMany({
      where: { experimentId: id, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
    return variants.map((variant) => {
      const exposureCount = exposureByVariant.get(variant.id) ?? 0;
      const conversionCount = conversionByVariant.get(variant.id) ?? 0;
      return {
        variantId: variant.id,
        key: variant.key,
        name: variant.name,
        isControl: variant.isControl,
        exposureCount,
        conversionCount,
        conversionRate: exposureCount ? conversionCount / exposureCount : 0,
      };
    });
  }

  async createExperiment(body: {
    key?: string;
    name: string;
    description?: string;
    sectionId: string;
    status?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    createdByUserId?: string;
  }) {
    const section = await this.prisma.pageSection.findFirst({
      where: { id: body.sectionId, deletedAt: null },
    });
    if (!section)
      throw new BadRequestException({
        code: 'SECTION_NOT_FOUND',
        message: 'The target section does not exist',
        details: null,
      });
    const key = body.key?.trim() || `${section.sectionKey}-${Date.now()}`;
    try {
      return await this.prisma.experiment.create({
        data: {
          key,
          name: body.name,
          description: body.description || null,
          sectionId: body.sectionId,
          status: body.status ?? 'DRAFT',
          startsAt: body.startsAt ? new Date(body.startsAt) : null,
          endsAt: body.endsAt ? new Date(body.endsAt) : null,
          createdByUserId: body.createdByUserId ?? null,
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error))
        throw new ConflictException({
          code: 'EXPERIMENT_KEY_TAKEN',
          message: 'An experiment with this key already exists',
          details: null,
        });
      throw error;
    }
  }

  async updateExperiment(
    id: string,
    body: {
      name?: string;
      description?: string;
      status?: string;
      startsAt?: string | null;
      endsAt?: string | null;
    },
  ) {
    await this.adminDetail(id);
    return this.prisma.experiment.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description || null }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.startsAt !== undefined
          ? { startsAt: body.startsAt ? new Date(body.startsAt) : null }
          : {}),
        ...(body.endsAt !== undefined
          ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
          : {}),
      },
    });
  }

  async archiveExperiment(id: string) {
    await this.adminDetail(id);
    return this.prisma.experiment.update({
      where: { id },
      data: { status: 'ARCHIVED', deletedAt: new Date() },
    });
  }

  async addVariant(
    experimentId: string,
    body: {
      key?: string;
      name: string;
      isControl?: boolean;
      trafficWeight?: number;
      eyebrow?: string;
      heading?: string;
      subheading?: string;
      ctaPrimaryLabel?: string;
      ctaPrimaryUrl?: string;
    },
  ) {
    await this.adminDetail(experimentId);
    const key =
      body.key?.trim() ||
      body.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
    const maxOrder = await this.prisma.experimentVariant.aggregate({
      where: { experimentId, deletedAt: null },
      _max: { displayOrder: true },
    });
    try {
      return await this.prisma.experimentVariant.create({
        data: {
          experimentId,
          key,
          name: body.name,
          isControl: body.isControl ?? false,
          trafficWeight: body.trafficWeight ?? 0,
          eyebrow: body.eyebrow || null,
          heading: body.heading || null,
          subheading: body.subheading || null,
          ctaPrimaryLabel: body.ctaPrimaryLabel || null,
          ctaPrimaryUrl: body.ctaPrimaryUrl || null,
          displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error))
        throw new ConflictException({
          code: 'VARIANT_KEY_TAKEN',
          message: 'A variant with this key already exists on this experiment',
          details: null,
        });
      throw error;
    }
  }

  async updateVariant(
    experimentId: string,
    variantId: string,
    body: {
      name?: string;
      isControl?: boolean;
      trafficWeight?: number;
      eyebrow?: string;
      heading?: string;
      subheading?: string;
      ctaPrimaryLabel?: string;
      ctaPrimaryUrl?: string;
    },
  ) {
    const variant = await this.prisma.experimentVariant.findFirst({
      where: { id: variantId, experimentId, deletedAt: null },
    });
    if (!variant)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Variant not found',
        details: null,
      });
    return this.prisma.experimentVariant.update({
      where: { id: variantId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.isControl !== undefined ? { isControl: body.isControl } : {}),
        ...(body.trafficWeight !== undefined
          ? { trafficWeight: body.trafficWeight }
          : {}),
        ...(body.eyebrow !== undefined
          ? { eyebrow: body.eyebrow || null }
          : {}),
        ...(body.heading !== undefined
          ? { heading: body.heading || null }
          : {}),
        ...(body.subheading !== undefined
          ? { subheading: body.subheading || null }
          : {}),
        ...(body.ctaPrimaryLabel !== undefined
          ? { ctaPrimaryLabel: body.ctaPrimaryLabel || null }
          : {}),
        ...(body.ctaPrimaryUrl !== undefined
          ? { ctaPrimaryUrl: body.ctaPrimaryUrl || null }
          : {}),
      },
    });
  }

  async removeVariant(experimentId: string, variantId: string) {
    const variant = await this.prisma.experimentVariant.findFirst({
      where: { id: variantId, experimentId, deletedAt: null },
    });
    if (!variant)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Variant not found',
        details: null,
      });
    return this.prisma.experimentVariant.update({
      where: { id: variantId },
      data: { deletedAt: new Date() },
    });
  }

  /** Admin preview: force a specific variant's content for review, without
   * touching the deterministic public-assignment path at all. */
  async previewVariant(experimentId: string, variantId: string) {
    const variant = await this.prisma.experimentVariant.findFirst({
      where: { id: variantId, experimentId, deletedAt: null },
    });
    if (!variant)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Variant not found',
        details: null,
      });
    return variant;
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
