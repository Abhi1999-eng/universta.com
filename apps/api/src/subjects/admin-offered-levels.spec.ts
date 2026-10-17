import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The admin lists' "Levels" column read a record's own ticks, so a subject
 * with nothing ticked whose specializations are ticked for Bachelor's and
 * Master's read "--" in the admin and "Bachelor's, Master's" on the site.
 * Each row now also carries `offeredLevels`, the set the site's pages
 * follow: for a subject its ticks, its published specializations' ticks and
 * its published courses' levels; for a specialization its ticks and its own
 * courses' levels. Active levels only, Foundation first. Worked out for the
 * whole page in a fixed number of reads, however many rows it has.
 */

const level = (
  id: string,
  code: string,
  name: string,
  educationOrder: number,
  status = 'ACTIVE',
) => ({ id, code, name, educationOrder, displayOrder: 0, status });
const FOUNDATION = level('f', 'FOUNDATION', 'Foundation Program', 1);
const UG = level('ug', 'UG', "Bachelor's", 4);
const PG = level('pg', 'PG', "Master's", 6);
const PHD = level('phd', 'PHD', 'PhD', 8);
/* Switched off under "All levels". */
const DIPLOMA = level('dip', 'DIPLOMA', 'Diploma', 3, 'INACTIVE');
const LEVELS = [FOUNDATION, UG, PG, PHD, DIPLOMA];
type Level = (typeof LEVELS)[number];

const links = (levels: Level[]) =>
  levels.map((courseLevel) => ({ courseLevel }));
const stamp = new Date('2026-10-17T10:00:00Z');

function branch(id: string, ticks: Level[], status = 'PUBLISHED') {
  return { id, name: id, slug: id, status, courseLevels: links(ticks) };
}

function subject(
  id: string,
  ticks: Level[],
  branches: ReturnType<typeof branch>[] = [],
) {
  return {
    id,
    name: id,
    slug: id,
    shortDescription: null,
    overview: null,
    iconMedia: null,
    listingMedia: null,
    heroMedia: null,
    isFeatured: false,
    displayOrder: 0,
    status: 'PUBLISHED',
    publishedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    courseLevels: links(ticks),
    subSubjects: branches,
    _count: { courses: 0, countrySubjects: 0 },
  };
}

function specialization(id: string, ticks: Level[]) {
  return {
    ...branch(id, ticks),
    subjectId: 'cs',
    shortDescription: null,
    overview: null,
    iconMedia: null,
    listingMedia: null,
    isFeatured: false,
    displayOrder: 0,
    publishedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    subject: { id: 'cs', name: 'cs', slug: 'cs', status: 'PUBLISHED' },
    courseLevels: links(ticks),
  };
}

/* A published course: its subject, its specialization if any, its level. */
type Course = { subjectId: string; subSubjectId: string | null; level: Level };

function prisma(
  {
    subjects = [],
    specializations = [],
    courses = [],
  }: {
    subjects?: ReturnType<typeof subject>[];
    specializations?: ReturnType<typeof specialization>[];
    courses?: Course[];
  },
  calls: string[],
) {
  const inList = (filter: unknown, value: string | null) =>
    filter === undefined ||
    (Array.isArray((filter as { in?: string[] }).in) &&
      (filter as { in: string[] }).in.includes(value as string));
  return {
    subject: {
      count: async () => subjects.length,
      findMany: async () => subjects,
    },
    subSubject: {
      count: async () => specializations.length,
      findMany: async () => specializations,
    },
    course: {
      /* Grouped as the service asks: narrowed to the page's records, and
         to levels still switched on as TAUGHT says. */
      groupBy: async (args: { where: any }) => {
        calls.push('course.groupBy');
        const seen = new Map<string, object>();
        for (const course of courses) {
          if (!inList(args.where.subjectId, course.subjectId)) continue;
          if (!inList(args.where.subSubjectId, course.subSubjectId)) continue;
          if (
            args.where.courseLevel?.status &&
            course.level.status !== args.where.courseLevel.status
          )
            continue;
          const row = {
            subjectId: course.subjectId,
            subSubjectId: course.subSubjectId,
            courseLevelId: course.level.id,
          };
          seen.set(JSON.stringify(row), row);
        }
        return [...seen.values()];
      },
    },
    courseLevel: {
      findMany: async (args: { where: { id: { in: string[] } } }) => {
        calls.push('courseLevel.findMany');
        return LEVELS.filter((entry) => args.where.id.in.includes(entry.id));
      },
    },
  } as unknown as PrismaService;
}

