import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import { slugify } from '../catalog/catalog.constants';
import { PrismaService } from '../prisma/prisma.service';
import { DbNull } from '../generated/prisma/internal/prismaNamespaceBrowser';
import { parseChromeConfig } from '../settings/chrome-overrides';

export const PAGE_FAMILIES = [
  'HOME',
  'DIRECTORY_LISTING',
  'ENTITY_DETAIL',
  'UNIVERSITY_DETAIL',
  'UNIVERSITY_COURSES_LISTING',
  'UNIVERSITY_COURSE_OFFERING_DETAIL',
  'SUBJECT_LISTING',
  'SUBJECT_DETAIL',
  'SCHOLARSHIP_LISTING',
  'SCHOLARSHIP_DETAIL',
  'COUNSELLING_FORM',
  'EDITORIAL_PAGE',
  'COMPARISON_PAGE',
] as const;
export type PageFamily = (typeof PAGE_FAMILIES)[number];

// Kept in lockstep with ExpandedService.SECTION_TYPES
// (apps/api/src/expanded/expanded.service.ts) -- the actual page/section
// renderer's allow-list. A template that used a type the renderer doesn't
// know would fail validation there when its sections are applied.
const SECTION_TYPES = new Set([
  'HERO',
  'RICH_TEXT',
  'CTA',
  'IMAGE',
  'IMAGE_TEXT',
  'CARD_GRID',
  'STATS',
  'FAQ_GROUP',
  'RELATED_LINKS',
  'COUNTRY_DIRECTORY',
  'UNIVERSITY_DIRECTORY',
  'COURSE_DIRECTORY',
  'SCHOLARSHIP_DIRECTORY',
  'CONSULTANT_DIRECTORY',
  'TESTIMONIALS',
  'SUCCESS_STORIES',
  'LEAD_GENERATION',
  'CUSTOM',
]);

type TemplateSection = {
  sectionKey: string;
  sectionType: string;
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  displayOrder: number;
};

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

function validateSections(value: unknown): TemplateSection[] {
  if (!Array.isArray(value))
    throw new BadRequestException({
      code: 'TEMPLATE_SECTIONS_INVALID',
      message: 'defaultSections must be an array',
      details: null,
    });
  if (value.length > 40)
    throw new BadRequestException({
      code: 'TEMPLATE_SECTIONS_TOO_LARGE',
      message: 'A template supports at most 40 default sections',
      details: null,
    });
  const seenKeys = new Set<string>();
  return value.map((raw, index) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const sectionType =
      typeof row.sectionType === 'string' ? row.sectionType : '';
    if (!SECTION_TYPES.has(sectionType))
      throw new BadRequestException({
        code: 'TEMPLATE_SECTION_TYPE_INVALID',
        message: `Section ${index + 1} has an unknown sectionType`,
        details: null,
      });
    const heading = typeof row.heading === 'string' ? row.heading.trim() : '';
    const rawKey =
      typeof row.sectionKey === 'string' && row.sectionKey.trim()
        ? row.sectionKey.trim()
        : slugify(heading || sectionType) || `section-${index + 1}`;
    let sectionKey = rawKey;
    let suffix = 2;
    while (seenKeys.has(sectionKey)) sectionKey = `${rawKey}-${suffix++}`;
    seenKeys.add(sectionKey);
    return {
      sectionKey,
      sectionType,
      eyebrow: typeof row.eyebrow === 'string' ? row.eyebrow.trim() : undefined,
      heading: heading || undefined,
      subheading:
        typeof row.subheading === 'string' ? row.subheading.trim() : undefined,
      displayOrder:
        typeof row.displayOrder === 'number' ? row.displayOrder : index,
    };
  });
}

