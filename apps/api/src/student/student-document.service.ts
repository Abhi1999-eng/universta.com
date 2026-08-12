import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MediaService,
  STUDENT_DOCUMENT_MIME_TYPES,
} from '../media/media.service';

export const STUDENT_DOCUMENT_TYPES = [
  'RESUME',
  'SOP',
  'LOR',
  'PASSPORT',
  'TRANSCRIPT',
  'ENGLISH_TEST_RESULT',
  'OTHER',
] as const;

export type StudentDocumentType = (typeof STUDENT_DOCUMENT_TYPES)[number];

/** What a student calls each of these. The stored value stays an enum; the
 * reader never sees it. */
export const DOCUMENT_LABELS: Record<StudentDocumentType, string> = {
  RESUME: 'Resume',
  SOP: 'Statement of purpose',
  LOR: 'Letter of recommendation',
  PASSPORT: 'Passport',
  TRANSCRIPT: 'Transcript',
  ENGLISH_TEST_RESULT: 'English test result',
  OTHER: 'Additional document',
};

function notFound(): HttpException {
  return new HttpException(
    { code: 'NOT_FOUND', message: 'Document not found', details: null },
    HttpStatus.NOT_FOUND,
  );
}

@Injectable()
export class StudentDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  private async profileIdFor(userId: string): Promise<string> {
    const existing = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return existing.id;
    const created = await this.prisma.studentProfile.create({
      data: { userId },
      select: { id: true },
    });
    return created.id;
  }

  async list(userId: string) {
    const id = await this.profileIdFor(userId);
    const rows = await this.prisma.studentDocument.findMany({
      where: { studentProfileId: id },
      include: {
        mediaAsset: {
          select: {
            publicUrl: true,
            originalFileName: true,
            mimeType: true,
            fileSizeBytes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      documentType: row.documentType,
      typeLabel:
        DOCUMENT_LABELS[row.documentType as StudentDocumentType] ??
        DOCUMENT_LABELS.OTHER,
      title: row.title,
      notes: row.notes,
      fileName: row.mediaAsset.originalFileName,
      url: row.mediaAsset.publicUrl,
      sizeBytes: Number(row.mediaAsset.fileSizeBytes),
      uploadedAt: row.createdAt.toISOString(),
    }));
  }

  /**
   * Stores an uploaded file and records that it belongs to this student.
   *
   * Upload and ownership happen together on purpose. An endpoint that took a
   * mediaAssetId from the client would let anyone attach a file they do not
   * own by guessing an id; here the asset is created inside this call, so
   * there is no id for a caller to supply.
   */
  async upload(
    userId: string,
    file: Express.Multer.File,
    input: { documentType: string; title?: string; notes?: string },
  ) {
    const profileId = await this.profileIdFor(userId);
    const asset = await this.media.upload(
      file,
      {
        title: input.title?.slice(0, 255),
        folder: 'student-documents',
      },
      userId,
      STUDENT_DOCUMENT_MIME_TYPES,
    );

    const created = await this.prisma.studentDocument.create({
      data: {
        studentProfileId: profileId,
        mediaAssetId: asset.id,
        documentType: input.documentType,
        title:
          input.title?.trim() ||
          DOCUMENT_LABELS[input.documentType as StudentDocumentType] ||
          file.originalname,
        notes: input.notes?.trim() || null,
      },
      select: { id: true },
    });
    return { id: created.id };
  }

  async updateMetadata(
    userId: string,
    documentId: string,
    input: { title?: string; notes?: string | null; documentType?: string },
  ) {
    const profileId = await this.profileIdFor(userId);
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.documentType !== undefined)
      data.documentType = input.documentType;

    const result = await this.prisma.studentDocument.updateMany({
      where: { id: documentId, studentProfileId: profileId },
      data,
    });
    if (result.count === 0) throw notFound();
    return { id: documentId };
  }

  async remove(userId: string, documentId: string) {
    const profileId = await this.profileIdFor(userId);
    // Read the asset id under the same ownership filter, so a document
    // belonging to someone else is never even located.
    const owned = await this.prisma.studentDocument.findFirst({
      where: { id: documentId, studentProfileId: profileId },
      select: { id: true, mediaAssetId: true },
    });
    if (!owned) throw notFound();

    await this.prisma.studentDocument.delete({ where: { id: owned.id } });
    await this.media.archive(owned.mediaAssetId).catch(() => {
      // The ownership row is gone, which is what the student asked for. A
      // failure to archive the blob is a storage housekeeping concern.
    });
  }
}
