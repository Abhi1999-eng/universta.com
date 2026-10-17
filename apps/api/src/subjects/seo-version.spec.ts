import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubjectsService } from './subjects.service';
import { CoursesService } from '../courses/courses.service';
import { SeoManagementService } from '../seo-management/seo-management.service';
import { SeoMetadataDto } from './dto/subject.dto';
import { UpsertLevelPageDto } from './dto/level-page.dto';
import { toSeo } from './subjects.shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { SettingsService } from '../settings/settings.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Saving the SEO of a subject, a specialization or a course.
 *
 * - The version: `expectedUpdatedAt` was `@IsUUID`, so no editor could send
 *   the `updatedAt` it had read and a second session's save overwrote the
 *   first unseen. It is the row's `updatedAt` now (null: "I saw no row"),
 *   checked by the write itself, and a mismatch is 409 SEO_STALE_VERSION.
 *   Left out, nothing is checked, as before.
 * - Robots only: unticking "Robots index" with no title and description was
 *   refused by the DTO, and the editor skipped the save. Such a row is
 *   stored now, and reads back with a null title and description, which the
 *   resolver fills as it does when there is no row.
 */

type Row = Record<string, any>;
const request = {
  user: { sub: 'admin-1' },
  headers: {},
  ip: '127.0.0.1',
  get: () => undefined,
} as unknown as AuthenticatedRequest;
const base = { seoTitle: 'Study computing', metaDescription: 'Where and why.' };

/* One SEO row, written the way MySQL writes it: `updatedAt` moves on every
   write, an update guarded by `updatedAt` lands only while it still
   matches, and a second create of the same owner breaks the unique key.
   `beforeWrite` lets a test land another session's save in between. */
function fakeDb(stored: Row | null = null) {
  let clock = Date.parse('2026-10-17T10:00:00.000Z');
  const tick = () => new Date((clock += 1000));
  const db = {
    seo: stored,
    calls: [] as string[],
    beforeWrite: undefined as undefined | (() => void),
  };
  const record = { id: 'rec', slug: 'rec', deletedAt: null, updatedAt: tick() };
  const prisma = {
    subject: { findFirst: async () => ({ ...record, courseLevels: [] }) },
    subSubject: {
      findFirst: async () => ({ ...record, courseLevels: [], subject: {} }),
    },
    course: { findFirst: async () => record },
    seoMetadata: {
      findUnique: async () => {
        db.calls.push('findUnique');
        return db.seo ? { ...db.seo } : null;
      },
      upsert: async ({ create, update }: { create: Row; update: Row }) => {
        db.calls.push('upsert');
        db.seo = db.seo
          ? { ...db.seo, ...update, updatedAt: tick() }
          : { id: 'seo-1', ...create, updatedAt: tick() };
        return { ...db.seo };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        db.calls.push(`updateMany ${Object.keys(where).join(',')}`);
        db.beforeWrite?.();
        if (
          !db.seo ||
          db.seo.id !== where.id ||
          db.seo.updatedAt.getTime() !== where.updatedAt.getTime()
        )
          return { count: 0 };
        db.seo = { ...db.seo, ...data, updatedAt: tick() };
        return { count: 1 };
      },
      create: async ({ data }: { data: Row }) => {
        db.calls.push('create');
        db.beforeWrite?.();
        if (db.seo) throw Object.assign(new Error('unique'), { code: 'P2002' });
        db.seo = { id: 'seo-1', ...data, updatedAt: tick() };
        return { ...db.seo };
      },
    },
    auditLog: { create: async () => null },
  } as unknown as PrismaService;
  return { db, prisma, tick };
}

const existing = () => ({
  id: 'seo-1',
  ownerType: 'SUBJECT',
  ownerId: 'rec',
  ...base,
  robotsIndex: true,
  robotsFollow: true,
  updatedAt: new Date('2026-10-17T09:00:00.000Z'),
});