const query = { page: 1, limit: 20 } as never;
const names = (levels: Array<{ name: string }>) =>
  levels.map((entry) => entry.name);

describe('the admin subject list', () => {
  it("lists each subject's offered levels: its ticks, its published specializations' and its courses'", async () => {
    const calls: string[] = [];
    const service = new SubjectsService(
      prisma(
        {
          subjects: [
            subject(
              'cs',
              [PG],
              [branch('ai', [UG]), branch('draft', [PHD], 'DRAFT')],
            ),
          ],
          courses: [
            { subjectId: 'cs', subSubjectId: null, level: FOUNDATION },
            { subjectId: 'cs', subSubjectId: 'ai', level: UG },
          ],
        },
        calls,
      ),
    );
    const [row] = (await service.adminList(query)).data;
    /* Foundation from a course, Bachelor's from a published branch and a
       course, Master's ticked; PhD is ticked only on a draft branch. */
    expect(names(row.offeredLevels)).toEqual([
      'Foundation Program',
      "Bachelor's",
      "Master's",
    ]);
    expect(row.offeredLevels[0]).toEqual({
      id: 'f',
      code: 'FOUNDATION',
      name: 'Foundation Program',
    });
    /* The own ticks stay as they were, for the editor's column. */
    expect(names(row.courseLevels)).toEqual(["Master's"]);
  });

  it('reads a subject with nothing ticked as offered at what its specializations are ticked for', async () => {
    const service = new SubjectsService(
      prisma(
        {
          subjects: [subject('cs', [], [branch('ai', [PG, UG])])],
        },
        [],
      ),
    );
    const [row] = (await service.adminList(query)).data;
    expect(row.courseLevels).toEqual([]);
    expect(names(row.offeredLevels)).toEqual(["Bachelor's", "Master's"]);
  });

  it('leaves out a level switched off, ticked or taught', async () => {
    const service = new SubjectsService(
      prisma(
        {
          subjects: [subject('cs', [DIPLOMA], [branch('ai', [DIPLOMA])])],
          courses: [{ subjectId: 'cs', subSubjectId: null, level: DIPLOMA }],
        },
        [],
      ),
    );
    const [row] = (await service.adminList(query)).data;
    expect(row.offeredLevels).toEqual([]);
  });

  it('works the page out in two reads, however many subjects it has', async () => {
    const calls: string[] = [];
    const service = new SubjectsService(
      prisma(
        {
          subjects: [
            subject('cs', [UG]),
            subject('eng', []),
            subject('law', [PG]),
          ],
          courses: [
            { subjectId: 'eng', subSubjectId: null, level: PHD },
            { subjectId: 'law', subSubjectId: null, level: UG },
          ],
        },
        calls,
      ),
    );
    const rows = (await service.adminList(query)).data;
    expect(rows.map((row) => names(row.offeredLevels))).toEqual([
      ["Bachelor's"],
      ['PhD'],
      ["Bachelor's", "Master's"],
    ]);
    expect(calls).toEqual(['course.groupBy', 'courseLevel.findMany']);
  });
});

describe('the admin specialization list', () => {
  it("lists each specialization's ticks and its own courses' levels, not its subject's", async () => {
    const calls: string[] = [];
    const service = new SubjectsService(
      prisma(
        {
          specializations: [
            specialization('ai', [PG]),
            specialization('ml', []),
          ],
          courses: [
            { subjectId: 'cs', subSubjectId: 'ai', level: UG },
            { subjectId: 'cs', subSubjectId: 'ai', level: DIPLOMA },
            /* The subject's own course reaches no specialization. */
            { subjectId: 'cs', subSubjectId: null, level: PHD },
          ],
        },
        calls,
      ),
    );
    const rows = (await service.adminSpecializationList(query)).data;
    expect(rows.map((row) => names(row.offeredLevels))).toEqual([
      ["Bachelor's", "Master's"],
      [],
    ]);
    expect(names(rows[0].courseLevels)).toEqual(["Master's"]);
    expect(calls).toEqual(['course.groupBy', 'courseLevel.findMany']);
  });

  it('asks nothing more for an empty page', async () => {
    const calls: string[] = [];
    const service = new SubjectsService(prisma({}, calls));
    expect((await service.adminSpecializationList(query)).data).toEqual([]);
    expect(calls).toEqual([]);
  });
});
