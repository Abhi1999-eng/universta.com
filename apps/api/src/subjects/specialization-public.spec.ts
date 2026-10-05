import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * What a specialization's page is sent beyond the record itself: where it is
 * taught and how much, the universities that teach it, and siblings that can
 * fill a card rather than a bare name.
 */

const LEVELS = {
  phd: {
    id: 'phd',
    code: 'PHD',
    name: 'PhD',
    educationOrder: 8,
    displayOrder: 0,
  },
  ug: {
    id: 'ug',
    code: 'UG',
    name: "Bachelor's",
    educationOrder: 4,
    displayOrder: 0,
  },
  pg: {
    id: 'pg',
    code: 'PG',
    name: "Master's",
    educationOrder: 6,
    displayOrder: 0,
  },
};

function prisma(calls: Record<string, unknown[]>) {
  const record = (name: string) => (args: unknown) => {
    (calls[name] ??= []).push(args);
  };
  return {
    subject: {
      findFirst: async () => ({
        id: 'cs',
        slug: 'computer-science',
        name: 'Computer Science',
        shortDescription: null,
      }),
    },
    subSubject: {
      findFirst: async () => ({
        id: 'se',
        slug: 'software-engineering',
        name: 'Software Engineering',
        subjectId: 'cs',
        status: 'PUBLISHED',
      }),
      findMany: async () => [
        {
          id: 'ai',
          name: 'Artificial Intelligence',
          slug: 'artificial-intelligence',
          shortDescription: 'Machines that reason.',
        },
        {
          id: 'hci',
          name: 'Human-Computer Interaction',
          slug: 'hci',
          shortDescription: null,
        },
      ],
      count: async () => 11,
    },
    countrySubSubject: {
      findMany: async () =>
        [
          {
            id: 'af',
            name: 'Afghanistan',
            slug: 'afghanistan',
            iso2Code: 'AF',
            displayOrder: 0,
          },
          {
            id: 'gb',
            name: 'United Kingdom',
            slug: 'united-kingdom',
            iso2Code: 'GB',
            displayOrder: 3,
          },
          {
            id: 'ca',
            name: 'Canada',
            slug: 'canada',
            iso2Code: 'CA',
            displayOrder: 1,
          },
        ].map((country) => ({ country })),
    },
    countryCourse: {
      groupBy: async (args: unknown) => {
        record('countryCourse.groupBy')(args);
        return [
          { countryId: 'gb', _count: { _all: 2 } },
          { countryId: 'ca', _count: { _all: 3 } },
          { countryId: 'jp', _count: { _all: 1 } },
        ];
      },
    },
    country: {
      findMany: async (args: unknown) => {
        record('country.findMany')(args);
        return [
          {
            id: 'jp',
            name: 'Japan',
            slug: 'japan',
            iso2Code: 'JP',
            displayOrder: 9,
          },
        ];
      },
    },
    course: {
      findMany: async () => [],
      groupBy: async () => [
        { subSubjectId: 'ai', courseLevelId: 'phd', _count: { _all: 1 } },
        { subSubjectId: 'ai', courseLevelId: 'ug', _count: { _all: 2 } },
        { subSubjectId: 'ai', courseLevelId: 'pg', _count: { _all: 1 } },
      ],
    },
    courseLevel: {
      findMany: async () => Object.values(LEVELS),
    },
    university: {
      findMany: async (args: unknown) => {
        record('university.findMany')(args);
        return [
          {
            id: 'u1',
            name: 'Lakeside',
            slug: 'lakeside',
            country: { name: 'United States', slug: 'united-states' },
          },
          {
            id: 'u2',
            name: 'Typed By Hand',
            slug: 'Typed By Hand',
            country: { name: 'Canada', slug: 'canada' },
          },
          {
            id: 'u3',
            name: 'Northstar',
            slug: 'northstar',
            country: { name: 'Canada', slug: 'canada' },
          },
        ];
      },
      count: async () => 32,
    },
  } as unknown as PrismaService;
}

async function load() {
  const calls: Record<string, unknown[]> = {};
  const service = new SubjectsService(prisma(calls));
  const result = (await service.publicSpecialization(
    'computer-science',
    'software-engineering',
  )) as unknown as {
    countries: Array<{ id: string; courseCount: number }>;
    availableCountryCount: number;
    siblings: Array<{
      id: string;
      shortDescription: string | null;
      publishedCourseCount: number;
      levels: Array<{ code: string | null }>;
    }>;
    siblingTotal: number;
    universities: { total: number; data: Array<{ slug: string }> };
  };
  return { result, calls };
}

describe('a specialization’s public record', () => {
  it('lists the destinations that teach it first, most programmes first', async () => {
    const { result } = await load();
    expect(result.countries.map((row) => row.id)).toEqual([
      'ca',
      'gb',
      'jp',
      'af',
    ]);
    expect(result.countries.map((row) => row.courseCount)).toEqual([
      3, 2, 1, 0,
    ]);
  });

  it('counts the destinations that teach it, not every one that lists it', async () => {
    const { result } = await load();
    expect(result.availableCountryCount).toBe(3);
  });

  it('counts programmes by this specialization, open in a live country', async () => {
    const { calls } = await load();
    expect(calls['countryCourse.groupBy']?.[0]).toMatchObject({
      by: ['countryId'],
      where: {
        course: { subSubjectId: 'se', status: 'PUBLISHED', deletedAt: null },
        status: 'ACTIVE',
        availabilityStatus: { in: ['AVAILABLE', 'LIMITED'] },
        country: { status: 'PUBLISHED', deletedAt: null },
      },
    });
  });

  it('reads in a country that teaches it without an editorial link', async () => {
    const { calls } = await load();
    expect(calls['country.findMany']?.[0]).toMatchObject({
      where: { id: { in: ['jp'] } },
    });
  });

  it('names the universities whose live programmes are filed under it', async () => {
    const { result, calls } = await load();
    expect(calls['university.findMany']?.[0]).toMatchObject({
      where: {
        status: 'PUBLISHED',
        offerings: {
          some: {
            status: 'PUBLISHED',
            genericCourse: { subSubjectId: 'se', status: 'PUBLISHED' },
          },
        },
      },
    });
    expect(result.universities.total).toBe(32);
    /* A slug the router cannot serve is left out rather than linked. */
    expect(result.universities.data.map((row) => row.slug)).toEqual([
      'lakeside',
      'northstar',
    ]);
  });

  it('gives each sibling what its card states, levels in climbing order', async () => {
    const { result } = await load();
    const [ai, hci] = result.siblings;
    expect(ai).toMatchObject({
      shortDescription: 'Machines that reason.',
      publishedCourseCount: 4,
    });
    expect(ai.levels.map((row) => row.code)).toEqual(['UG', 'PG', 'PHD']);
    expect(hci).toMatchObject({ publishedCourseCount: 0, levels: [] });
    expect(result.siblingTotal).toBe(11);
  });
});
