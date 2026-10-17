import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Deleting a subject or a specialization removes it from the database for
 * good, so its name and slug can be used again. A soft delete used to keep
 * the row -- and the slug -- taken. Its level pages go with it through the
 * schema; their SEO rows have no foreign key, so the delete removes them in
 * the same transaction.
 */

const updatedAt = new Date('2026-10-17T10:00:00Z');
const subject = {
  id: 'cs',
  name: 'QA Test Subject',
  slug: 'qa-test-subject',
  status: 'PUBLISHED',
  updatedAt,
  courseLevels: [],
  subSubjects: [],
};
const branch = {
  id: 'ai',
  subjectId: 'cs',
  name: 'QA Test Specialization',
  slug: 'qa-test-specialization',
  status: 'PUBLISHED',
  updatedAt,
};

function prisma(
  calls: string[],
  {
    courses = 0,
    deletedCourses = 0,
  }: { courses?: number; deletedCourses?: number } = {},
) {
  const op = (name: string) => (args: unknown) => {
    calls.push(`${name} ${JSON.stringify(args)}`);
    return Promise.resolve({});
  };
  return {
    /* Two pages under the subject itself or its specializations, one of
       them the specialization's. */
    subjectLevelPage: {
      findMany: async (args: { where: { subSubjectId?: string } }) => {
        calls.push(`subjectLevelPage.findMany ${JSON.stringify(args)}`);
        return args.where.subSubjectId
          ? [{ id: 'page-ai-pg' }]
          : [{ id: 'page-cs-ug' }, { id: 'page-ai-pg' }];
      },
    },
    subject: {
      findFirst: async () => subject,
      delete: op('subject.delete'),
      update: op('subject.update'),
    },
    subSubject: {
      findFirst: async () => branch,
      findMany: async () => [{ id: 'ai' }, { id: 'ml' }],
      delete: op('subSubject.delete'),
      deleteMany: op('subSubject.deleteMany'),
      update: op('subSubject.update'),
    },
    seoMetadata: { deleteMany: op('seoMetadata.deleteMany') },
    /* `courses` live course rows and `deletedCourses` soft-deleted ones;
       a count without `deletedAt` counts both. */
    course: {
      count: async (args: { where: { deletedAt?: unknown } }) => {
        calls.push(`course.count ${JSON.stringify(args)}`);
        if (args.where.deletedAt === null) return courses;
        if (args.where.deletedAt) return deletedCourses;
        return courses + deletedCourses;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => {
      calls.push(`$transaction ${ops.length}`);
      return Promise.all(ops);
    },
    auditLog: {
      create: async (args: { data: { newValues?: unknown } }) => {
        calls.push(`audit ${JSON.stringify(args.data.newValues ?? null)}`);
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
const expected = { expectedUpdatedAt: updatedAt.toISOString() };

describe('deleting a specialization', () => {
  it('removes the row and its SEO for good, never just marks it deleted', async () => {
    const calls: string[] = [];
    await new SubjectsService(prisma(calls)).removeSubSubject(
      'cs',
      'ai',
      expected,
      request,
    );
    expect(calls).toContain('subSubject.delete {"where":{"id":"ai"}}');
    expect(calls).toContain(
      'seoMetadata.deleteMany {"where":{"OR":[{"ownerType":"SUB_SUBJECT","ownerId":"ai"},{"ownerType":"SUBJECT_LEVEL_PAGE","ownerId":{"in":["page-ai-pg"]}}]}}',
    );
    expect(calls.some((call) => call.startsWith('subSubject.update'))).toBe(
      false,
    );
  });

  it('removes the SEO of its level pages in the same transaction', async () => {
    const calls: string[] = [];
    await new SubjectsService(prisma(calls)).removeSubSubject(
      'cs',
      'ai',
      expected,
      request,
    );
    expect(calls).toContain(
      'subjectLevelPage.findMany {"where":{"subSubjectId":"ai"},"select":{"id":true}}',
    );
    /* The SEO rows and the specialization go together: one transaction of
       two writes, with the pages cascading from the specialization. */
    expect(calls).toContain('$transaction 2');
    expect(calls).toContain(
      'audit {"deleted":true,"permanent":true,"levelPages":1}',
    );
  });

  it('is refused while a live course uses it', async () => {
    const calls: string[] = [];
    await expect(
      new SubjectsService(prisma(calls, { courses: 1 })).removeSubSubject(
        'cs',
        'ai',
        expected,
        request,
      ),
    ).rejects.toMatchObject({ response: { code: 'SUB_SUBJECT_IN_USE' } });
    expect(calls.some((call) => call.startsWith('subSubject.delete'))).toBe(
      false,
    );
  });
});

describe('deleting a subject', () => {
  it('removes it with every specialization under it and their SEO, for good', async () => {
    const calls: string[] = [];
    await new SubjectsService(prisma(calls)).remove('cs', expected, request);
    expect(calls).toContain(
      'subSubject.deleteMany {"where":{"subjectId":"cs"}}',
    );
    expect(calls).toContain('subject.delete {"where":{"id":"cs"}}');
    expect(calls).toContain(
      'seoMetadata.deleteMany {"where":{"OR":[{"ownerType":"SUBJECT","ownerId":"cs"},{"ownerType":"SUB_SUBJECT","ownerId":{"in":["ai","ml"]}},{"ownerType":"SUBJECT_LEVEL_PAGE","ownerId":{"in":["page-cs-ug","page-ai-pg"]}}]}}',
    );
    expect(calls.some((call) => call.startsWith('subject.update'))).toBe(false);
  });

  it("finds every level page by the subject's id, its specializations' too, and counts them", async () => {
    const calls: string[] = [];
    await new SubjectsService(prisma(calls)).remove('cs', expected, request);
    expect(calls).toContain(
      'subjectLevelPage.findMany {"where":{"subjectId":"cs"},"select":{"id":true}}',
    );
    expect(calls).toContain('$transaction 3');
    expect(calls).toContain(
      'audit {"deleted":true,"permanent":true,"specializations":2,"levelPages":2}',
    );
  });

  it('is refused while a live course still points at it, and says how many of each', async () => {
    const calls: string[] = [];
    await expect(
      new SubjectsService(
        prisma(calls, { courses: 2, deletedCourses: 1 }),
      ).remove('cs', expected, request),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        code: 'SUBJECT_IN_USE',
        message: 'A subject referenced by courses cannot be deleted',
        details: { liveCourses: 2, deletedCourses: 1 },
      },
    });
    expect(calls).toContain(
      'course.count {"where":{"subjectId":"cs","deletedAt":null}}',
    );
    expect(calls).toContain(
      'course.count {"where":{"subjectId":"cs","deletedAt":{"not":null}}}',
    );
    expect(calls.some((call) => call.startsWith('subject.delete'))).toBe(false);
  });

  /* The admin's course list hides deleted courses, so a subject whose only
     courses were deleted looked unused there and still could not go, with
     nothing saying why. They are named now, and left in place: removing
     them is not a side effect of deleting the subject. */
  it('is refused while only deleted courses point at it, and says so', async () => {
    const calls: string[] = [];
    await expect(
      new SubjectsService(prisma(calls, { deletedCourses: 3 })).remove(
        'cs',
        expected,
        request,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'SUBJECT_IN_USE',
        message:
          'Deleted courses still point at this subject; they must be removed first',
        details: { liveCourses: 0, deletedCourses: 3 },
      },
    });
    expect(calls.some((call) => call.startsWith('course.delete'))).toBe(false);
    expect(calls.some((call) => call.startsWith('$transaction'))).toBe(false);
  });
});
