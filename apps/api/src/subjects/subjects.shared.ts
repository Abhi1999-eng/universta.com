import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { catalogConflict } from '../catalog/catalog.errors';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { SeoMetadataDto } from './dto/subject.dto';

/**
 * Helpers the subjects service and the level-pages service share: who is
 * acting, version checks, pictures, and an SEO row read and written the same
 * way for a subject, a specialization and a level page.
 */

export const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  altText: true,
  title: true,
  width: true,
  height: true,
  status: true,
  deletedAt: true,
} as const;

export type MediaRecord = {
  id: string;
  publicUrl: string;
  altText: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  status: string;
  deletedAt: Date | null;
} | null;

export function actorId(request: AuthenticatedRequest): string {
  const id = request.user?.sub;
  if (!id)
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Super Admin access is required',
      details: null,
    });
  return id;
}

export function media(record: MediaRecord) {
  return record && record.status === 'ACTIVE' && !record.deletedAt
    ? {
        id: record.id,
        url: record.publicUrl,
        alt: record.altText ?? record.title ?? '',
        title: record.title,
        width: record.width,
        height: record.height,
      }
    : null;
}

export function versionMatches(
  current: Date,
  expected: string | undefined,
  code: string,
): void {
  if (expected && current.getTime() !== new Date(expected).getTime())
    throw catalogConflict(
      code,
      'The record changed in another session. Reload before saving',
    );
}

/** The pictures chosen for a record must be live images. */
export async function assertActiveImages(
  prisma: PrismaService,
  ids: Array<string | null | undefined>,
): Promise<void> {
  const requested = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!requested.length) return;
  const count = await prisma.mediaAsset.count({
    where: {
      id: { in: requested },
      status: 'ACTIVE',
      mediaType: 'IMAGE',
      deletedAt: null,
    },
  });
  if (count !== requested.length)
    throw catalogConflict(
      'MEDIA_INVALID',
      'Selected media is not an active image',
    );
}

/* A canonical URL is an http(s) address or a path on this site
   ("/subjects/computing"). The admin's editor has always offered the path
   form and the SEO resolver accepts it, but this check refused it, so the
   save failed after the record itself was written. */
export function validUrl(value: string | undefined | null): boolean {
  return !value || /^https?:\/\//i.test(value) || /^\/(?!\/)\S*$/.test(value);
}

/** An SEO row as the admin and the resolver read it. */
export function toSeo(row: any) {
  return row
    ? {
        id: row.id,
        ownerType: row.ownerType,
        ownerId: row.ownerId,
        seoTitle: row.seoTitle,
        metaDescription: row.metaDescription,
        canonicalUrl: row.canonicalUrl,
        focusKeyword: row.focusKeyword,
        ogTitle: row.ogTitle,
        ogDescription: row.ogDescription,
        /* The admin's editor fills its image pickers from these ids. Without
           them, saving the SEO again sent no image and dropped the one
           chosen before. */
        ogMediaId: row.ogMediaId ?? null,
        twitterTitle: row.twitterTitle,
        twitterDescription: row.twitterDescription,
        twitterMediaId: row.twitterMediaId ?? null,
        robotsIndex: row.robotsIndex,
        robotsFollow: row.robotsFollow,
        schemaJson: row.schemaJson,
        hreflangJson: row.hreflangJson,
        ogMedia: media(row.ogMedia),
        twitterMedia: media(row.twitterMedia),
        createdAt: row.createdAt?.toISOString(),
        updatedAt: row.updatedAt?.toISOString(),
      }
    : null;
}

/**
 * An SEO row written whole from what was sent, for the create and the update
 * of an upsert alike. Every caller sends the editor's whole form, and the
 * editor leaves a field it cleared out of the body: an optional field left
 * out, empty or null is written as null. Written as undefined it was skipped
 * by the update, and a cleared canonical URL or image came back after the
 * save. The JSON columns are not on the editor's form and stay as they are
 * unless sent.
 */
export function seoData(
  ownerId: string,
  ownerType: string,
  dto: Omit<SeoMetadataDto, 'expectedUpdatedAt'>,
): Prisma.SeoMetadataUncheckedCreateInput {
  return {
    ownerId,
    ownerType,
    seoTitle: dto.seoTitle.trim(),
    metaDescription: dto.metaDescription.trim(),
    canonicalUrl: dto.canonicalUrl?.trim() || null,
    focusKeyword: dto.focusKeyword?.trim() || null,
    ogTitle: dto.ogTitle?.trim() || null,
    ogDescription: dto.ogDescription?.trim() || null,
    ogMediaId: dto.ogMediaId || null,
    twitterTitle: dto.twitterTitle?.trim() || null,
    twitterDescription: dto.twitterDescription?.trim() || null,
    twitterMediaId: dto.twitterMediaId || null,
    robotsIndex: dto.robotsIndex ?? true,
    robotsFollow: dto.robotsFollow ?? true,
    schemaJson: dto.schemaJson as Prisma.InputJsonValue | undefined,
    hreflangJson: dto.hreflangJson as Prisma.InputJsonValue | undefined,
  };
}
