import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The levels the subject explorer lists a subject at: what an editor ticked
 * on the subject, what its published specializations are ticked for, and
 * the levels its published courses stand at. The subject's own ticks only
 * add -- a subject ticked for Master's alone is still listed at the
 * Bachelor's its Data Science branch is ticked for.
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

function subjectRow(ticks: Array<typeof UG>) {
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
    courseLevels: ticks.map((courseLevel) => ({ courseLevel })),
    subSubjects: [],
    _count: { courses: 0, countrySubjects: 1 },
  };
}

function prisma(
  calls: Record<string, unknown[]>,
  {
    ticks,
    branches,
    courseLevels = [],
  }: {
    ticks: Array<typeof UG>;
    branches: Array<Array<typeof UG>>;
    courseLevels?: Array<typeof UG>;
  },
) {
  return {
    subject: {
      count: async () => 1,
      findMany: async () => [subjectRow(ticks)],
    },
    subSubject: {
      count: async () => branches.length,
      findMany: async (args: unknown) => {
        (calls.branches ??= []).push(args);
        return branches.map((links) => ({
          courseLevels: links.map((courseLevel) => ({ courseLevel })),
        }));
      },
    },
    course: {
      count: async () => courseLevels.length,
      findMany: async () =>
        courseLevels.map((courseLevel) => ({ courseLevel })),
    },
    countryCourse: { findMany: async () => [] },
  } as unknown as PrismaService;
}

const query = { page: 1, limit: 12 } as Parameters<
  SubjectsService['publicList']
>[0];

describe('the levels the subject explorer lists a subject at', () => {
  it('adds its published specializations’ ticks to a narrower tick on the subject', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(
      prisma(calls, {
        ticks: [PG],
        branches: [
          [UG, PG],
          [PG, PHD],
        ],
      }),
    );
    const { data } = await service.publicList(query);
    expect(data[0].levels.map((row) => row.code)).toEqual(['UG', 'PG', 'PHD']);
    /* Only published, live specializations speak for the subject. */
    expect(calls.branches[0]).toMatchObject({
      where: { subjectId: 'cs', status: 'PUBLISHED', deletedAt: null },
    });
  });

  it('keeps a level ticked on the subject alone, and lists an unticked subject at its specializations’ levels', async () => {
    const extra = new SubjectsService(
      prisma({}, { ticks: [FOUNDATION, UG], branches: [[UG, PG]] }),
    );
    expect(
      (await extra.publicList(query)).data[0].levels.map((row) => row.code),
    ).toEqual(['FOUNDATION', 'UG', 'PG']);
    const unticked = new SubjectsService(
      prisma({}, { ticks: [], branches: [[PG, PHD]], courseLevels: [UG] }),
    );
    expect(
      (await unticked.publicList(query)).data[0].levels.map((row) => row.code),
    ).toEqual(['UG', 'PG', 'PHD']);
  });
});
