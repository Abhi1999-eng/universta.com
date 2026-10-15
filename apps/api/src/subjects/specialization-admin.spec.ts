import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Specializations as records of their own for the admin: a list across
 * subjects, one by id alone, and an SEO row filed under their own owner
 * type -- next to, not inside, their subject's.
 */

const subject = {
  id: 'cs',
  name: 'Computer Science',
  slug: 'computer-science',
  status: 'PUBLISHED',
  deletedAt: null,
};
const row = (id: string, name: string) => ({
  id,
  subjectId: 'cs',
  subject,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  shortDescription: null,
  overview: null,
  iconMedia: null,
  listingMedia: null,
  isFeatured: false,
  displayOrder: 0,
  status: 'DRAFT',
  publishedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
});

function prisma(
  calls: Record<string, unknown[]>,
  seo: Record<string, unknown> | null = null,
) {
  const record = (name: string) => (args: unknown) => {
    (calls[name] ??= []).push(args);
  };
  return {
    subSubject: {
      count: async (args: unknown) => {
        record('count')(args);
        return 2;
      },
      findMany: async (args: unknown) => {
        record('findMany')(args);
        return [
          row('ai', 'Artificial Intelligence'),
          row('se', 'Software Engineering'),
        ];
      },
      findFirst: async (args: { where: { id?: string } }) => {
        record('findFirst')(args);
        return args.where.id === 'missing'
          ? null
          : row(args.where.id ?? 'ai', 'Artificial Intelligence');
      },
    },
    seoMetadata: {
      findUnique: async (args: unknown) => {
        record('seoFindUnique')(args);
        return seo;
      },
      upsert: async (args: { create: Record<string, unknown> }) => {
        record('seoUpsert')(args);
        return {
          id: 'seo-1',
          ...args.create,
          updatedAt: new Date(),
          createdAt: new Date(),
        };
      },
      delete: async (args: unknown) => {
        record('seoDelete')(args);
        return null;
      },
    },
    auditLog: { create: async () => null },
  } as unknown as PrismaService;
}

const request = {
  user: { sub: 'admin-1' },
  headers: {},
  ip: '127.0.0.1',
  get: () => undefined,
} as unknown as AuthenticatedRequest;

describe('admin specializations', () => {
  it('lists across subjects, narrowed by subject id, search and status', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    const result = await service.adminSpecializationList({
      page: 1,
      limit: 12,
      subjectId: 'cs',
      q: 'intel',
      status: 'DRAFT',
    });
    const where = (calls.findMany[0] as { where: Record<string, unknown> })
      .where;
    expect(where).toMatchObject({
      deletedAt: null,
      subject: { deletedAt: null },
      subjectId: 'cs',
      status: 'DRAFT',
      OR: [{ name: { contains: 'intel' } }, { slug: { contains: 'intel' } }],
    });
    expect(result.data.map((item) => item.name)).toEqual([
      'Artificial Intelligence',
      'Software Engineering',
    ]);
    expect(result.data[0].subject).toEqual({
      id: 'cs',
      name: 'Computer Science',
      slug: 'computer-science',
    });
    expect(result.meta.total).toBe(2);
  });

  it('lists every subject when none is named', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    await service.adminSpecializationList({ page: 1, limit: 12 });
    const where = (calls.findMany[0] as { where: Record<string, unknown> })
      .where;
    expect(where).not.toHaveProperty('subjectId');
  });

  it('opens one by id alone and names its subject', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    const result = await service.getSpecialization('ai');
    expect(result.id).toBe('ai');
    expect(result.subject.slug).toBe('computer-science');
    expect((calls.findFirst[0] as { where: unknown }).where).toEqual({
      id: 'ai',
      deletedAt: null,
      subject: { deletedAt: null },
    });
  });

  it('refuses an id nothing answers to', async () => {
    const service = new SubjectsService(prisma({}));
    await expect(service.getSpecialization('missing')).rejects.toMatchObject({
      response: { code: 'SUB_SUBJECT_NOT_FOUND' },
    });
  });

  it('files its SEO under its own owner type', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    await service.putSpecializationSeo(
      'ai',
      { seoTitle: 'Study AI abroad', metaDescription: 'Where to study AI.' },
      request,
    );
    const upsert = calls.seoUpsert[0] as {
      where: { ownerType_ownerId: unknown };
      create: Record<string, unknown>;
    };
    expect(upsert.where.ownerType_ownerId).toEqual({
      ownerType: 'SUB_SUBJECT',
      ownerId: 'ai',
    });
    expect(upsert.create).toMatchObject({
      ownerType: 'SUB_SUBJECT',
      ownerId: 'ai',
      seoTitle: 'Study AI abroad',
    });

    await service.getSpecializationSeo('ai');
    expect(calls.seoFindUnique.at(-1)).toEqual({
      where: { ownerType_ownerId: { ownerType: 'SUB_SUBJECT', ownerId: 'ai' } },
      include: expect.anything(),
    });
  });

  it('reports nothing to delete when no SEO was written', async () => {
    const service = new SubjectsService(prisma({}));
    await expect(
      service.deleteSpecializationSeo('ai', {}, request),
    ).resolves.toEqual({ deleted: false });
  });
});
