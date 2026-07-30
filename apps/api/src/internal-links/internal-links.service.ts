import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type EntityType =
  | 'country'
  | 'university'
  | 'scholarship'
  | 'consultant'
  | 'job'
  | 'event'
  | 'course';

interface EntityConfig {
  prefix: string;
  titleField: 'name' | 'title';
  publishedStatuses: string[];
}

/** The public path prefix, display-title field, and "counts as published"
 * statuses for every entity type the internal link picker can point at.
 * Kept in one place so search/resolve/public-resolve all agree on what a
 * canonical URL and a "published" target actually mean per entity. */
const ENTITY_CONFIG: Record<EntityType, EntityConfig> = {
  country: { prefix: '/countries', titleField: 'name', publishedStatuses: ['PUBLISHED'] },
  university: { prefix: '/universities', titleField: 'name', publishedStatuses: ['PUBLISHED'] },
  scholarship: { prefix: '/scholarships', titleField: 'title', publishedStatuses: ['PUBLISHED'] },
  consultant: {
    prefix: '/study-abroad-consultants',
    titleField: 'name',
    publishedStatuses: ['PUBLISHED'],
  },
  job: { prefix: '/careers', titleField: 'title', publishedStatuses: ['PUBLISHED'] },
  event: { prefix: '/events', titleField: 'title', publishedStatuses: ['PUBLISHED'] },
  course: { prefix: '/courses', titleField: 'name', publishedStatuses: ['PUBLISHED'] },
};
const ENTITY_TYPES = Object.keys(ENTITY_CONFIG) as EntityType[];

export interface InternalLinkCandidate {
  entityType: EntityType;
  entityId: string;
  label: string;
  slug: string;
  status: string;
  path: string;
}

export interface InternalLinkResolution {
  missing: boolean;
  entityType: EntityType;
  entityId: string;
  label: string | null;
  slug: string | null;
  status: string | null;
  isPublished: boolean;
  path: string | null;
}

function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as string[]).includes(value);
}

@Injectable()
export class InternalLinksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin search: visible regardless of publish status, so an editor can
   * link to (and see the warning for) a not-yet-published record. */
  async search(
    q: string,
    entityType?: string,
  ): Promise<InternalLinkCandidate[]> {
    const types = entityType && isEntityType(entityType) ? [entityType] : ENTITY_TYPES;
    const results = await Promise.all(
      types.map((type) => this.searchOne(type, q)),
    );
    return results.flat().slice(0, 25);
  }

  private async searchOne(
    type: EntityType,
    q: string,
  ): Promise<InternalLinkCandidate[]> {
    const config = ENTITY_CONFIG[type];
    // Prisma's generated delegates are selected by a validated entity type.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = (this.prisma as any)[type];
    const rows = await delegate.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? { OR: [{ [config.titleField]: { contains: q } }, { slug: { contains: q } }] }
          : {}),
      },
      select: { id: true, slug: true, status: true, [config.titleField]: true },
      orderBy: { [config.titleField]: 'asc' },
      take: 8,
    });
    return rows.map((row: Record<string, unknown>) => ({
      entityType: type,
      entityId: String(row.id),
      label: String(row[config.titleField]),
      slug: String(row.slug),
      status: String(row.status),
      path: `${config.prefix}/${String(row.slug)}`,
    }));
  }

  /** Admin resolve: recomputes the canonical path from the entity's
   * *current* slug (so a stored `internal://type/id` reference never goes
   * stale after a rename) and reports whether it is missing or unpublished
   * so the editor sees a warning instead of a silently broken link. */
  async resolve(
    entityType: string,
    entityId: string,
  ): Promise<InternalLinkResolution> {
    if (!isEntityType(entityType) || !entityId)
      return {
        missing: true,
        entityType: (entityType as EntityType) ?? 'country',
        entityId,
        label: null,
        slug: null,
        status: null,
        isPublished: false,
        path: null,
      };
    const config = ENTITY_CONFIG[entityType];
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = (this.prisma as any)[entityType];
    const row = await delegate.findFirst({
      where: { id: entityId, deletedAt: null },
      select: { id: true, slug: true, status: true, [config.titleField]: true },
    });
    if (!row)
      return {
        missing: true,
        entityType,
        entityId,
        label: null,
        slug: null,
        status: null,
        isPublished: false,
        path: null,
      };
    const isPublished = config.publishedStatuses.includes(String(row.status));
    return {
      missing: false,
      entityType,
      entityId,
      label: String(row[config.titleField]),
      slug: String(row.slug),
      status: String(row.status),
      isPublished,
      path: `${config.prefix}/${String(row.slug)}`,
    };
  }

  /** Public resolve: only ever returns a path for a currently-published
   * target. A visitor must never be handed a link into draft content, even
   * if the admin who authored the link left it pointing at one. */
  async resolvePublic(
    entityType: string,
    entityId: string,
  ): Promise<{ path: string | null }> {
    const resolved = await this.resolve(entityType, entityId);
    return { path: resolved.isPublished ? resolved.path : null };
  }
}
