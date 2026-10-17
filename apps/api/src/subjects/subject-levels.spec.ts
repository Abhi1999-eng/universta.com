import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * The study levels an editor ticks for a subject or a specialization: they
 * are written whole, must be active levels, and a public page lists them
 * alongside the levels its published courses already stand at.
 */

const LEVELS = {
  ug: {
    id: 'ug',
    code: 'UG',
    name: "Bachelor's",
    educationOrder: 4,
    displayOrder: 0,
    status: 'ACTIVE',
  },
  pg: {
    id: 'pg',
    code: 'PG',
    name: "Master's",
    educationOrder: 6,
    displayOrder: 0,
    status: 'ACTIVE',
  },
  phd: {
    id: 'phd',
    code: 'PHD',
    name: 'PhD',
    educationOrder: 8,
    displayOrder: 0,
    status: 'ACTIVE',
  },
};
const subject = {
  id: 'cs',
  name: 'Computer Science',
  slug: 'computer-science',
  status: 'PUBLISHED',
  deletedAt: null,
};

function row(courseLevelIds: string[]) {
  return {
    id: 'ai',
    subjectId: 'cs',
    subject,
    name: 'Artificial Intelligence',
    slug: 'artificial-intelligence',
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
    courseLevels: courseLevelIds.map((id) => ({
      courseLevel: LEVELS[id as keyof typeof LEVELS],
    })),
  };
}

function prisma(
  calls: Record<string, unknown[]>,
  options: { activeLevels?: number; courseLevels?: string[] } = {},
) {
  const record = (name: string) => (args: unknown) => {
    (calls[name] ??= []).push(args);
  };
  return {
    courseLevel: {
      count: async (args: { where: { id: { in: string[] } } }) => {
        record('levelCount')(args);
        return options.activeLevels ?? args.where.id.in.length;
      },
      /* Every level when unfiltered (the reserved-slug check), else the
         ones asked for by id. */
      findMany: async (args: { where?: { id: { in: string[] } } }) =>
        args.where
          ? args.where.id.in.flatMap((id) =>
              LEVELS[id as keyof typeof LEVELS]
                ? [LEVELS[id as keyof typeof LEVELS]]
                : [],
            )
          : Object.values(LEVELS),
    },
    subject: { findFirst: async () => subject },
    subSubject: {
      findFirst: async () => row(options.courseLevels ?? ['ug']),
      create: async (args: { data: Record<string, unknown> }) => {
        record('create')(args);
        return row(options.courseLevels ?? []);
      },
      update: async (args: { data: Record<string, unknown> }) => {
        record('update')(args);
        return row(options.courseLevels ?? []);
      },
    },
    course: {
      groupBy: async () => [{ courseLevelId: 'phd', _count: { _all: 2 } }],
    },
    mediaAsset: { count: async () => 0 },
    auditLog: { create: async () => null },
  } as unknown as PrismaService;
}

const request = {
  user: { sub: 'admin-1' },
  headers: {},
  ip: '127.0.0.1',
  get: () => undefined,
} as unknown as AuthenticatedRequest;

describe('study levels ticked on a specialization', () => {
  it('writes the ticks with a new record, as links to the levels', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    await service.createSubSubject(
      'cs',
      { name: 'Artificial Intelligence', courseLevelIds: ['pg', 'ug', 'pg'] },
      request,
    );
    const data = (calls.create[0] as { data: { courseLevels: unknown } }).data;
    expect(data.courseLevels).toEqual({
      create: [{ courseLevelId: 'pg' }, { courseLevelId: 'ug' }],
    });
    expect(
      (calls.levelCount[0] as { where: { status: string } }).where.status,
    ).toBe('ACTIVE');
  });

  it('replaces the ticks whole on an edit, and leaves them alone when none were sent', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    await service.updateSubSubject(
      'cs',
      'ai',
      { name: 'Artificial Intelligence', courseLevelIds: ['phd'] },
      request,
    );
    expect(
      (calls.update[0] as { data: { courseLevels: unknown } }).data
        .courseLevels,
    ).toEqual({
      deleteMany: {},
      create: [{ courseLevelId: 'phd' }],
    });
    await service.updateSubSubject(
      'cs',
      'ai',
      { name: 'Artificial Intelligence' },
      request,
    );
    expect(
      (calls.update[1] as { data: Record<string, unknown> }).data,
    ).not.toHaveProperty('courseLevels');
  });

  it('clears every tick when an empty list is sent', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    await service.updateSubSubject(
      'cs',
      'ai',
      { name: 'Artificial Intelligence', courseLevelIds: [] },
      request,
    );
    expect(
      (calls.update[0] as { data: { courseLevels: unknown } }).data
        .courseLevels,
    ).toEqual({ deleteMany: {}, create: [] });
  });

  it('refuses a level that is not an active course level', async () => {
    const service = new SubjectsService(prisma({}, { activeLevels: 0 }));
    await expect(
      service.createSubSubject(
        'cs',
        { name: 'Artificial Intelligence', courseLevelIds: ['nope'] },
        request,
      ),
    ).rejects.toMatchObject({ response: { code: 'COURSE_LEVEL_INVALID' } });
  });

  it('hands the admin the ticks in climbing order, and what its courses imply beside them', async () => {
    const service = new SubjectsService(
      prisma({}, { courseLevels: ['phd', 'ug'] }),
    );
    const result = await service.getSpecialization('ai');
    expect(result.courseLevels.map((level) => level.code)).toEqual([
      'UG',
      'PHD',
    ]);
    expect(result.impliedCourseLevels.map((level) => level.code)).toEqual([
      'PHD',
    ]);
  });
});

describe('a specialization slugged like a study level', () => {
  it('is refused, since the level page lives at the same address', async () => {
    const service = new SubjectsService(prisma({}));
    for (const slug of ['masters', 'bachelors', 'ug', 'phd', 'levels'])
      await expect(
        service.createSubSubject(
          'cs',
          { name: 'Masters', slug, courseLevelIds: [] },
          request,
        ),
      ).rejects.toMatchObject({
        response: { code: 'SUB_SUBJECT_SLUG_RESERVED' },
      });
  });

  it('is refused when generated from a name like a level, and allowed otherwise', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    await expect(
      service.createSubSubject('cs', { name: 'PhD' }, request),
    ).rejects.toMatchObject({
      response: { code: 'SUB_SUBJECT_SLUG_RESERVED' },
    });
    await service.createSubSubject(
      'cs',
      { name: 'Artificial Intelligence' },
      request,
    );
    expect(calls.create).toHaveLength(1);
  });
});