/* The three editors' saves, each as its service takes it. */
const savers = {
  subject: (prisma: PrismaService) => (dto: SeoMetadataDto) =>
    new SubjectsService(prisma).putSeo('rec', dto, request),
  specialization: (prisma: PrismaService) => (dto: SeoMetadataDto) =>
    new SubjectsService(prisma).putSpecializationSeo('rec', dto, request),
  course: (prisma: PrismaService) => (dto: SeoMetadataDto) =>
    new CoursesService(prisma).putSeo('rec', dto, request),
};

describe.each(Object.entries(savers))('saving a %s SEO', (_, saver) => {
  it('lands with the version that was read, and answers with the new one', async () => {
    const { db, prisma } = fakeDb(existing());
    const saved = await saver(prisma)({
      ...base,
      seoTitle: 'New title',
      expectedUpdatedAt: '2026-10-17T09:00:00.000Z',
    });
    expect(db.seo).toMatchObject({ seoTitle: 'New title' });
    /* The check is the write's own: guarded by the version read. */
    expect(db.calls).toContain('updateMany id,updatedAt');
    expect(saved).toMatchObject({ seoTitle: 'New title' });
    expect(saved?.updatedAt).toBe(db.seo?.updatedAt.toISOString());
    expect(saved?.updatedAt).not.toBe('2026-10-17T09:00:00.000Z');
  });

  it('refuses a version older than the row, and writes nothing', async () => {
    const { db, prisma } = fakeDb(existing());
    await expect(
      saver(prisma)({
        ...base,
        seoTitle: 'Overwrite',
        expectedUpdatedAt: '2026-10-17T08:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'SEO_STALE_VERSION' },
    });
    expect(db.seo).toMatchObject({ seoTitle: base.seoTitle });
    expect(db.calls).toEqual(['findUnique']);
  });

  it('refuses "there was no row" once another session wrote one', async () => {
    const { db, prisma } = fakeDb(existing());
    await expect(
      saver(prisma)({ ...base, expectedUpdatedAt: null }),
    ).rejects.toMatchObject({ response: { code: 'SEO_STALE_VERSION' } });
    expect(db.calls).toEqual(['findUnique']);
  });

  it('writes the first row when it saw none', async () => {
    const { db, prisma } = fakeDb();
    const saved = await saver(prisma)({ ...base, expectedUpdatedAt: null });
    expect(db.calls).toEqual(['findUnique', 'create']);
    expect(saved).toMatchObject({ seoTitle: base.seoTitle });
    expect(saved?.updatedAt).toBe(db.seo?.updatedAt.toISOString());
  });

  it('refuses a version for a row deleted since', async () => {
    const { prisma } = fakeDb();
    await expect(
      saver(prisma)({
        ...base,
        expectedUpdatedAt: '2026-10-17T09:00:00.000Z',
      }),
    ).rejects.toMatchObject({ response: { code: 'SEO_STALE_VERSION' } });
  });

  it('refuses the slower of two saves that both passed the read', async () => {
    const { db, prisma, tick } = fakeDb(existing());
    /* Another session's save lands between this one's read and write. */
    db.beforeWrite = () => {
      db.seo = { ...db.seo, seoTitle: 'Theirs', updatedAt: tick() };
    };
    await expect(
      saver(prisma)({
        ...base,
        seoTitle: 'Mine',
        expectedUpdatedAt: '2026-10-17T09:00:00.000Z',
      }),
    ).rejects.toMatchObject({ response: { code: 'SEO_STALE_VERSION' } });
    expect(db.seo).toMatchObject({ seoTitle: 'Theirs' });
  });

  it('refuses the second of two first saves', async () => {
    const { db, prisma, tick } = fakeDb();
    db.beforeWrite = () => {
      db.seo = { ...existing(), updatedAt: tick() };
    };
    await expect(
      saver(prisma)({ ...base, expectedUpdatedAt: null }),
    ).rejects.toMatchObject({ response: { code: 'SEO_STALE_VERSION' } });
  });

  it('checks nothing when no version is sent, as before', async () => {
    const { db, prisma } = fakeDb(existing());
    await saver(prisma)({ ...base, seoTitle: 'Unchecked' });
    expect(db.calls).toEqual(['findUnique', 'upsert']);
    expect(db.seo).toMatchObject({ seoTitle: 'Unchecked' });
  });

  it('stores a robots-only row, and reads its title and description back as null', async () => {
    const { db, prisma } = fakeDb();
    const saved = await saver(prisma)({
      robotsIndex: false,
      expectedUpdatedAt: null,
    });
    /* The columns are not nullable: empty there, null to every reader. */
    expect(db.seo).toMatchObject({
      seoTitle: '',
      metaDescription: '',
      robotsIndex: false,
      robotsFollow: true,
    });
    expect(saved).toMatchObject({
      seoTitle: null,
      metaDescription: null,
      robotsIndex: false,
    });
  });
});

describe('the SEO body', () => {
  const errors = async (body: Record<string, unknown>) =>
    (await validate(plainToInstance(SeoMetadataDto, body))).map(
      (error) => error.property,
    );

  it('takes robots alone, with the title and the description left out, empty or null', async () => {
    expect(await errors({ robotsIndex: false })).toEqual([]);
    expect(
      await errors({
        seoTitle: '',
        metaDescription: null,
        robotsIndex: 'false',
        robotsFollow: false,
      }),
    ).toEqual([]);
  });

  it('still limits a title and a description that are written', async () => {
    expect(
      await errors({ seoTitle: 'x'.repeat(256), metaDescription: 'ok' }),
    ).toEqual(['seoTitle']);
    expect(await errors({ metaDescription: 'x'.repeat(501) })).toEqual([
      'metaDescription',
    ]);
  });

  it('takes the version as a timestamp or null, and no longer as an id', async () => {
    expect(
      await errors({ ...base, expectedUpdatedAt: '2026-10-17T09:00:00.000Z' }),
    ).toEqual([]);
    expect(await errors({ ...base, expectedUpdatedAt: null })).toEqual([]);
    expect(
      await errors({
        ...base,
        expectedUpdatedAt: '6f1c2b3a-1d2e-4f50-8a9b-0c1d2e3f4a5b',
      }),
    ).toEqual(['expectedUpdatedAt']);
  });

  it("takes a robots-only SEO inside a level page's save too", async () => {
    const result = await validate(
      plainToInstance(UpsertLevelPageDto, { seo: { robotsIndex: false } }),
    );
    expect(result).toEqual([]);
  });
});

describe('a robots-only row in the resolver', () => {
  it('fills the title and the description as for no row, and keeps the robots', async () => {
    const prisma = {
      seoBulkTemplate: { findUnique: async () => null },
      mediaAsset: { findFirst: async () => null },
    } as unknown as PrismaService;
    const settings = {
      publicGetAll: async () => ({
        seo: { defaultDescription: 'Global default description.' },
      }),
    } as unknown as SettingsService;
    const resolver = new SeoManagementService(prisma, settings);
    const subject = {
      id: 'cs',
      name: 'Computer Science',
      slug: 'computer-science',
      shortDescription: 'Programming and systems.',
    };
    const manual = toSeo({
      id: 'seo-1',
      ownerType: 'SUBJECT',
      ownerId: 'cs',
      seoTitle: '',
      metaDescription: '',
      robotsIndex: false,
      robotsFollow: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const withRow = await resolver.resolve('subject', subject, manual);
    const withoutRow = await resolver.resolve('subject', subject, null);
    expect(withRow).toMatchObject({
      seoTitle: withoutRow.seoTitle,
      metaDescription: withoutRow.metaDescription,
      robotsIndex: false,
      robotsFollow: true,
      source: { title: 'fallback' },
    });
  });
});
