import { parseCountryRelations, reconcileCountry } from './country-bulk';
import { bulkResource } from './bulk-resources';
import type { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

/**
 * Ticking a subject in the country editor takes its specializations with it.
 * The sheet attached the subject alone, so after importing 205 countries
 * every "Where you can study X" page was empty except for the one country
 * that had been filled in by hand -- and a `Subject > Child` term was looked
 * up, validated, and then thrown away.
 */

const SUBJECT = { id: 'subj-cs', slug: 'computing', name: 'Computing' };
const OTHER = { id: 'subj-eng', slug: 'engineering', name: 'Engineering' };
const SPECS = [
  {
    id: 'spec-it',
    slug: 'information-technology',
    name: 'Information Technology',
    subjectId: SUBJECT.id,
    status: 'PUBLISHED',
  },
  {
    id: 'spec-ml',
    slug: 'machine-learning',
    name: 'Machine Learning',
    subjectId: SUBJECT.id,
    status: 'PUBLISHED',
  },
  {
    id: 'spec-draft',
    slug: 'quantum',
    name: 'Quantum',
    subjectId: SUBJECT.id,
    status: 'DRAFT',
  },
  {
    id: 'spec-civil',
    slug: 'civil',
    name: 'Civil',
    subjectId: OTHER.id,
    status: 'PUBLISHED',
  },
];

function client() {
  return {
    subject: {
      findFirst: async ({
        where,
      }: {
        where: { OR: Array<{ slug?: string; name?: string }> };
      }) =>
        [SUBJECT, OTHER].find((row) =>
          where.OR.some(
            (term) => term.slug === row.slug || term.name === row.name,
          ),
        ) ?? null,
    },
    subSubject: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const or = where.OR as Array<{ slug?: string; name?: string }>;
        return (
          SPECS.find(
            (row) =>
              row.subjectId === where.subjectId &&
              or.some(
                (term) => term.slug === row.slug || term.name === row.name,
              ),
          ) ?? null
        );
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        SPECS.filter(
          (row) =>
            row.subjectId === where.subjectId && row.status === where.status,
        ).map((row) => ({ id: row.id })),
    },
    countryTag: { findFirst: async () => null },
    intake: { findFirst: async () => null },
  } as unknown as PrismaService;
}

const relationsFor = async (cell: string) => {
  const errors: string[] = [];
  const relations = await parseCountryRelations(
    { subject: cell },
    client(),
    errors,
  );
  return { relations, errors };
};

describe('what the subject cell resolves to', () => {
  it('brings a subject’s published specializations with it', async () => {
    const { relations, errors } = await relationsFor('computing');
    expect(errors).toEqual([]);
    expect(relations.subjects).toEqual({ kind: 'value', value: [SUBJECT.id] });
    expect(relations.subSubjects).toEqual({
      kind: 'value',
      value: ['spec-it', 'spec-ml'],
    });
  });

  it('leaves a draft specialization out', async () => {
    const { relations } = await relationsFor('computing');
    const value = (relations.subSubjects as { value: string[] }).value;
    expect(value).not.toContain('spec-draft');
  });

  it('pins just the one named after a “>”', async () => {
    /* The child was resolved to check it existed and then dropped. */
    const { relations, errors } = await relationsFor(
      'computing > information-technology',
    );
    expect(errors).toEqual([]);
    expect(relations.subSubjects).toEqual({
      kind: 'value',
      value: ['spec-it'],
    });
  });

  it('still refuses a child that belongs to another subject', async () => {
    const { errors } = await relationsFor('computing > civil');
    expect(errors.join(' ')).toContain('civil');
  });

  it('takes several subjects at once without repeating anything', async () => {
    const { relations } = await relationsFor(
      'computing | engineering | computing',
    );
    expect(relations.subjects).toEqual({
      kind: 'value',
      value: [SUBJECT.id, OTHER.id],
    });
    expect((relations.subSubjects as { value: string[] }).value).toEqual([
      'spec-it',
      'spec-ml',
      'spec-civil',
    ]);
  });

  it('says nothing about either when the column is absent', async () => {
    const errors: string[] = [];
    const relations = await parseCountryRelations({}, client(), errors);
    expect(relations.subjects.kind).toBe('absent');
    expect(relations.subSubjects.kind).toBe('absent');
  });
});

