import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The universities that teach one specialization, in one destination when
 * the page asking is about one.
 *
 * The university list narrows to a subject and not to a branch of one, so a
 * page about Software Engineering in the United Kingdom could only name
 * every UK university teaching any Computer Science. These hold the query
 * that answers the narrower question, and the shape the page reads.
 */

type Captured = {
  where?: Record<string, unknown>;
  findMany?: Record<string, unknown>;
};

const SPECIALIZATION = { id: 'spec-se', subjectId: 'subj-cs' };

function prisma(
  captured: Captured,
  options: {
    specialization?: typeof SPECIALIZATION | null;
    rows?: unknown[];
    total?: number;
  } = {},
) {
  return {
    subSubject: {
      findFirst: async () =>
        options.specialization === undefined
          ? SPECIALIZATION
          : options.specialization,
    },
    university: {
      count: async (args: { where: Record<string, unknown> }) => {
        captured.where = args.where;
        return options.total ?? 0;
      },
      findMany: async (args: Record<string, unknown>) => {
        captured.findMany = args;
        return options.rows ?? [];
      },
    },
  } as unknown as PrismaService;
}

const row = (
  slug: string,
  campus: { city: string | null; cityRef: { name: string } | null } | null,
) => ({
  id: slug,
  name: slug,
  slug,
  qsRanking: null,
  campuses: campus ? [campus] : [],
});

describe('the universities that teach a specialization', () => {
  it('counts a university by a live offering filed under this specialization', async () => {
    const captured: Captured = {};
    const service = new SubjectsService(prisma(captured));
    await service.publicSpecializationUniversities(
      'computer-science',
      'software-engineering',
      { limit: 6 },
    );
    const offerings = captured.where?.offerings as {
      some: Record<string, unknown>;
    };
    expect(offerings.some.genericCourse).toEqual({
      subjectId: 'subj-cs',
      subSubjectId: 'spec-se',
    });
    /* Live by the same rule the university list applies: published, not
       deleted, inside its publish window. */
    expect(offerings.some).toMatchObject({
      status: 'PUBLISHED',
      deletedAt: null,
    });
    expect(captured.where).toMatchObject({
      status: 'PUBLISHED',
      deletedAt: null,
      country: { status: 'PUBLISHED', deletedAt: null },
    });
  });

  it('narrows to one destination when asked', async () => {
    const captured: Captured = {};
    const service = new SubjectsService(prisma(captured));
    await service.publicSpecializationUniversities(
      'computer-science',
      'software-engineering',
      { country: 'united-kingdom', limit: 6 },
    );
    expect(captured.where?.country).toEqual({
      status: 'PUBLISHED',
      deletedAt: null,
      slug: 'united-kingdom',
    });
  });

  it('names the ranked first, then A to Z, and counts all of them', async () => {
    const captured: Captured = {};
    const service = new SubjectsService(
      prisma(captured, {
        total: 9,
        rows: [row('university-of-edinburgh', null)],
      }),
    );
    const result = await service.publicSpecializationUniversities(
      'computer-science',
      'software-engineering',
      { limit: 6 },
    );
    expect(captured.findMany?.orderBy).toEqual([
      { qsRanking: { sort: 'asc', nulls: 'last' } },
      { name: 'asc' },
    ]);
    expect(captured.findMany?.take).toBe(6);
    expect(result.meta).toEqual({ total: 9, limit: 6 });
  });

  it("gives each one's main city, the campus's own text first", async () => {
    const service = new SubjectsService(
      prisma(
        {},
        {
          total: 3,
          rows: [
            row('edinburgh', { city: ' Edinburgh ', cityRef: { name: 'X' } }),
            row('warwick', { city: null, cityRef: { name: 'Coventry' } }),
            row('kingsley', null),
          ],
        },
      ),
    );
    const result = await service.publicSpecializationUniversities(
      'computer-science',
      'software-engineering',
      { limit: 6 },
    );
    expect(result.data.map((entry) => [entry.slug, entry.city])).toEqual([
      ['edinburgh', 'Edinburgh'],
      ['warwick', 'Coventry'],
      ['kingsley', null],
    ]);
  });

  it('does not offer an address the router cannot route', async () => {
    const service = new SubjectsService(
      prisma(
        {},
        { total: 2, rows: [row('fine-slug', null), row('Bad Slug', null)] },
      ),
    );
    const result = await service.publicSpecializationUniversities(
      'computer-science',
      'software-engineering',
      { limit: 6 },
    );
    expect(result.data.map((entry) => entry.slug)).toEqual(['fine-slug']);
  });

  it('is not found for a specialization that is not published there', async () => {
    const service = new SubjectsService(prisma({}, { specialization: null }));
    await expect(
      service.publicSpecializationUniversities('computer-science', 'nope', {
        limit: 6,
      }),
    ).rejects.toMatchObject({
      response: { code: 'SPECIALIZATION_NOT_FOUND' },
    });
  });
});
