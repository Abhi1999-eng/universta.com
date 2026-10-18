import { CourseLevelsService } from './course-levels.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * A study level's code is fixed once the level exists: its level pages
 * live at /subjects/<s>/<slug of the code>, and saved filters and bulk
 * sheets find the level by it. A different code is refused before anything
 * is written; the same code re-sent, in any case, is accepted, because the
 * admin's older forms still send it with every save.
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

function prisma(calls: string[], writes: Record<string, unknown>[] = []) {
  return {
    courseLevel: {
      findUnique: async () => current,
      update: async (args: { data: Record<string, unknown> }) => {
        calls.push('courseLevel.update');
        writes.push(args.data);
        return { ...current, ...args.data };
      },
    },
    course: { count: async () => 0 },
    subSubject: {
      findFirst: async () => {
        calls.push('subSubject.findFirst');
        return null;
      },
    },
    auditLog: {
      create: async () => {
        calls.push('audit');
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

describe("a study level's code once the level exists", () => {
  it('refuses a different code, and writes and audits nothing', async () => {
    const calls: string[] = [];
    await expect(
      new CourseLevelsService(prisma(calls)).update(
        'pg',
        { code: 'PG2' },
        request,
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'COURSE_LEVEL_CODE_LOCKED', details: { code: 'PG' } },
    });
    expect(calls).toEqual([]);
  });

  it('accepts the same code with a new name and description', async () => {
    const calls: string[] = [];
    const writes: Record<string, unknown>[] = [];
    await new CourseLevelsService(prisma(calls, writes)).update(
      'pg',
      { code: 'PG', name: 'Masters', description: 'x' },
      request,
    );
    expect(writes[0]).toMatchObject({
      code: 'PG',
      name: 'Masters',
      description: 'x',
    });
    expect(calls).not.toContain('subSubject.findFirst');
  });

  it('accepts the same code in another case, and keeps the stored one', async () => {
    const writes: Record<string, unknown>[] = [];
    await new CourseLevelsService(prisma([], writes)).update(
      'pg',
      { code: 'pg' },
      request,
    );
    expect(writes[0]).toMatchObject({ code: 'PG' });
  });

  it('reports a stale form before the code', async () => {
    await expect(
      new CourseLevelsService(prisma([])).update(
        'pg',
        { code: 'PG2', expectedUpdatedAt: '2026-10-16T10:00:00.000Z' },
        request,
      ),
    ).rejects.toMatchObject({
      response: { code: 'COURSE_LEVEL_STALE_VERSION' },
    });
  });

  it('clears the description when it is sent empty', async () => {
    const writes: Record<string, unknown>[] = [];
    await new CourseLevelsService(prisma([], writes)).update(
      'pg',
      { description: null } as never,
      request,
    );
    expect(writes[0]).toMatchObject({ description: null, code: 'PG' });
  });

  it('still saves a status on its own', async () => {
    const writes: Record<string, unknown>[] = [];
    await new CourseLevelsService(prisma([], writes)).update(
      'pg',
      { status: 'INACTIVE' },
      request,
    );
    expect(writes[0]).toMatchObject({ status: 'INACTIVE', code: 'PG' });
  });
});
