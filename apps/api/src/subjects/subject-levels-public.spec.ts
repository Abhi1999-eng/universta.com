import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The levels a subject is offered at, as the public API gives them: what an
 * editor ticked on the subject, what its published specializations are
 * ticked for, and the levels its published courses stand at. The subject's
 * own ticks only add -- a subject ticked for Master's alone is still listed
 * at the Bachelor's its Data Science branch is ticked for.
 */

const level = (
  id: string,
  code: string,
  name: string,
  educationOrder: number,
  status = 'ACTIVE',
) => ({
  id,
  code,
  name,
  educationOrder,
  displayOrder: 0,
  status,
});
const UG = level('ug', 'UG', "Bachelor's", 4);
const PG = level('pg', 'PG', "Master's", 6);
const PHD = level('phd', 'PHD', 'PhD', 8);
const FOUNDATION = level('f', 'FOUNDATION', 'Foundation Program', 1);
/* Switched off under "All levels". */
const DIPLOMA = level('dip', 'DIPLOMA', 'Diploma', 3, 'INACTIVE');
type Level = typeof UG;
/* A published course: the specialization it is filed under, if any, and
   its level. */
type Course = { subSubjectId: string | null; courseLevel: Level };

const links = (levels: Level[]) =>
  levels.map((courseLevel) => ({ courseLevel }));

function branch(slug: string, ticks: Level[], status = 'PUBLISHED') {
  return {
    id: slug,
    name: slug,
    slug,
    status,
    courseLevels: links(ticks),
  };
}

function subjectRow(ticks: Level[], branches: ReturnType<typeof branch>[]) {
  return {
    id: 'cs',
    name: 'Computer Science & IT',
    slug: 'computer-science-it',
    shortDescription: 'Programming and systems.',
    overview: null,
    iconMedia: null,
    listingMedia: null,
    heroMedia: null,
    isFeatured: false,
    displayOrder: 1,
    status: 'PUBLISHED',
    courseLevels: links(ticks),
    subSubjects: branches,
    _count: { courses: 0, countrySubjects: 1 },
  };
}

function prisma({
  ticks,
  branches,
  courseLevels = [],
  courses = courseLevels.map((courseLevel) => ({
    subSubjectId: null,
    courseLevel,
  })),
}: {
  ticks: Level[];
  branches: ReturnType<typeof branch>[];
  courseLevels?: Level[];
  courses?: Course[];
}) {
  const row = subjectRow(ticks, branches);
  const all = [UG, PG, PHD, FOUNDATION, DIPLOMA];
  /* The published courses a read asks for: narrowed by specialization and
     by the level's status, as the service's `where` says. */
  const taught = (where: any = {}) =>
    courses.filter((course) => {
      const branchWhere = where.subSubjectId;
      if (branchWhere === undefined) return levelMatches(course, where);
      if (typeof branchWhere === 'string')
        return (
          course.subSubjectId === branchWhere && levelMatches(course, where)
        );
      if (branchWhere.in)
        return (
          branchWhere.in.includes(course.subSubjectId) &&
          levelMatches(course, where)
        );
      return course.subSubjectId !== null && levelMatches(course, where);
    });
  const branchRecord = (child: ReturnType<typeof branch>) => ({
    ...child,
    subjectId: 'cs',
    shortDescription: null,
    overview: null,
    iconMedia: null,
    listingMedia: null,
    isFeatured: false,
    displayOrder: 0,
    publishedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    subject: {
      id: 'cs',
      name: row.name,
      slug: row.slug,
      status: 'PUBLISHED',
      deletedAt: null,
    },
  });
  const levelMatches = (course: Course, where: any) =>
    !where.courseLevel?.status ||
    course.courseLevel.status === where.courseLevel.status;
  return {
    subject: {
      count: async () => 1,
      findMany: async () => [row],
      findFirst: async () => row,
    },
    subSubject: {
      /* The detail endpoint's own read of its published branches. */
      findMany: async () =>
        branches
          .filter((child) => child.status === 'PUBLISHED')
          .map(branchRecord),
      /* One specialization, for its admin record. */
      findFirst: async (args: { where: { id: string } }) => {
        const child = branches.find((entry) => entry.id === args.where.id);
        return child ? branchRecord(child) : null;
      },
    },
    course: {
      count: async () => courses.length,
      /* The levels read, not the featured cards (read with `include`). */
      findMany: async (args: { where: any; include?: unknown }) =>
        args.include
          ? []
          : taught(args.where).map(({ courseLevel }) => ({ courseLevel })),
      groupBy: async (args: { by: string[]; where: any }) => {
        const groups = new Map<string, Record<string, any>>();
        for (const course of taught(args.where)) {
          const keys = {
            courseLevelId: course.courseLevel.id,
            ...(args.by.includes('subSubjectId')
              ? { subSubjectId: course.subSubjectId }
              : {}),
          };
          const key = JSON.stringify(keys);
          const group = groups.get(key) ?? { ...keys, _count: { _all: 0 } };
          group._count._all += 1;
          groups.set(key, group);
        }
        return [...groups.values()];
      },
    },
    courseLevel: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        all.filter((entry) => args.where.id.in.includes(entry.id)),
    },
    countryCourse: { findMany: async () => [], groupBy: async () => [] },
    countrySubject: { findMany: async () => [] },
    countryLanguageRequirement: { findMany: async () => [] },
    seoMetadata: { findUnique: async () => null },
  } as unknown as PrismaService;
}

