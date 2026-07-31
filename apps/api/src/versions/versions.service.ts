import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Version history and restore for Website Builder content.
 *
 * Design notes worth keeping in mind when extending this:
 *
 *  - `versionNumber` is monotonic per resource and a restore *appends*. There
 *    is deliberately no code path that deletes or renumbers a version, so
 *    restoring an old state can never destroy the states after it.
 *  - Snapshots are full states, not diffs, so a restore is a write of known
 *    values rather than a replay. Snapshots are validated before being applied.
 *  - Restoring never changes publication. A restored page keeps whatever
 *    status it currently has: publishing is a separate, deliberate action, and
 *    silently pushing an old draft live would be the worst possible surprise.
 */

export const VERSIONED_RESOURCES = [
  'PAGE',
  'PAGE_SECTION',
  'PAGE_TEMPLATE',
  'GLOBAL_HEADER',
  'GLOBAL_FOOTER',
] as const;
export type VersionedResource = (typeof VERSIONED_RESOURCES)[number];

/** Fields captured per resource type. Anything not listed is either derived
 * (timestamps, ids) or a relation restored separately (page sections). */
const PAGE_FIELDS = [
  'pageType',
  'title',
  'shortTitle',
  'slug',
  'layoutKey',
  'templateId',
  'shortDescription',
  'status',
  'isHomepage',
  'displayOrder',
  'startsAt',
  'endsAt',
] as const;

const SECTION_FIELDS = [
  'sectionKey',
  'sectionType',
  'eyebrow',
  'heading',
  'subheading',
  'bodyJson',
  'mediaId',
  'backgroundMediaId',
  'ctaPrimaryLabel',
  'ctaPrimaryUrl',
  'ctaSecondaryLabel',
  'ctaSecondaryUrl',
  'configurationJson',
  'displayOrder',
  'status',
  'startsAt',
  'endsAt',
] as const;

const TEMPLATE_FIELDS = [
  'name',
  'templateKey',
  'description',
  'pageFamily',
  'defaultSectionsJson',
  'layoutConfigJson',
  'isActive',
] as const;

function pick<T extends object>(source: T, fields: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const field of fields)
    out[field] = (source as Record<string, unknown>)[field] ?? null;
  return out;
}

export type RecordVersionInput = {
  resourceType: VersionedResource;
  resourceId: string;
  changeSummary: string;
  sourceAction: string;
  actorUserId?: string | null;
  restoredFromVersion?: number | null;
};

