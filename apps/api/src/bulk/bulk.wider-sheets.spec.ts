import { bulkResource } from './bulk-resources';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * A university row used to carry a name, a country, a type and one line; a
 * course row a name, a subject and a level. Everything else those pages show
 * had to be typed in afterwards, one record at a time, which is not what a
 * sheet is for. Both carry their page's content now.
 */

const SUBJECT = { id: 'subject-1', slug: 'computer-science' };
const OTHER_SUBJECT = { id: 'subject-2', slug: 'engineering' };
const LEVEL = { id: 'level-ug', slug: 'ug' };

function prisma(
  specializations: Array<{ id: string; slug: string; subjectId: string }>,
) {
  const lookups: Array<Record<string, unknown>> = [];
  return {
    lookups,
    client: {
      subject: {
        findFirst: async ({ where }: { where: { slug?: string } }) =>
          [SUBJECT, OTHER_SUBJECT].find((row) => row.slug === where.slug) ??
          null,
        findMany: async () => [],
      },
      courseLevel: {
        findFirst: async () => LEVEL,
        findMany: async () => [],
      },
      country: {
        findFirst: async () => ({ id: 'country-1', slug: 'estonia' }),
        findMany: async () => [],
      },
      subSubject: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          lookups.push(where);
          return (
            specializations.find(
              (row) =>
                row.slug === where.slug && row.subjectId === where.subjectId,
            ) ?? null
          );
        },
        findMany: async () => [],
      },
    } as unknown as PrismaService,
  };
}

const courses = bulkResource('courses');
const universities = bulkResource('universities');

const courseRow = (extra: Record<string, string> = {}) =>
  ({
    name: 'MSc Artificial Intelligence',
    subjectSlug: 'computer-science',
    courseLevelCode: 'PG',
    ...extra,
  }) as Record<string, string>;

describe('the course sheet', () => {
  it('carries the qualification, duration and the rest of the page', async () => {
    const { client } = prisma([]);
    const parsed = await courses.parseRow(
      courseRow({
        qualificationName: 'Master of Science',
        shortName: 'MSc',
        shortDescription: 'Two years of machine learning and its uses.',
        overview: '<p>What the degree covers.</p>',
        durationMin: '1',
        durationMax: '2',
        durationUnit: 'years',
        careerSummary: 'Research, engineering and policy roles.',
        displayOrder: '7',
        status: 'PUBLISHED',
      }),
      client,
    );
    expect(parsed.errors).toBeUndefined();
    expect(parsed.data).toMatchObject({
      qualificationName: 'Master of Science',
      shortName: 'MSc',
      overview: '<p>What the degree covers.</p>',
      durationMin: '1',
      durationMax: '2',
      // Accepted in any case, stored as the catalogue writes it.
      durationUnit: 'YEARS',
      careerSummary: 'Research, engineering and policy roles.',
      displayOrder: 7,
      status: 'PUBLISHED',
    });
  });

  it('looks a specialization up inside its own subject', async () => {
    const { client, lookups } = prisma([
      { id: 'spec-1', slug: 'machine-learning', subjectId: SUBJECT.id },
    ]);
    const parsed = await courses.parseRow(
      courseRow({ specializationSlug: 'machine-learning' }),
      client,
    );
    expect(parsed.errors).toBeUndefined();
    expect(parsed.data).toMatchObject({ subSubjectId: 'spec-1' });
    /* Scoped to the subject the row names: the same slug can belong to two
       subjects, and an unscoped read would attach the course to whichever
       one happened to come back first. */
    expect(lookups[0]).toMatchObject({ subjectId: SUBJECT.id });
  });

  it('says so when the specialization belongs to another subject', async () => {
    const { client } = prisma([
      { id: 'spec-2', slug: 'robotics', subjectId: OTHER_SUBJECT.id },
    ]);
    const parsed = await courses.parseRow(
      courseRow({ specializationSlug: 'robotics' }),
      client,
    );
    expect(parsed.errors?.join(' ')).toContain('robotics');
    expect(parsed.errors?.join(' ')).toContain('computer-science');
  });

  it('leaves the specialization unset when the cell is empty', async () => {
    const { client } = prisma([]);
    const parsed = await courses.parseRow(
      courseRow({ specializationSlug: '' }),
      client,
    );
    expect(parsed.errors).toBeUndefined();
    expect(parsed.data).toMatchObject({ subSubjectId: null });
  });

  it('rejects a duration that is not a number, and a unit it does not know', async () => {
    const { client } = prisma([]);
    const bad = await courses.parseRow(
      courseRow({ durationMin: 'three', durationUnit: 'FORTNIGHTS' }),
      client,
    );
    expect(bad.errors?.join(' ')).toContain('durationMin');
    expect(bad.errors?.join(' ')).toContain('durationUnit');
  });
});

describe('the university sheet', () => {
  const row = (extra: Record<string, string> = {}) =>
    ({
      name: 'Harbour Institute',
      countrySlug: 'estonia',
      shortDescription: 'A coastal institute.',
      ...extra,
    }) as Record<string, string>;

  it('carries the overview, ranking and citation', async () => {
    const { client } = prisma([]);
    const parsed = await universities.parseRow(
      row({
        institutionType: 'PUBLIC',
        qsRanking: '412',
        overview: '<p>Two campuses on the harbour.</p>',
        sourceReference: 'https://example.org/harbour',
        verifiedAt: '2026-10-01',
        displayOrder: '3',
        status: 'PUBLISHED',
      }),
      client,
    );
    expect(parsed.errors).toBeUndefined();
    expect(parsed.data).toMatchObject({
      institutionType: 'PUBLIC',
      qsRanking: 412,
      overview: '<p>Two campuses on the harbour.</p>',
      sourceReference: 'https://example.org/harbour',
      displayOrder: 3,
      status: 'PUBLISHED',
    });
    expect((parsed.data!.verifiedAt as Date).toISOString()).toContain(
      '2026-10-01',
    );
  });

  it('rejects a ranking that is not a whole number and a date that is not one', async () => {
    const { client } = prisma([]);
    const bad = await universities.parseRow(
      row({ qsRanking: 'top ten', verifiedAt: 'last tuesday' }),
      client,
    );
    expect(bad.errors?.join(' ')).toContain('qsRanking');
    expect(bad.errors?.join(' ')).toContain('verifiedAt');
  });

  it('leaves the optional columns null when they are blank', async () => {
    const { client } = prisma([]);
    const parsed = await universities.parseRow(row(), client);
    expect(parsed.data).toMatchObject({
      qsRanking: null,
      overview: null,
      sourceReference: null,
      verifiedAt: null,
    });
  });
});
