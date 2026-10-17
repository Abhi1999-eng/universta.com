import { CourseLevelsService } from './course-levels.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * A study level and the pages written for it. Deleting a level takes its
 * level pages with it (through the schema) and their SEO rows (which have
 * no foreign key, so the delete removes them in the same transaction). A
 * level's code is also an address -- /subjects/<s>/<level> -- so a code a
 * specialization's slug already answers to is refused.
 */

const updatedAt = new Date('2026-10-17T10:00:00.000Z');
const current = {
  id: 'pg',
  code: 'PG',
  name: "Master's",
  description: null,
  educationOrder: 4,
  displayOrder: 4,
  status: 'ACTIVE',
  createdAt: updatedAt,
  updatedAt,
};

function prisma(
  calls: string[],
  {
    courses = 0,
    takenSlug = null,
  }: { courses?: number; takenSlug?: string | null } = {},
) {
  const op =
    (name: string, result: unknown = {}) =>
    (args: unknown) => {
      calls.push(`${name} ${JSON.stringify(args)}`);
      return Promise.resolve(result);
    };
  return {
    courseLevel: {
      findUnique: async () => current,
      delete: op('courseLevel.delete'),
      create: op('courseLevel.create', { ...current, id: 'new' }),
      update: op('courseLevel.update', current),
    },
    course: {
      count: async () => courses,
    },
    subjectLevelPage: {
      findMany: op('subjectLevelPage.findMany', [{ id: 'p1' }, { id: 'p2' }]),
    },
    subSubject: {
      findFirst: async (args: { where: { slug: { in: string[] } } }) => {
        calls.push(`subSubject.findFirst ${JSON.stringify(args.where)}`);
        return takenSlug && args.where.slug.in.includes(takenSlug)
          ? {
              name: 'Diploma Studies',
              slug: takenSlug,
              subject: { name: 'Computer Science' },
            }
          : null;
      },
    },
    seoMetadata: { deleteMany: op('seoMetadata.deleteMany') },
    $transaction: async (ops: Promise<unknown>[]) => {
      calls.push(`$transaction [${ops.length}]`);
      return Promise.all(ops);
    },
    auditLog: {
      create: async (args: { data: { oldValues?: unknown } }) => {
        calls.push(`audit ${JSON.stringify(args.data.oldValues ?? null)}`);
        return null;
      },
    },
  } as unknown as PrismaService;
}

const request = {
  user: { sub: 'admin-1' },
  headers: {},
  ip: '127.0.0.1',
  get: () => undefined,
} as unknown as AuthenticatedRequest;

describe('deleting a study level', () => {
  it('removes the SEO of its level pages with the level, in one transaction', async () => {
    const calls: string[] = [];
    await expect(
      new CourseLevelsService(prisma(calls)).remove(
        'pg',
        { expectedUpdatedAt: updatedAt.toISOString() },
        request,
      ),
    ).resolves.toEqual({ deleted: true });
    expect(calls).toContain(
      'subjectLevelPage.findMany {"where":{"courseLevelId":"pg"},"select":{"id":true}}',
    );
    expect(calls).toContain(
      'seoMetadata.deleteMany {"where":{"ownerType":"SUBJECT_LEVEL_PAGE","ownerId":{"in":["p1","p2"]}}}',
    );
    expect(calls).toContain('courseLevel.delete {"where":{"id":"pg"}}');
    expect(calls).toContain('$transaction [2]');
    expect(calls).toContain(
      `audit {"code":"PG","name":"Master's","levelPages":2}`,
    );
  });

  it('is still refused while a course uses it, touching nothing', async () => {
    const calls: string[] = [];
    await expect(
      new CourseLevelsService(prisma(calls, { courses: 1 })).remove(
        'pg',
        {},
        request,
      ),
    ).rejects.toMatchObject({ response: { code: 'COURSE_LEVEL_IN_USE' } });
    expect(calls).toEqual([]);
  });
});

describe("a study level's code against specialization slugs", () => {
  it('refuses a new code whose page address a specialization already uses', async () => {
    const calls: string[] = [];
    await expect(
      new CourseLevelsService(prisma(calls, { takenSlug: 'diploma' })).create(
        { code: 'DIPLOMA', name: 'Diploma' },
        request,
      ),
    ).rejects.toMatchObject({ response: { code: 'COURSE_LEVEL_SLUG_TAKEN' } });
    expect(calls.some((call) => call.startsWith('courseLevel.create'))).toBe(
      false,
    );
  });

  it('checks the readable slug as well as the code', async () => {
    const calls: string[] = [];
    await expect(
      new CourseLevelsService(prisma(calls, { takenSlug: 'masters' })).update(
        'pg',
        { code: 'PG2' },
        request,
      ),
    ).resolves.toBeDefined();
    expect(calls).toContain(
      'subSubject.findFirst {"deletedAt":null,"slug":{"in":["pg2"]}}',
    );
    await expect(
      new CourseLevelsService(prisma([], { takenSlug: 'masters' })).create(
        { code: 'PG', name: "Master's" },
        request,
      ),
    ).rejects.toMatchObject({ response: { code: 'COURSE_LEVEL_SLUG_TAKEN' } });
  });

  it('does not check a level whose code is left as it is', async () => {
    const calls: string[] = [];
    await new CourseLevelsService(prisma(calls, { takenSlug: 'pg' })).update(
      'pg',
      { status: 'INACTIVE' },
      request,
    );
    await new CourseLevelsService(prisma(calls, { takenSlug: 'pg' })).update(
      'pg',
      { code: 'PG', name: 'Masters' },
      request,
    );
    expect(calls.some((call) => call.startsWith('subSubject.findFirst'))).toBe(
      false,
    );
  });
});