/** A stand-in for the two taxonomy tables inside the row's transaction. */
function tx() {
  const calls: Array<{ table: string; op: string; data?: unknown }> = [];
  const table = (name: string) => ({
    deleteMany: async () => {
      calls.push({ table: name, op: 'deleteMany' });
      return { count: 0 };
    },
    create: async ({ data }: { data: unknown }) => {
      calls.push({ table: name, op: 'create', data });
      return data;
    },
    createMany: async ({ data }: { data: unknown }) => {
      calls.push({ table: name, op: 'createMany', data });
      return { count: Array.isArray(data) ? data.length : 0 };
    },
    findMany: async () => [],
  });
  return {
    calls,
    client: {
      countrySubject: table('countrySubject'),
      countrySubSubject: table('countrySubSubject'),
      countryTagMap: table('countryTagMap'),
      countryIntake: table('countryIntake'),
    } as unknown as Prisma.TransactionClient,
  };
}

const absent = { kind: 'absent' as const };
const base = {
  subjects: absent,
  subSubjects: absent,
  tags: absent,
  intakes: absent,
  faqs: absent,
  sections: {},
  cost: null,
  work: null,
  language: null,
  statistics: null,
};

describe('writing them against the country', () => {
  it('replaces the specializations in one statement', async () => {
    const { calls, client } = tx();
    await reconcileCountry(client, 'country-1', {
      ...base,
      subSubjects: { kind: 'value', value: ['spec-it', 'spec-ml'] },
    });
    expect(calls).toEqual([
      { table: 'countrySubSubject', op: 'deleteMany' },
      {
        table: 'countrySubSubject',
        op: 'createMany',
        data: [
          { countryId: 'country-1', subSubjectId: 'spec-it', displayOrder: 0 },
          { countryId: 'country-1', subSubjectId: 'spec-ml', displayOrder: 1 },
        ],
      },
    ]);
  });

  it('clears them when the cell asked for that, writing nothing back', async () => {
    const { calls, client } = tx();
    await reconcileCountry(client, 'country-1', {
      ...base,
      subSubjects: { kind: 'clear' },
    });
    expect(calls).toEqual([{ table: 'countrySubSubject', op: 'deleteMany' }]);
  });

  it('does not touch them when the column was absent', async () => {
    /* A sheet about tuition must not empty a country’s taxonomy. */
    const { calls, client } = tx();
    await reconcileCountry(client, 'country-1', base);
    expect(calls.filter((call) => call.table === 'countrySubSubject')).toEqual(
      [],
    );
  });
});

/**
 * The unchanged check reads the columns the sheet carries. Specializations
 * are not one of them -- they come out of the `subject` cell -- so a country
 * whose subjects already match looked unchanged and was skipped whole, and
 * the specializations it had never been given were never written. Importing
 * the same sheet twice would not have fixed it, nor three times.
 */
describe('whether a row still has relation work', () => {
  const countries = bulkResource('countries');

  const prismaWith = (storedIds: string[]) =>
    ({
      countrySubSubject: {
        findMany: async () =>
          storedIds.map((subSubjectId) => ({ subSubjectId })),
      },
    }) as unknown as PrismaService;

  const relations = (cell: unknown) =>
    ({ subSubjects: cell }) as unknown as Record<string, unknown>;

  it('says yes when the country has none of them yet', async () => {
    const changed = await countries.relationsChanged!(
      'country-1',
      relations({ kind: 'value', value: ['spec-it', 'spec-ml'] }),
      prismaWith([]),
    );
    expect(changed).toBe(true);
  });

  it('says no when the stored set already matches, order aside', async () => {
    const changed = await countries.relationsChanged!(
      'country-1',
      relations({ kind: 'value', value: ['spec-it', 'spec-ml'] }),
      prismaWith(['spec-ml', 'spec-it']),
    );
    expect(changed).toBe(false);
  });

  it('says yes when the sheet adds one', async () => {
    const changed = await countries.relationsChanged!(
      'country-1',
      relations({ kind: 'value', value: ['spec-it', 'spec-ml'] }),
      prismaWith(['spec-it']),
    );
    expect(changed).toBe(true);
  });

  it('says yes when the sheet drops one', async () => {
    const changed = await countries.relationsChanged!(
      'country-1',
      relations({ kind: 'value', value: ['spec-it'] }),
      prismaWith(['spec-it', 'spec-ml']),
    );
    expect(changed).toBe(true);
  });

  it('says yes to clearing a country that still has some', async () => {
    const changed = await countries.relationsChanged!(
      'country-1',
      relations({ kind: 'clear' }),
      prismaWith(['spec-it']),
    );
    expect(changed).toBe(true);
  });

  it('says no when the column was absent, whatever is stored', async () => {
    /* A sheet about tuition is not an instruction about taxonomy. */
    const changed = await countries.relationsChanged!(
      'country-1',
      relations({ kind: 'absent' }),
      prismaWith(['spec-it']),
    );
    expect(changed).toBe(false);
  });
});
