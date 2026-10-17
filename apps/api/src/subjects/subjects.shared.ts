import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { catalogConflict } from '../catalog/catalog.errors';
import { isUniqueConstraintError } from '../catalog/catalog.constants';
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

/* A row saved without a title or a description keeps them as empty text
   (the columns are not nullable); every reader is handed null, which the
   resolver and the admin's editor both read as "not written". */
export function seoText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** An SEO row as the admin and the resolver read it. */
export function toSeo(row: any) {
  return row
    ? {
        id: row.id,
        ownerType: row.ownerType,
        ownerId: row.ownerId,
        seoTitle: seoText(row.seoTitle),
        metaDescription: seoText(row.metaDescription),
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
    /* Empty when not written: a robots-only row (see SeoMetadataDto). */
    seoTitle: dto.seoTitle?.trim() ?? '',
    metaDescription: dto.metaDescription?.trim() ?? '',
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

export const SEO_STALE_MESSAGE =
  'The SEO changed in another session. Reload before saving';

/**
 * Saves a record's SEO row, checked against the version its editor read.
 *
 * `expectedUpdatedAt` is the row's `updatedAt` from that read: null says
 * "there was no row", so a row written since is a conflict, and a version
 * for a row deleted since is one too. Left out, nothing is checked and the
 * row is upserted as it always was. The check is made by the write itself
 * -- the update lands only while the row is still the one read -- so two
 * saves that both passed the read cannot both land.
 *
 * Returns the row as it was before (for the audit log) and as it is now,
 * with its pictures, for the response.
 */
export async function writeSeoRow(
  prisma: PrismaService,
  ownerType: string,
  ownerId: string,
  dto: SeoMetadataDto,
) {
  const key = { ownerType_ownerId: { ownerType, ownerId } };
  const data = seoData(ownerId, ownerType, dto);
  const include = {
    ogMedia: { select: MEDIA_SELECT },
    twitterMedia: { select: MEDIA_SELECT },
  };
  const previous = await prisma.seoMetadata.findUnique({ where: key });
  const expected = dto.expectedUpdatedAt;
  if (expected === undefined) {
    const row = await prisma.seoMetadata.upsert({
      where: key,
      create: data,
      update: data,
      include,
    });
    return { previous, row };
  }
  const stale =
    expected === null
      ? previous !== null
      : !previous ||
        previous.updatedAt.getTime() !== new Date(expected).getTime();
  if (stale) throw catalogConflict('SEO_STALE_VERSION', SEO_STALE_MESSAGE);
  if (previous) {
    const updated = await prisma.seoMetadata.updateMany({
      where: { id: previous.id, updatedAt: previous.updatedAt },
      data,
    });
    const row =
      updated.count === 1
        ? await prisma.seoMetadata.findUnique({ where: key, include })
        : null;
    if (!row) throw catalogConflict('SEO_STALE_VERSION', SEO_STALE_MESSAGE);
    return { previous, row };
  }
  try {
    const row = await prisma.seoMetadata.create({ data, include });
    return { previous, row };
  } catch (error) {
    /* Two first saves at once: the second finds the row the first made. */
    if (isUniqueConstraintError(error))
      throw catalogConflict('SEO_STALE_VERSION', SEO_STALE_MESSAGE);
    throw error;
  }
}
