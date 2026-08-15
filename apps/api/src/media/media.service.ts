import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
// SVG is intentionally excluded: it can embed executable script content and
// this local storage adapter does not sanitize it.
/** What a student may attach to their profile. Documents are evidence, not
 * page imagery, so the set is different: PDFs and office documents alongside a
 * phone photo of a passport page. SVG stays excluded here too. */
export const STUDENT_DOCUMENT_MIME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

/** Prisma maps fileSizeBytes to a BigInt column; JSON has no native BigInt
 * support, so every MediaAsset returned over HTTP needs this conversion.
 * File sizes are capped at MAX_FILE_SIZE_BYTES, well inside safe-integer
 * range, so a plain Number loses nothing. */
function serializeAsset<T extends { fileSizeBytes: bigint }>(
  asset: T,
): Omit<T, 'fileSizeBytes'> & { fileSizeBytes: number } {
  return { ...asset, fileSizeBytes: Number(asset.fileSizeBytes) };
}

/** ISS-021. This used to check nine relations and stop there -- but `archive()`
 * unlinks the file from disk the moment this returns zero, and the schema has
 * roughly twenty MediaAsset relations. Every one left unchecked was a
 * guaranteed break, not a race: a Subject, Country or Consultant record kept
 * its `xxxMediaId` pointing at a row that still existed (archiving never
 * touches the referencing row, only the asset's own status/deletedAt), while
 * the physical file underneath it was already gone. The image renders broken
 * on the very next page load, with nothing in the Media Library UI to
 * suggest why -- the asset was reported as "not in use" right up until it was
 * deleted.
 *
 * Confirmed missing before this fix: Subject, SubSubject, Continent, Country,
 * CountryContentSection, City, Course, CourseContentSection, NavigationItem,
 * PlatformMetric, SeoMetadata, User -- and, distinctly from the
 * ConsultantLandingCard already covered here, the `Consultant` catalog model
 * itself (`featuredMediaId`), which is the exact media field exercised by the
 * Phase 1 Consultants module's own "Media (optional)" picker.
 *
 * This is every MediaAsset relation the schema currently defines. */
async function usageCount(prisma: PrismaService, mediaId: string) {
  const counts = await Promise.all([
    prisma.pageSection.count({ where: { mediaId, deletedAt: null } }),
    prisma.pageSection.count({
      where: { backgroundMediaId: mediaId, deletedAt: null },
    }),
    prisma.university.count({
      where: { featuredMediaId: mediaId, deletedAt: null },
    }),
    prisma.universityCourseOffering.count({
      where: { featuredMediaId: mediaId, deletedAt: null },
    }),
    prisma.scholarship.count({
      where: { featuredMediaId: mediaId, deletedAt: null },
    }),
    prisma.consultantLandingCard.count({
      where: {
        deletedAt: null,
        OR: [{ iconMediaId: mediaId }, { featuredMediaId: mediaId }],
      },
    }),
    prisma.consultant.count({
      where: { featuredMediaId: mediaId, deletedAt: null },
    }),
    prisma.event.count({
      where: { featuredMediaId: mediaId, deletedAt: null },
    }),
    prisma.successStory.count({
      where: { featuredMediaId: mediaId, deletedAt: null },
    }),
    prisma.testimonial.count({
      where: { imageMediaId: mediaId, deletedAt: null },
    }),
    prisma.subject.count({
      where: {
        deletedAt: null,
        OR: [
          { iconMediaId: mediaId },
          { listingMediaId: mediaId },
          { heroMediaId: mediaId },
        ],
      },
    }),
    prisma.subSubject.count({
      where: {
        deletedAt: null,
        OR: [{ iconMediaId: mediaId }, { listingMediaId: mediaId }],
      },
    }),
    prisma.continent.count({
      where: {
        deletedAt: null,
        OR: [{ iconMediaId: mediaId }, { heroMediaId: mediaId }],
      },
    }),
    prisma.country.count({
      where: {
        deletedAt: null,
        OR: [
          { flagMediaId: mediaId },
          { listingMediaId: mediaId },
          { heroMediaId: mediaId },
          { mapMediaId: mediaId },
        ],
      },
    }),
    prisma.countryContentSection.count({
      where: {
        deletedAt: null,
        OR: [{ primaryMediaId: mediaId }, { secondaryMediaId: mediaId }],
      },
    }),
    prisma.city.count({
      where: { heroMediaId: mediaId, deletedAt: null },
    }),
    prisma.course.count({
      where: { featuredMediaId: mediaId, deletedAt: null },
    }),
    prisma.courseContentSection.count({
      where: { mediaId, deletedAt: null },
    }),
    prisma.navigationItem.count({ where: { iconMediaId: mediaId } }),
    prisma.platformMetric.count({ where: { iconMediaId: mediaId } }),
    prisma.seoMetadata.count({
      where: { OR: [{ ogMediaId: mediaId }, { twitterMediaId: mediaId }] },
    }),
    prisma.user.count({
      where: { avatarMediaId: mediaId, deletedAt: null },
    }),
  ]);
  return counts.reduce((total, count) => total + count, 0);
}