@Injectable()
export class PageTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { pageFamily?: string; includeArchived?: boolean }) {
    return this.prisma.pageTemplate.findMany({
      where: {
        ...(query.includeArchived ? {} : { deletedAt: null }),
        ...(query.pageFamily ? { pageFamily: query.pageFamily } : {}),
      },
      include: { _count: { select: { pages: true } } },
      orderBy: [{ pageFamily: 'asc' }, { name: 'asc' }],
    });
  }

  async detail(id: string) {
    const row = await this.prisma.pageTemplate.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { pages: true } } },
    });
    if (!row)
      throw new NotFoundException({
        code: 'PAGE_TEMPLATE_NOT_FOUND',
        message: 'Page template not found',
        details: null,
      });
    return row;
  }

  async create(
    body: {
      name: string;
      templateKey?: string;
      description?: string | null;
      pageFamily: string;
      defaultSections: unknown;
      layoutConfig?: Record<string, unknown> | null;
      isActive?: boolean;
    },
    actorUserId?: string,
  ) {
    if (!PAGE_FAMILIES.includes(body.pageFamily as PageFamily))
      throw new BadRequestException({
        code: 'PAGE_TEMPLATE_FAMILY_INVALID',
        message: 'Unknown page family',
        details: null,
      });
    const sections = validateSections(body.defaultSections);
    const templateKey = body.templateKey?.trim() || slugify(body.name);
    try {
      return await this.prisma.pageTemplate.create({
        data: {
          name: body.name.trim(),
          templateKey,
          description: body.description || null,
          pageFamily: body.pageFamily,
          defaultSectionsJson: sections,
          layoutConfigJson: body.layoutConfig as
            Prisma.InputJsonValue | undefined,
          isActive: body.isActive ?? true,
          createdByUserId: actorUserId ?? null,
          updatedByUserId: actorUserId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'PAGE_TEMPLATE_KEY_TAKEN',
          message: 'A template with this key already exists',
          details: null,
        });
      throw error;
    }
  }

  async update(
    id: string,
    body: {
      name?: string;
      templateKey?: string;
      description?: string | null;
      pageFamily?: string;
      defaultSections?: unknown;
      layoutConfig?: Record<string, unknown> | null;
      isActive?: boolean;
      /** Structured Header/Footer override applied to every dynamic page
       * rendered from this template. Validated, never stored raw. */
      chrome?: unknown;
    },
    actorUserId?: string,
  ) {
    await this.detail(id);
    if (
      body.pageFamily !== undefined &&
      !PAGE_FAMILIES.includes(body.pageFamily as PageFamily)
    )
      throw new BadRequestException({
        code: 'PAGE_TEMPLATE_FAMILY_INVALID',
        message: 'Unknown page family',
        details: null,
      });
    const sections =
      body.defaultSections !== undefined
        ? validateSections(body.defaultSections)
        : undefined;
    try {
      return await this.prisma.pageTemplate.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.templateKey !== undefined
            ? { templateKey: body.templateKey.trim() }
            : {}),
          ...(body.description !== undefined
            ? { description: body.description || null }
            : {}),
          ...(body.chrome !== undefined
            ? { chromeConfigJson: parseChromeConfig(body.chrome) ?? DbNull }
            : {}),
          ...(body.pageFamily !== undefined
            ? { pageFamily: body.pageFamily }
            : {}),
          ...(sections !== undefined
            ? {
                defaultSectionsJson: sections,
              }
            : {}),
          ...(body.layoutConfig !== undefined
            ? {
                layoutConfigJson: body.layoutConfig as
                  Prisma.InputJsonValue | undefined,
              }
            : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          updatedByUserId: actorUserId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'PAGE_TEMPLATE_KEY_TAKEN',
          message: 'A template with this key already exists',
          details: null,
        });
      throw error;
    }
  }

  async duplicate(id: string, actorUserId?: string) {
    const source = await this.detail(id);
    let templateKey = `${source.templateKey}-copy`;
    let suffix = 2;
    while (
      await this.prisma.pageTemplate.findUnique({ where: { templateKey } })
    )
      templateKey = `${source.templateKey}-copy-${suffix++}`;
    return this.prisma.pageTemplate.create({
      data: {
        name: `${source.name} (copy)`,
        templateKey,
        description: source.description,
        pageFamily: source.pageFamily,
        defaultSectionsJson: source.defaultSectionsJson ?? [],
        layoutConfigJson: source.layoutConfigJson ?? undefined,
        isActive: false,
        createdByUserId: actorUserId ?? null,
        updatedByUserId: actorUserId ?? null,
      },
    });
  }

  async archive(id: string) {
    await this.detail(id);
    return this.prisma.pageTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /** Assigning only ever sets Page.templateId -- it never touches
   * PageSection rows, so existing page-specific content is always
   * preserved. Applying the template's default sections is a separate,
   * explicit action (applyDefaults) so an admin can preview first. */
  async assignToPage(pageId: string, templateId: string | null) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
    });
    if (!page)
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Page not found',
        details: null,
      });
    if (templateId) {
      const template = await this.prisma.pageTemplate.findFirst({
        where: { id: templateId, deletedAt: null },
      });
      if (!template)
        throw new BadRequestException({
          code: 'PAGE_TEMPLATE_NOT_FOUND',
          message: 'Selected template does not exist',
          details: null,
        });
      if (!template.isActive)
        throw new BadRequestException({
          code: 'PAGE_TEMPLATE_ARCHIVED',
          message: 'Archived templates cannot be assigned to a page',
          details: null,
        });
    }
    return this.prisma.page.update({
      where: { id: pageId },
      data: { templateId },
      include: { template: true },
    });
  }

  /** Assigns the template (when one is supplied) and applies its default
   * sections in a single action, so the admin has one intentional
   * "Apply template" step rather than a save-then-apply sequence.
   *
   * Never destructive: a key the page already uses keeps its existing
   * content untouched and is reported as skipped.
   *
   * The `[pageId, sectionKey]` unique index does not exclude soft-deleted
   * rows, so a key belonging to a previously deleted section still
   * occupies the index. Filtering only on live sections therefore used to
   * send that key to `createMany`, which collided with the surviving row
   * and surfaced as a bare Internal server error -- permanently wedging
   * any page whose template sections had been deleted. Those rows are
   * revived in place instead, which is also what an admin means by
   * re-applying a template after clearing it out. */
  async applyTemplateToPage(pageId: string, templateId?: string | null) {
    if (templateId !== undefined) await this.assignToPage(pageId, templateId);
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
      include: {
        template: true,
        sections: {
          select: {
            id: true,
            sectionKey: true,
            displayOrder: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!page)
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Page not found',
        details: null,
      });
    if (!page.template)
      throw new BadRequestException({
        code: 'PAGE_TEMPLATE_NOT_ASSIGNED',
        message: 'Select a template before applying it to this page',
        details: null,
      });

    const live = page.sections.filter((s) => !s.deletedAt);
    const removedByKey = new Map(
      page.sections.filter((s) => s.deletedAt).map((s) => [s.sectionKey, s]),
    );
    const liveKeys = new Set(live.map((s) => s.sectionKey));
    let nextOrder =
      live.reduce((max, s) => Math.max(max, s.displayOrder), -1) + 1;

    const defaults =
      (page.template.defaultSectionsJson as unknown as TemplateSection[]) ?? [];
    const toCreate: TemplateSection[] = [];
    const toRevive: { id: string; section: TemplateSection }[] = [];
    let skipped = 0;
    for (const section of defaults) {
      if (liveKeys.has(section.sectionKey)) {
        skipped += 1;
        continue;
      }
      const removed = removedByKey.get(section.sectionKey);
      if (removed) toRevive.push({ id: removed.id, section });
      else toCreate.push(section);
    }

    if (toCreate.length)
      await this.prisma.pageSection.createMany({
        data: toCreate.map((section) => ({
          id: randomUUID(),
          pageId,
          sectionKey: section.sectionKey,
          sectionType: section.sectionType,
          eyebrow: section.eyebrow ?? null,
          heading: section.heading ?? null,
          subheading: section.subheading ?? null,
          displayOrder: nextOrder++,
          status: 'ACTIVE',
        })),
      });
    for (const { id, section } of toRevive)
      await this.prisma.pageSection.update({
        where: { id },
        data: {
          deletedAt: null,
          sectionType: section.sectionType,
          eyebrow: section.eyebrow ?? null,
          heading: section.heading ?? null,
          subheading: section.subheading ?? null,
          displayOrder: nextOrder++,
          status: 'ACTIVE',
        },
      });

    return {
      created: toCreate.length,
      restored: toRevive.length,
      skipped,
      templateId: page.template.id,
      templateName: page.template.name,
    };
  }
}
