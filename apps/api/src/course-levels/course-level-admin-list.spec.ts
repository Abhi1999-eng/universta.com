import { CourseLevelsService, LEVEL_USAGE } from './course-levels.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The admin's study levels list says where each level is used -- subjects
 * and specializations that tick it, courses and university programmes at
 * it, level pages with written copy -- and the address its level pages
 * live at. The public list stays as it was.
 */

const row = (id: string, code: string, counts: number[]) => ({
  id,
  code,
  name: code,
  description: null,
  educationOrder: 1,
  displayOrder: 1,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  _count: {
    subjects: counts[0],
    subSubjects: counts[1],
    courses: counts[2],
    universityCourseOfferings: counts[3],
    levelPages: counts[4],
  },
});

function prisma(seen: { findMany?: unknown }) {
  return {
    courseLevel: {
      count: async () => 2,
      findMany: async (args: { select?: unknown }) => {
        seen.findMany = args;
        if (args.select) return [];
        return [
          row('pg', 'PG', [3, 2, 6, 4, 2]),
          row('diploma', 'DIPLOMA', [0, 0, 0, 0, 0]),
        ];
      },
    },
  } as unknown as PrismaService;
}

describe("the admin's study levels list", () => {
  it('counts where each level is used, leaving deleted records out', async () => {
    const seen: { findMany?: unknown } = {};
    const result = await new CourseLevelsService(prisma(seen)).adminList({
      page: 1,
      limit: 100,
    });
    expect(seen.findMany).toMatchObject({
      include: { _count: { select: LEVEL_USAGE } },
    });
    expect(LEVEL_USAGE).toEqual({
      subjects: { where: { subject: { deletedAt: null } } },
      subSubjects: { where: { subSubject: { deletedAt: null } } },
      courses: { where: { deletedAt: null } },
      universityCourseOfferings: { where: { deletedAt: null } },
      levelPages: true,
    });
    expect(result.data[0]).toMatchObject({
      code: 'PG',
      slug: 'masters',
      usage: {
        subjects: 3,
        specializations: 2,
        courses: 6,
        programmes: 4,
        levelPages: 2,
      },
    });
    expect(result.data[1]).toMatchObject({
      slug: 'diploma',
      usage: {
        subjects: 0,
        specializations: 0,
        courses: 0,
        programmes: 0,
        levelPages: 0,
      },
    });
    expect(result.data.some((entry) => '_count' in entry)).toBe(false);
    expect(result.meta).toMatchObject({ page: 1, limit: 100, total: 2 });
  });

  it('gives the public list no counts', async () => {
    const seen: { findMany?: { select?: Record<string, boolean> } } = {};
    await new CourseLevelsService(prisma(seen)).publicList();
    expect(Object.keys(seen.findMany?.select ?? {}).sort()).toEqual([
      'code',
      'description',
      'displayOrder',
      'educationOrder',
      'id',
      'name',
    ]);
  });
});
