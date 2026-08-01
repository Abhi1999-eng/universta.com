import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { countCanonicalPublicSlugs } from '../common/public-slug';
import {
  parseStatsPillConfig,
  parseStatsPillEnvelope,
  type ResolvedStatsPill,
  STATS_PILL_SECTION_KEY,
  STATS_PILL_SOURCES,
  type StatsPillConfig,
  type StatsPillEnvelope,
  type StatsPillSource,
  StatsPillValidationError,
} from './stats-pill.contract';

const sourceLabels: Record<StatsPillSource, string> = {
  PUBLISHED_COUNTRIES: 'Published countries',
  PUBLISHED_UNIVERSITIES: 'Published universities',
  PUBLISHED_SUBJECTS: 'Published subjects',
  PUBLISHED_COURSES: 'Published programs',
  COURSE_DESTINATIONS: 'Published countries with published programs',
  PUBLISHED_SCHOLARSHIPS: 'Published scholarships',
  PUBLISHED_CONSULTANTS: 'Published consultants',
};

@Injectable()
export class StatsPillsService {
  constructor(private readonly prisma: PrismaService) {}

  private invalid(error: unknown): never {
    if (error instanceof StatsPillValidationError)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: { fields: error.fields },
      });
    throw error;
  }

  private async sectionByPageId(pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        sections: {
          where: { sectionKey: STATS_PILL_SECTION_KEY, deletedAt: null },
          take: 1,
        },
      },
    });
    const section = page?.sections[0];
    if (!page || !section)
      throw new NotFoundException({
        code: 'STATS_PILL_NOT_FOUND',
        message: 'This page does not have a statistics pill.',
        details: null,
      });
    return { page, section };
  }

  private async sectionBySlug(pageSlug: string, preview: boolean) {
    const now = new Date();
    return this.prisma.pageSection.findFirst({
      where: {
        sectionKey: STATS_PILL_SECTION_KEY,
        deletedAt: null,
        ...(preview
          ? {}
          : {
              status: { in: ['ACTIVE', 'SCHEDULED'] },
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
              ],
            }),
        page: {
          slug: pageSlug,
          ...(preview
            ? { deletedAt: null }
            : {
                deletedAt: null,
                status: { in: ['PUBLISHED', 'SCHEDULED'] },
                AND: [
                  { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                  { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                ],
              }),
        },
      },
    });
  }

  async count(source: StatsPillSource): Promise<number> {
    const now = new Date();
    const scheduled = {
      status: 'PUBLISHED',
      deletedAt: null,
      AND: [
        { OR: [{ publishStartsAt: null }, { publishStartsAt: { lte: now } }] },
        { OR: [{ publishEndsAt: null }, { publishEndsAt: { gt: now } }] },
      ],
    };
    switch (source) {
      case 'PUBLISHED_COUNTRIES':
        return countCanonicalPublicSlugs(
          await this.prisma.country.findMany({
            where: {
              status: 'PUBLISHED',
              deletedAt: null,
              continent: { status: 'ACTIVE', deletedAt: null },
            },
            select: { slug: true },
          }),
        );
      case 'PUBLISHED_UNIVERSITIES':
        return countCanonicalPublicSlugs(
          await this.prisma.university.findMany({
            where: scheduled,
            select: { slug: true },
          }),
        );
      case 'PUBLISHED_SUBJECTS':
        return countCanonicalPublicSlugs(
          await this.prisma.subject.findMany({
            where: { status: 'PUBLISHED', deletedAt: null },
            select: { slug: true },
          }),
        );
      case 'PUBLISHED_COURSES':
        return countCanonicalPublicSlugs(
          await this.prisma.course.findMany({
            where: scheduled,
            select: { slug: true },
          }),
        );
      case 'PUBLISHED_SCHOLARSHIPS':
        return countCanonicalPublicSlugs(
          await this.prisma.scholarship.findMany({
            where: scheduled,
            select: { slug: true },
          }),
        );
      case 'PUBLISHED_CONSULTANTS':
        return countCanonicalPublicSlugs(
          await this.prisma.consultant.findMany({
            where: scheduled,
            select: { slug: true },
          }),
        );
      case 'COURSE_DESTINATIONS': {
        const rows = await this.prisma.countryCourse.findMany({
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            availabilityStatus: { in: ['AVAILABLE', 'LIMITED'] },
            country: {
              status: 'PUBLISHED',
              deletedAt: null,
              continent: { status: 'ACTIVE', deletedAt: null },
            },
            course: scheduled,
          },
          distinct: ['countryId'],
          select: { countryId: true },
        });
        return rows.length;
      }
    }
  }

  private async resolve(
    config: StatsPillConfig,
  ): Promise<ResolvedStatsPill | null> {
    if (!config.visible) return null;
    const visible = config.items
      .filter((item) => item.visible)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    if (!visible.length) return null;
    const automaticSources = [
      ...new Set(
        visible
          .filter((item) => item.sourceMode === 'AUTOMATIC')
          .map((item) => item.automaticSource),
      ),
    ];
    const counts = new Map<StatsPillSource, number>();
    await Promise.all(
      automaticSources.map(async (source) =>
        counts.set(source, await this.count(source)),
      ),
    );
    return {
      visible: true,
      variant: config.variant,
      icon: config.icon,
      items: visible.map((item) => {
        const value =
          item.sourceMode === 'MANUAL'
            ? item.manualValue!
            : (counts.get(item.automaticSource) ?? 0);
        return {
          id: item.id,
          value,
          label:
            value === 1 && item.singularLabel ? item.singularLabel : item.label,
          displayOrder: item.displayOrder,
        };
      }),
    };
  }

  async publicForPage(pageSlug: string) {
    const section = await this.sectionBySlug(pageSlug, false);
    if (!section?.bodyJson) return null;
    try {
      return this.resolve(parseStatsPillEnvelope(section.bodyJson).published);
    } catch (error) {
      if (error instanceof StatsPillValidationError) return null;
      throw error;
    }
  }

  async previewForPage(pageSlug: string) {
    const section = await this.sectionBySlug(pageSlug, true);
    if (!section?.bodyJson) return null;
    try {
      return this.resolve(parseStatsPillEnvelope(section.bodyJson).draft);
    } catch (error) {
      if (error instanceof StatsPillValidationError) return null;
      throw error;
    }
  }

  async adminGet(pageId: string) {
    const { page, section } = await this.sectionByPageId(pageId);
    let envelope: StatsPillEnvelope;
    try {
      envelope = parseStatsPillEnvelope(section.bodyJson);
    } catch (error) {
      return this.invalid(error);
    }
    const counts = Object.fromEntries(
      await Promise.all(
        STATS_PILL_SOURCES.map(async (source) => [
          source,
          await this.count(source),
        ]),
      ),
    );
    return {
      page: { id: page.id, slug: page.slug, title: page.title },
      section: {
        id: section.id,
        displayOrder: section.displayOrder,
        status: section.status,
      },
      draft: envelope.draft,
      published: envelope.published,
      sources: STATS_PILL_SOURCES.map((value) => ({
        value,
        label: sourceLabels[value],
        count: counts[value],
      })),
    };
  }

  async saveDraft(pageId: string, input: unknown, actorUserId?: string | null) {
    const { section } = await this.sectionByPageId(pageId);
    try {
      const envelope = parseStatsPillEnvelope(section.bodyJson);
      const draft = parseStatsPillConfig(input);
      await this.prisma.pageSection.update({
        where: { id: section.id },
        data: { bodyJson: { ...envelope, draft } as never },
      });
      return {
        sectionId: section.id,
        draft,
        savedByUserId: actorUserId ?? null,
      };
    } catch (error) {
      return this.invalid(error);
    }
  }

  async publish(pageId: string, actorUserId?: string | null) {
    const { section } = await this.sectionByPageId(pageId);
    try {
      const envelope = parseStatsPillEnvelope(section.bodyJson);
      const published = parseStatsPillConfig(envelope.draft);
      await this.prisma.pageSection.update({
        where: { id: section.id },
        data: {
          bodyJson: { ...envelope, published } as never,
          // PageSection.status remains the canonical whole-block visibility
          // predicate. The structured flag is retained in the published
          // snapshot so Preview and a later re-enable remain lossless.
          status: published.visible ? 'ACTIVE' : 'ARCHIVED',
        },
      });
      return {
        sectionId: section.id,
        published,
        publishedByUserId: actorUserId ?? null,
      };
    } catch (error) {
      return this.invalid(error);
    }
  }
}
