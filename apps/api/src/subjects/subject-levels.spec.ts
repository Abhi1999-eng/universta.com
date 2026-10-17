import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * The study levels an editor ticks for a subject or a specialization: they
 * are written whole, must be real levels, and a public page lists them
 * alongside the levels its published courses already stand at. A level
 * switched off under "All levels" after it was ticked drops out of sight
 * everywhere, but neither blocks a save nor loses the tick.
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
  /* Ticked once, switched off since. */
  fd: {
    id: 'fd',
    code: 'FD',
    name: 'Foundation',
    educationOrder: 2,
    displayOrder: 0,
    status: 'INACTIVE',
  },
};
const subject = {
  id: 'cs',
  name: 'Computer Science',
  slug: 'computer-science',
  status: 'PUBLISHED',
  deletedAt: null,
};

const links = (courseLevelIds: string[]) =>
  courseLevelIds.map((id) => ({
    courseLevel: LEVELS[id as keyof typeof LEVELS],
  }));

function subjectRow(courseLevelIds: string[]) {
  return {
    ...subject,
    shortDescription: 'Computers.',
    overview: null,
    iconMedia: null,
    listingMedia: null,
    heroMedia: null,
    isFeatured: false,
    displayOrder: 0,
    publishedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    subSubjects: [],
    _count: { courses: 0, countrySubjects: 0 },
    courseLevels: links(courseLevelIds),
  };
}

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
    courseLevels: links(courseLevelIds),
  };
}

function prisma(
  calls: Record<string, unknown[]>,
  options: { courseLevels?: string[]; subjectLevels?: string[] } = {},
) {
  const record = (name: string) => (args: unknown) => {
    (calls[name] ??= []).push(args);
  };
  return {
    courseLevel: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in.flatMap((id) =>
          LEVELS[id as keyof typeof LEVELS]
            ? [LEVELS[id as keyof typeof LEVELS]]
            : [],
        ),
    },
    subject: {
      findFirst: async () => subjectRow(options.subjectLevels ?? []),
      findMany: async () => [subjectRow(options.subjectLevels ?? [])],
      count: async () => 1,
      update: async (args: { data: Record<string, unknown> }) => {
        record('subjectUpdate')(args);
        return subjectRow(options.subjectLevels ?? []);
      },
    },
    subSubject: {
      findFirst: async () => row(options.courseLevels ?? ['ug']),
      findMany: async () => [row(options.courseLevels ?? ['ug'])],
      count: async () => 1,
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
      count: async () => 0,
      findMany: async () => [],
    },
    countryCourse: { findMany: async () => [] },
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

  it('refuses a level that does not exist', async () => {
    const service = new SubjectsService(prisma({}));
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

describe('a study level switched off after it was ticked', () => {
  it('lets the subject save, rewriting the active ticks and keeping the switched-off one', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(
      prisma(calls, { subjectLevels: ['ug', 'fd'] }),
    );
    /* What an editor opened before the level was switched off still sends. */
    await service.update(
      'cs',
      { name: 'Computer Science', courseLevelIds: ['pg', 'fd'] },
      request,
    );
    expect(
      (calls.subjectUpdate[0] as { data: { courseLevels: unknown } }).data
        .courseLevels,
    ).toEqual({
      deleteMany: { courseLevelId: { notIn: ['fd'] } },
      create: [{ courseLevelId: 'pg' }],
    });
  });

  it('lets the specialization save the same way, even with no active tick left', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(
      prisma(calls, { courseLevels: ['fd'] }),
    );
    await service.updateSubSubject(
      'cs',
      'ai',
      { name: 'Artificial Intelligence', courseLevelIds: ['fd'] },
      request,
    );
    expect(
      (calls.update[0] as { data: { courseLevels: unknown } }).data
        .courseLevels,
    ).toEqual({
      deleteMany: { courseLevelId: { notIn: ['fd'] } },
      create: [],
    });
  });

  it('is not added to a new record', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    await service.createSubSubject(
      'cs',
      { name: 'Artificial Intelligence', courseLevelIds: ['fd', 'pg'] },
      request,
    );
    expect(
      (calls.create[0] as { data: { courseLevels: unknown } }).data
        .courseLevels,
    ).toEqual({ create: [{ courseLevelId: 'pg' }] });
  });

  it('is not handed to the admin, so the editor has nothing hidden to send back', async () => {
    const service = new SubjectsService(
      prisma({}, { courseLevels: ['fd', 'ug'], subjectLevels: ['pg', 'fd'] }),
    );
    expect(
      (await service.getSpecialization('ai')).courseLevels.map(
        (level) => level.code,
      ),
    ).toEqual(['UG']);
    expect(
      (await service.getAdmin('cs')).courseLevels.map((level) => level.code),
    ).toEqual(['PG']);
  });

  it('is not shown on the subjects explorer or a specialization card', async () => {
    const service = new SubjectsService(
      prisma({}, { courseLevels: ['fd', 'ug'], subjectLevels: ['pg', 'fd'] }),
    );
    const subjects = await service.publicList({
      page: 1,
      limit: 12,
    });
    expect(subjects.data[0].levels.map((level) => level.code)).toEqual(['PG']);
    const specializations = await service.publicSpecializationList({});
    expect(specializations.data[0].levels.map((level) => level.code)).toEqual([
      'UG',
    ]);
  });
});