const query = { page: 1, limit: 12 } as Parameters<
  SubjectsService['publicList']
>[0];
const codes = (rows: Array<{ code: string | null }>) =>
  rows.map((row) => row.code);

describe('the levels the subject explorer lists a subject at', () => {
  it('adds its published specializations’ ticks to a narrower tick on the subject', async () => {
    const service = new SubjectsService(
      prisma({
        ticks: [PG],
        branches: [
          branch('data-science', [UG, PG]),
          branch('ai', [PG, PHD]),
          /* A draft branch does not speak for the subject. */
          branch('draft', [FOUNDATION], 'DRAFT'),
        ],
      }),
    );
    const [row] = (await service.publicList(query)).data;
    expect(codes(row.levels)).toEqual(['UG', 'PG', 'PHD']);
    expect(row.publishedSubSubjectCount).toBe(2);
    expect(row.subSubjects.map((child) => child.slug)).toEqual([
      'data-science',
      'ai',
    ]);
  });

  it('keeps a level ticked on the subject alone, and lists an unticked subject at its specializations’ levels', async () => {
    const extra = new SubjectsService(
      prisma({
        ticks: [FOUNDATION, UG],
        branches: [branch('data-science', [UG, PG])],
      }),
    );
    expect(codes((await extra.publicList(query)).data[0].levels)).toEqual([
      'FOUNDATION',
      'UG',
      'PG',
    ]);
    const unticked = new SubjectsService(
      prisma({
        ticks: [],
        branches: [branch('ai', [PG, PHD])],
        courseLevels: [UG],
      }),
    );
    expect(codes((await unticked.publicList(query)).data[0].levels)).toEqual([
      'UG',
      'PG',
      'PHD',
    ]);
  });
});

describe('the levels a subject’s page counts courses under', () => {
  it('lists every level ticked on it or on a published specialization, once each, in climbing order', async () => {
    const service = new SubjectsService(
      prisma({
        ticks: [PG],
        branches: [
          branch('data-science', [UG, PG]),
          branch('ai', [PG, PHD]),
          branch('draft', [FOUNDATION], 'DRAFT'),
        ],
      }),
    );
    const detail = await service.publicDetail('computer-science-it');
    expect(
      detail.courseCountsByLevel.map((row) => [row.level.code, row.count]),
    ).toEqual([
      ['UG', 0],
      ['PG', 0],
      ['PHD', 0],
    ]);
    /* What the subject itself ticked still travels on its own. */
    expect(codes(detail.offeredLevels)).toEqual(['PG']);
  });
});

/* A course can stand at a switched-off level: the bulk sheet takes any
   level code. Its level is not offered -- the course itself cannot be
   opened on the site -- and the website, told a field was offered at it,
   answered every level of that field with a 404. */
describe('a level switched off under "All levels"', () => {
  const courses: Course[] = [
    { subSubjectId: null, courseLevel: DIPLOMA },
    { subSubjectId: 'ai', courseLevel: DIPLOMA },
    { subSubjectId: 'ai', courseLevel: UG },
  ];
  const service = () =>
    new SubjectsService(
      prisma({ ticks: [], branches: [branch('ai', [])], courses }),
    );

  it('is not counted on the subject page, nor listed for its specializations', async () => {
    const detail = await service().publicDetail('computer-science-it');
    expect(
      detail.courseCountsByLevel.map((row) => [row.level.code, row.count]),
    ).toEqual([['UG', 1]]);
    expect(codes(detail.levels)).toEqual(['UG']);
    expect(
      detail.subSubjects.map((child) => [child.slug, codes(child.levels)]),
    ).toEqual([['ai', ['UG']]]);
  });

  it('is not listed for a subject in the explorer', async () => {
    const [row] = (await service().publicList(query)).data;
    expect(codes(row.levels)).toEqual(['UG']);
  });

  it("is not among a specialization's levels behind its courses", async () => {
    const specialization = await service().getSpecialization('ai');
    expect(codes(specialization.impliedCourseLevels)).toEqual(['UG']);
  });
});
