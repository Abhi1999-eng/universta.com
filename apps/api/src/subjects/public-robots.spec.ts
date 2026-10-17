import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The public subject and specialization lists say whether each record is
 * kept out of search, the way its own page decides it: `robotsIndex` is the
 * record's own SEO setting, else the bulk template's for its kind, else
 * null. The sitemap reads the lists and used to announce pages whose own
 * page said noindex. A fixed number of reads per list page, not one per
 * row.
 */

const stamp = new Date('2026-10-17T10:00:00Z');
const subject = (id: string) => ({
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
  courseLevels: [],
  subSubjects: [],
  _count: { courses: 0, countrySubjects: 0 },
});
const specialization = (id: string) => ({
  id,
  name: id,
  slug: id,
  subjectId: 'cs',
  shortDescription: null,
  overview: null,
  iconMedia: null,
  listingMedia: null,
  isFeatured: false,
  displayOrder: 0,
  status: 'PUBLISHED',
  createdAt: stamp,
  updatedAt: stamp,
  courseLevels: [],
  subject: { id: 'cs', name: 'cs', slug: 'cs', status: 'PUBLISHED' },
});

function prisma(
  calls: Array<{ ownerType: string; ids: string[] }>,
  templates: Record<string, { robotsIndex: boolean | null }> = {},
  templateReads: string[] = [],
) {
  /* "cs" and "ai" keep a page in search, "law" and "ml" keep one out;
     "eng" and "nlp" have no SEO row. */
  const rows = [
    { ownerType: 'SUBJECT', ownerId: 'cs', robotsIndex: true },
    { ownerType: 'SUBJECT', ownerId: 'law', robotsIndex: false },
    { ownerType: 'SUB_SUBJECT', ownerId: 'ai', robotsIndex: true },
    { ownerType: 'SUB_SUBJECT', ownerId: 'ml', robotsIndex: false },
    /* Another owner type with the same id is not the record's. */
    { ownerType: 'COURSE', ownerId: 'eng', robotsIndex: false },
  ];
  return {
    subject: {
      count: async () => 3,
      findMany: async () => [subject('cs'), subject('eng'), subject('law')],
    },
    subSubject: {
      count: async () => 3,
      findMany: async () => [
        specialization('ai'),
        specialization('ml'),
        specialization('nlp'),
      ],
    },
    course: {
      count: async () => 0,
      findMany: async () => [],
      groupBy: async () => [],
    },
    countryCourse: { findMany: async () => [] },
    courseLevel: { findMany: async () => [] },
    seoMetadata: {
      findMany: async (args: {
        where: { ownerType: string; ownerId: { in: string[] } };
      }) => {
        calls.push({
          ownerType: args.where.ownerType,
          ids: args.where.ownerId.in,
        });
        return rows
          .filter(
            (row) =>
              row.ownerType === args.where.ownerType &&
              args.where.ownerId.in.includes(row.ownerId),
          )
          .map(({ ownerId, robotsIndex }) => ({ ownerId, robotsIndex }));
      },
    },
    seoBulkTemplate: {
      findUnique: async (args: { where: { entityType: string } }) => {
        templateReads.push(args.where.entityType);
        return templates[args.where.entityType] ?? null;
      },
    },
  } as unknown as PrismaService;
}

describe('the public lists', () => {
  it('give each subject its own robots setting, null without an SEO row', async () => {
    const calls: Array<{ ownerType: string; ids: string[] }> = [];
    const result = await new SubjectsService(prisma(calls)).publicList({
      page: 1,
      limit: 20,
    });
    expect(result.data.map((row) => [row.slug, row.robotsIndex])).toEqual([
      ['cs', true],
      ['eng', null],
      ['law', false],
    ]);
    expect(calls).toEqual([
      { ownerType: 'SUBJECT', ids: ['cs', 'eng', 'law'] },
    ]);
  });

  it('give each specialization its own robots setting, null without an SEO row', async () => {
    const calls: Array<{ ownerType: string; ids: string[] }> = [];
    const result = await new SubjectsService(
      prisma(calls),
    ).publicSpecializationList({});
    expect(result.data.map((row) => [row.slug, row.robotsIndex])).toEqual([
      ['ai', true],
      ['ml', false],
      ['nlp', null],
    ]);
    expect(calls).toEqual([
      { ownerType: 'SUB_SUBJECT', ids: ['ai', 'ml', 'nlp'] },
    ]);
  });
  /* An editor's own setting wins; a record with no SEO row takes the bulk
     template's, as its page does, so a template that keeps a kind out of
     search keeps it out of the sitemap too. */
  it("give a subject without its own setting the template's", async () => {
    const reads: string[] = [];
    const result = await new SubjectsService(
      prisma([], { subject: { robotsIndex: false } }, reads),
    ).publicList({ page: 1, limit: 20 });
    expect(result.data.map((row) => [row.slug, row.robotsIndex])).toEqual([
      ['cs', true],
      ['eng', false],
      ['law', false],
    ]);
    /* Once for the page, and the subjects' template only. */
    expect(reads).toEqual(['subject']);
  });

  it("give a specialization without its own setting the template's", async () => {
    const reads: string[] = [];
    const service = new SubjectsService(
      prisma(
        [],
        {
          specialization: { robotsIndex: false },
          /* Another kind's template is not the specialization's. */
          subject: { robotsIndex: true },
        },
        reads,
      ),
    );
    const result = await service.publicSpecializationList({});
    expect(result.data.map((row) => [row.slug, row.robotsIndex])).toEqual([
      ['ai', true],
      ['ml', false],
      ['nlp', false],
    ]);
    expect(reads).toEqual(['specialization']);
  });

  it('keep an own setting that lets search in over a template that does not', async () => {
    const result = await new SubjectsService(
      prisma([], { specialization: { robotsIndex: false } }),
    ).publicSpecializationList({});
    expect(result.data.find((row) => row.slug === 'ai')?.robotsIndex).toBe(
      true,
    );
  });

  it('leave null where the template does not decide either', async () => {
    const subjects = await new SubjectsService(
      prisma([], { subject: { robotsIndex: null } }),
    ).publicList({ page: 1, limit: 20 });
    expect(subjects.data.find((row) => row.slug === 'eng')?.robotsIndex).toBe(
      null,
    );
    const lettingIn = await new SubjectsService(
      prisma([], { specialization: { robotsIndex: true } }),
    ).publicSpecializationList({});
    expect(lettingIn.data.find((row) => row.slug === 'nlp')?.robotsIndex).toBe(
      true,
    );
  });
});
