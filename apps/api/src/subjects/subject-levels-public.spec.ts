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
) => ({
  id,
  code,
  name,
  educationOrder,
  displayOrder: 0,
  status: 'ACTIVE',
});
const UG = level('ug', 'UG', "Bachelor's", 4);
const PG = level('pg', 'PG', "Master's", 6);
const PHD = level('phd', 'PHD', 'PhD', 8);
const FOUNDATION = level('f', 'FOUNDATION', 'Foundation Program', 1);
type Level = typeof UG;

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
}: {
  ticks: Level[];
  branches: ReturnType<typeof branch>[];
  courseLevels?: Level[];
}) {
  const row = subjectRow(ticks, branches);
  const all = [UG, PG, PHD, FOUNDATION];
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
          .map((child) => ({
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
          })),
    },
    course: {
      count: async () => courseLevels.length,
      findMany: async () =>
        courseLevels.map((courseLevel) => ({ courseLevel })),
      groupBy: async () => [],
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