@Injectable()
export class VersionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reads the current state of a resource in snapshot form. */
  private async snapshot(resourceType: VersionedResource, resourceId: string) {
    if (resourceType === 'PAGE') {
      const page = await this.prisma.page.findFirst({
        where: { id: resourceId, deletedAt: null },
        include: {
          sections: {
            where: { deletedAt: null },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      if (!page) return null;
      return {
        ...pick(page, PAGE_FIELDS),
        // Section order is part of the page's state, so a page version can
        // restore a reorder even though each section also versions itself.
        sections: page.sections.map((section) => ({
          id: section.id,
          ...pick(section, SECTION_FIELDS),
        })),
      };
    }
    if (resourceType === 'PAGE_SECTION') {
      const section = await this.prisma.pageSection.findFirst({
        where: { id: resourceId, deletedAt: null },
      });
      return section
        ? { pageId: section.pageId, ...pick(section, SECTION_FIELDS) }
        : null;
    }
    if (resourceType === 'PAGE_TEMPLATE') {
      const template = await this.prisma.pageTemplate.findFirst({
        where: { id: resourceId, deletedAt: null },
      });
      return template ? pick(template, TEMPLATE_FIELDS) : null;
    }
    // GLOBAL_HEADER / GLOBAL_FOOTER: resourceId is the settings group key.
    const settings = await this.prisma.siteSetting.findMany({
      where: { settingGroup: resourceId },
      orderBy: { settingKey: 'asc' },
    });
    if (!settings.length) return null;
    return {
      settingGroup: resourceId,
      settings: settings.map((setting) => ({
        settingKey: setting.settingKey,
        valueType: setting.valueType,
        valueJson: setting.valueJson,
        isPublic: setting.isPublic,
        description: setting.description,
      })),
    };
  }

  /** Captures the resource's current state as the next version.
   *
   * Called *after* a successful write, so the newest version always equals the
   * live state and "restore version N" means "make the live state equal N". */
  async record(input: RecordVersionInput) {
    const snapshot = await this.snapshot(input.resourceType, input.resourceId);
    // A resource that no longer exists (or a settings group never written)
    // has nothing to version. Silently skipping keeps callers from having to
    // guard every write site.
    if (!snapshot) return null;

    const latest = await this.prisma.contentVersion.findFirst({
      where: { resourceType: input.resourceType, resourceId: input.resourceId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return this.prisma.contentVersion.create({
      data: {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        snapshotJson: snapshot as never,
        changeSummary: input.changeSummary.slice(0, 500),
        sourceAction: input.sourceAction.slice(0, 60),
        restoredFromVersion: input.restoredFromVersion ?? null,
        createdByUserId: input.actorUserId ?? null,
      },
    });
  }

  /** Records the current state as version 1 if the resource has no history.
   *
   * Called *before* a write. Without it the very first edit would be
   * unrecoverable: versions are captured after a write, so the state that
   * existed before the first-ever edit would never be stored anywhere. */
  async ensureBaseline(
    resourceType: VersionedResource,
    resourceId: string,
    actorUserId?: string,
  ) {
    const existing = await this.prisma.contentVersion.count({
      where: { resourceType, resourceId },
    });
    if (existing > 0) return null;
    return this.record({
      resourceType,
      resourceId,
      changeSummary: 'Initial state, captured before the first tracked edit',
      sourceAction: 'baseline',
      actorUserId,
    });
  }

  /** Newest first, so the Admin list opens on the most recent change. */
  async list(resourceType: VersionedResource, resourceId: string, limit = 50) {
    const rows = await this.prisma.contentVersion.findMany({
      where: { resourceType, resourceId },
      orderBy: { versionNumber: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      versionNumber: row.versionNumber,
      changeSummary: row.changeSummary,
      sourceAction: row.sourceAction,
      restoredFromVersion: row.restoredFromVersion,
      createdAt: row.createdAt,
      createdBy: row.createdBy
        ? {
            id: row.createdBy.id,
            name: [row.createdBy.firstName, row.createdBy.lastName]
              .filter(Boolean)
              .join(' '),
            email: row.createdBy.email,
          }
        : null,
      snapshot: row.snapshotJson,
    }));
  }

  private async require(
    resourceType: VersionedResource,
    resourceId: string,
    versionNumber: number,
  ) {
    const version = await this.prisma.contentVersion.findFirst({
      where: { resourceType, resourceId, versionNumber },
    });
    if (!version)
      throw new NotFoundException({
        code: 'VERSION_NOT_FOUND',
        message: `Version ${versionNumber} does not exist for this item.`,
        details: null,
      });
    return version;
  }

  /** Field-by-field comparison, so the Admin can show a readable diff table
   * instead of two blobs of JSON. */
  async compare(
    resourceType: VersionedResource,
    resourceId: string,
    fromVersion: number,
    toVersion: number,
  ) {
    const [from, to] = await Promise.all([
      this.require(resourceType, resourceId, fromVersion),
      this.require(resourceType, resourceId, toVersion),
    ]);
    const left = (from.snapshotJson ?? {}) as Record<string, unknown>;
    const right = (to.snapshotJson ?? {}) as Record<string, unknown>;
    const keys = [
      ...new Set([...Object.keys(left), ...Object.keys(right)]),
    ].sort();
    const changes = keys
      .map((field) => ({
        field,
        from: left[field] ?? null,
        to: right[field] ?? null,
      }))
      .filter(
        (entry) => JSON.stringify(entry.from) !== JSON.stringify(entry.to),
      );
    return {
      from: { versionNumber: from.versionNumber, createdAt: from.createdAt },
      to: { versionNumber: to.versionNumber, createdAt: to.createdAt },
      changes,
      identical: changes.length === 0,
    };
  }

  private validate(resourceType: VersionedResource, snapshot: unknown) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
      throw new BadRequestException({
        code: 'VERSION_SNAPSHOT_INVALID',
        message:
          'That version cannot be restored because its saved snapshot is unreadable.',
        details: null,
      });
    const data = snapshot as Record<string, unknown>;
    const required: Record<VersionedResource, string[]> = {
      PAGE: ['title', 'slug', 'pageType'],
      PAGE_SECTION: ['sectionKey', 'sectionType'],
      PAGE_TEMPLATE: ['name', 'templateKey', 'pageFamily'],
      GLOBAL_HEADER: ['settings'],
      GLOBAL_FOOTER: ['settings'],
    };
    for (const field of required[resourceType]) {
      if (data[field] === undefined || data[field] === null)
        throw new BadRequestException({
          code: 'VERSION_SNAPSHOT_INVALID',
          message: `That version cannot be restored because it is missing "${field}".`,
          details: null,
        });
    }
    return data;
  }

  /** Writes a stored snapshot back over the live resource and records the
   * result as a new version. Publication state is never changed. */
  async restore(
    resourceType: VersionedResource,
    resourceId: string,
    versionNumber: number,
    actorUserId?: string,
  ) {
    const version = await this.require(resourceType, resourceId, versionNumber);
    const snapshot = this.validate(resourceType, version.snapshotJson);

    if (resourceType === 'PAGE') {
      const page = await this.prisma.page.findFirst({
        where: { id: resourceId, deletedAt: null },
        select: { status: true, publishedAt: true },
      });
      if (!page)
        throw new NotFoundException({
          code: 'PAGE_NOT_FOUND',
          message: 'That page no longer exists.',
          details: null,
        });
      const data: Record<string, unknown> = {};
      for (const field of PAGE_FIELDS) {
        // status is excluded on purpose: restoring content must not publish
        // or unpublish anything.
        if (field === 'status') continue;
        if (field in snapshot) data[field] = snapshot[field];
      }
      data.updatedByUserId = actorUserId ?? null;
      await this.prisma.page.update({
        where: { id: resourceId },
        data: data as never,
      });

      const sections = Array.isArray(snapshot.sections)
        ? (snapshot.sections as Array<Record<string, unknown>>)
        : [];
      // Only sections that still exist are touched. Restoring must not
      // resurrect a deleted section as a half-formed row, and must not delete
      // sections added since the snapshot -- both would be surprising.
      for (const entry of sections) {
        const id = typeof entry.id === 'string' ? entry.id : null;
        if (!id) continue;
        const exists = await this.prisma.pageSection.findFirst({
          where: { id, pageId: resourceId, deletedAt: null },
          select: { id: true },
        });
        if (!exists) continue;
        const sectionData: Record<string, unknown> = {};
        for (const field of SECTION_FIELDS) {
          if (field === 'status') continue;
          if (field in entry) sectionData[field] = entry[field];
        }
        await this.prisma.pageSection.update({
          where: { id },
          data: sectionData as never,
        });
      }
    } else if (resourceType === 'PAGE_SECTION') {
      const existing = await this.prisma.pageSection.findFirst({
        where: { id: resourceId, deletedAt: null },
        select: { id: true },
      });
      if (!existing)
        throw new NotFoundException({
          code: 'SECTION_NOT_FOUND',
          message: 'That section no longer exists.',
          details: null,
        });
      const data: Record<string, unknown> = {};
      for (const field of SECTION_FIELDS) {
        if (field === 'status') continue;
        if (field in snapshot) data[field] = snapshot[field];
      }
      await this.prisma.pageSection.update({
        where: { id: resourceId },
        data: data as never,
      });
    } else if (resourceType === 'PAGE_TEMPLATE') {
      const existing = await this.prisma.pageTemplate.findFirst({
        where: { id: resourceId, deletedAt: null },
        select: { id: true },
      });
      if (!existing)
        throw new NotFoundException({
          code: 'TEMPLATE_NOT_FOUND',
          message: 'That template no longer exists.',
          details: null,
        });
      const data: Record<string, unknown> = {};
      for (const field of TEMPLATE_FIELDS) {
        // isActive is this model's publication switch, so it is preserved for
        // the same reason page status is.
        if (field === 'isActive') continue;
        if (field in snapshot) data[field] = snapshot[field];
      }
      data.updatedByUserId = actorUserId ?? null;
      await this.prisma.pageTemplate.update({
        where: { id: resourceId },
        data: data as never,
      });
    } else {
      const settings = Array.isArray(snapshot.settings)
        ? (snapshot.settings as Array<Record<string, unknown>>)
        : [];
      for (const setting of settings) {
        const key =
          typeof setting.settingKey === 'string' ? setting.settingKey : null;
        if (!key) continue;
        await this.prisma.siteSetting.updateMany({
          where: { settingKey: key },
          data: {
            valueJson: (setting.valueJson ?? null) as never,
            updatedByUserId: actorUserId ?? null,
          },
        });
      }
    }

    const created = await this.record({
      resourceType,
      resourceId,
      changeSummary: `Restored version ${versionNumber}`,
      sourceAction: 'restore',
      actorUserId,
      restoredFromVersion: versionNumber,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId ?? null,
        module: 'website-builder',
        entityType: resourceType,
        entityId: resourceType.startsWith('GLOBAL_') ? null : resourceId,
        action: 'RESTORE_VERSION',
        newValues: {
          restoredFromVersion: versionNumber,
          newVersionNumber: created?.versionNumber ?? null,
        } as never,
        description: `Restored ${resourceType} ${resourceId} to version ${versionNumber}`,
      },
    });

    return {
      restoredFromVersion: versionNumber,
      newVersion: created?.versionNumber ?? null,
    };
  }
}
