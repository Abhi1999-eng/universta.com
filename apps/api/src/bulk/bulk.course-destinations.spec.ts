import { bulkResource } from './bulk-resources';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * A course is listed publicly through its destinations: `publicWhere` ends in
 * `countryCourses: { some: ... }`, so a course with no offering is PUBLISHED
 * and still absent from /courses. The sheet had no way to give it one, which
 * is how 150 imported courses arrived to a page reading "0 Programmes".
 */

const COUNTRIES = [
  { id: 'c-ee', slug: 'estonia', name: 'Estonia' },
  { id: 'c-lv', slug: 'latvia', name: 'Latvia' },
  { id: 'c-de', slug: 'germany', name: 'Germany' },
];

function client() {
  return {
    subject: {
      findFirst: async () => ({ id: 'subject-1', slug: 'computer-science' }),
      findMany: async () => [],
    },
    courseLevel: {
      findFirst: async () => ({ id: 'level-pg', code: 'PG' }),
      findMany: async () => [],
    },
    subSubject: { findFirst: async () => null, findMany: async () => [] },
    country: {
      findFirst: async ({ where }: { where: { slug?: string } }) =>
        COUNTRIES.find((row) => row.slug === where.slug) ?? null,
      findMany: async ({ where }: { where: { name?: string } }) =>
        COUNTRIES.filter((row) => row.name === where.name),
    },
  } as unknown as PrismaService;
}

const courses = bulkResource('courses');

const row = (countrySlugs: string) =>
  ({
    name: 'MSc Artificial Intelligence',
    subjectSlug: 'computer-science',
    courseLevelCode: 'PG',
    countrySlugs,
  }) as Record<string, string>;

/** A stand-in for the `country_courses` table inside the row's transaction. */
function offerings(
  rows: Array<{ id: string; countryId: string; deletedAt?: Date | null }> = [],
) {
  const stored = rows.map((item) => ({ deletedAt: null, ...item }));
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  return {
    stored,
    created,
    updated,
    tx: {
      countryCourse: {
        findMany: async () => stored,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return data;
        },
        update: async (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          updated.push({ ...args.where, ...args.data });
          return args.data;
        },
      },
    },
  };
}

describe('the destinations column on a course row', () => {
  it('resolves a pipe-separated cell into the countries it names', async () => {
    const parsed = await courses.parseRow(row('estonia | latvia'), client());
    expect(parsed.errors).toBeUndefined();
    expect(parsed.relations).toEqual({ countryIds: ['c-ee', 'c-lv'] });
  });

  it('takes a destination by its display name too', async () => {
    const parsed = await courses.parseRow(row('Germany'), client());
    expect(parsed.relations).toEqual({ countryIds: ['c-de'] });
  });

  it('names the destination it could not find, against that row', async () => {
    const parsed = await courses.parseRow(row('estonia | narnia'), client());
    expect(parsed.errors?.join(' ')).toContain('narnia');
    expect(parsed.data).toBeUndefined();
  });

  it('counts a destination listed twice once', async () => {
    const parsed = await courses.parseRow(
      row('estonia | estonia | Estonia'),
      client(),
    );
    expect(parsed.relations).toEqual({ countryIds: ['c-ee'] });
  });

  it('leaves the cell meaning nothing when it is blank', async () => {
    const parsed = await courses.parseRow(row(''), client());
    expect(parsed.errors).toBeUndefined();
    expect(parsed.relations).toEqual({ countryIds: [] });
  });
});

describe('writing those destinations', () => {
  it('creates the offerings the row asks for', async () => {
    const { tx, created } = offerings();
    await courses.reconcile!(tx, 'course-1', {
      countryIds: ['c-ee', 'c-lv'],
    });
    expect(created).toEqual([
      { courseId: 'course-1', countryId: 'c-ee' },
      { courseId: 'course-1', countryId: 'c-lv' },
    ]);
  });

  it('leaves an offering that is already there alone', async () => {
    const { tx, created, updated } = offerings([
      { id: 'o-1', countryId: 'c-ee' },
    ]);
    await courses.reconcile!(tx, 'course-1', { countryIds: ['c-ee'] });
    expect(created).toEqual([]);
    expect(updated).toEqual([]);
  });

  it('revives one that had been archived rather than failing on its unique key', async () => {
    /* `@@unique([countryId, courseId])` survives a soft delete, so creating
       a second row for the same pair would be refused outright. */
    const { tx, created, updated } = offerings([
      { id: 'o-1', countryId: 'c-ee', deletedAt: new Date() },
    ]);
    await courses.reconcile!(tx, 'course-1', { countryIds: ['c-ee'] });
    expect(created).toEqual([]);
    expect(updated).toEqual([{ id: 'o-1', deletedAt: null, status: 'ACTIVE' }]);
  });

  it('never removes a destination the sheet left out', async () => {
    /* An offering carries tuition, intakes and entry requirements. Dropping
       one because a column was short would discard all of that silently. */
    const { tx, created, updated } = offerings([
      { id: 'o-1', countryId: 'c-ee' },
      { id: 'o-2', countryId: 'c-lv' },
    ]);
    await courses.reconcile!(tx, 'course-1', { countryIds: ['c-de'] });
    expect(created).toEqual([{ courseId: 'course-1', countryId: 'c-de' }]);
    expect(updated).toEqual([]);
  });

  it('does nothing at all when the row named none', async () => {
    const { tx, created, updated } = offerings([
      { id: 'o-1', countryId: 'c-ee' },
    ]);
    await courses.reconcile!(tx, 'course-1', { countryIds: [] });
    expect(created).toEqual([]);
    expect(updated).toEqual([]);
  });
});