@Injectable()
export class MediaService {
  private readonly uploadsDir = join(process.cwd(), 'uploads', 'media');

  constructor(private readonly prisma: PrismaService) {}

  private async ensureUploadsDir() {
    await mkdir(this.uploadsDir, { recursive: true });
  }

  async upload(
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    meta: {
      title?: string;
      altText?: string;
      caption?: string;
      folder?: string;
    },
    uploadedByUserId?: string,
    /** Callers with a different remit pass their own set; the admin media
     * library keeps the image-only default. */
    allowedMimeTypes: Record<string, string> = ALLOWED_MIME_TYPES,
  ) {
    const extension = allowedMimeTypes[file.mimetype];
    if (!extension)
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `File type must be one of ${Object.keys(allowedMimeTypes).join(', ')}`,
        details: null,
      });
    if (file.size > MAX_FILE_SIZE_BYTES)
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File must be ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB or smaller`,
        details: null,
      });
    await this.ensureUploadsDir();
    // Never trust the client-supplied filename for the path on disk — only
    // its (already MIME-validated) extension is used, with a random name.
    const storedFileName = `${randomUUID()}${extension}`;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    await writeFile(join(this.uploadsDir, storedFileName), file.buffer);
    const originalFileName = file.originalname
      .replace(/[/\\]/g, '')
      .slice(0, 255);
    const created = await this.prisma.mediaAsset.create({
      data: {
        storageProvider: 'LOCAL',
        objectKey: storedFileName,
        publicUrl: `/media/${storedFileName}`,
        originalFileName: originalFileName || storedFileName,
        storedFileName,
        mimeType: file.mimetype,
        fileExtension: extension.replace('.', ''),
        fileSizeBytes: file.size,
        checksum,
        title: meta.title?.trim() || null,
        altText: meta.altText?.trim() || null,
        caption: meta.caption?.trim() || null,
        folder: meta.folder?.trim() || null,
        mediaType: 'IMAGE',
        status: 'ACTIVE',
        uploadedByUserId: uploadedByUserId ?? null,
      },
    });
    return serializeAsset(created);
  }

  async list(query: {
    page?: string;
    limit?: string;
    folder?: string;
    q?: string;
  }) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? 24) || 24));
    const where = {
      deletedAt: null,
      ...(query.folder ? { folder: query.folder } : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { title: { contains: query.q.trim() } },
              { altText: { contains: query.q.trim() } },
              { originalFileName: { contains: query.q.trim() } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    const withUsage = await Promise.all(
      data.map(async (asset) => ({
        ...serializeAsset(asset),
        inUse: (await usageCount(this.prisma, asset.id)) > 0,
      })),
    );
    return {
      data: withUsage,
      meta: {
        page,
        limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async update(
    id: string,
    body: {
      title?: string;
      altText?: string;
      caption?: string;
      folder?: string;
    },
  ) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Media asset not found',
        details: null,
      });
    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        title: body.title?.trim() || null,
        altText: body.altText?.trim() || null,
        caption: body.caption?.trim() || null,
        folder: body.folder?.trim() || null,
      },
    });
    return serializeAsset(updated);
  }

  async archive(id: string) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Media asset not found',
        details: null,
      });
    const uses = await usageCount(this.prisma, id);
    if (uses > 0)
      throw new ConflictException({
        code: 'MEDIA_IN_USE',
        message: `This asset is used by ${uses} record${uses === 1 ? '' : 's'} and cannot be archived`,
        details: null,
      });
    const archived = await this.prisma.mediaAsset.update({
      where: { id },
      data: { status: 'ARCHIVED', deletedAt: new Date() },
    });
    await this.deleteFileFromDisk(asset.storedFileName);
    return serializeAsset(archived);
  }

  /** Resolves a stored filename to a readable path, rejecting anything that
   * doesn't look like a filename this service itself generated. */
  resolveServablePath(filename: string): string {
    if (!FILENAME_PATTERN.test(filename))
      throw new BadRequestException({
        code: 'INVALID_FILENAME',
        message: 'Invalid media filename',
        details: null,
      });
    return join(this.uploadsDir, filename);
  }

  async isPubliclyServable(filename: string): Promise<boolean> {
    if (!FILENAME_PATTERN.test(filename)) return false;
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        storedFileName: filename,
        status: 'ACTIVE',
        deletedAt: null,
        OR: [{ folder: null }, { folder: { not: 'student-offers' } }],
      },
      select: { id: true },
    });
    return Boolean(asset);
  }

  private async deleteFileFromDisk(storedFileName: string) {
    try {
      await unlink(join(this.uploadsDir, storedFileName));
    } catch {
      // Already gone — archiving the DB record is still the source of truth.
    }
  }
}
