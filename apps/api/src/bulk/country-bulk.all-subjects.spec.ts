import {
  ALL_SUBJECTS_TOKEN,
  parseCountryRelations,
  reconcileCountry,
} from './country-bulk';
import { bulkResource, exportCountryRow } from './bulk-resources';
import type { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

/**
 * A destination that lists every subject says so in two words.
 *
 * Every destination starts out listing all of them, so spelling the list
 * out put thirty subjects in the cell of two hundred and five rows. A bare
 * subject in that cell brings its specializations with it, which meant
 * re-importing an export nobody had touched looked up some six thousand
 * subjects one query at a time and then wrote every specialization against
 * every country.
 */

/** Throws on any lookup, so a test that passes proves none was made. */
function untouchable() {
  const refuse = (table: string) =>
    new Proxy(
      {},
      {
        get: (_target, method: string) => () => {
          throw new Error(`${table}.${method} was called`);
        },
      },
    );
  return {
    subject: refuse('subject'),
    subSubject: refuse('subSubject'),
    countryTag: refuse('countryTag'),
    intake: refuse('intake'),
  } as unknown as PrismaService;
}

const parse = async (cell: string) => {
  const errors: string[] = [];
  const relations = await parseCountryRelations(
    { subject: cell },
    untouchable(),
    errors,
  );
  return { relations, errors };
};

describe('reading the cell', () => {
  it('takes the phrase to mean every subject, without looking one up', async () => {
    const { relations, errors } = await parse(ALL_SUBJECTS_TOKEN);
    expect(errors).toEqual([]);
    expect(relations.subjects).toEqual({ kind: 'all' });
  });

  it('leaves the specializations as they are', async () => {
    /* The pages that list a destination's specializations read them from
       the subject. Writing them here is the hundred and ninety thousand
       rows this phrase exists to avoid. */
    const { relations } = await parse(ALL_SUBJECTS_TOKEN);
    expect(relations.subSubjects).toEqual({ kind: 'absent' });
  });

  it.each(['all subjects', 'ALL SUBJECTS', '  All subjects  '])(
    'reads %p the same way, because people retype cells',
    async (cell) => {
      const { relations } = await parse(cell);
      expect(relations.subjects).toEqual({ kind: 'all' });
    },
  );
});

/** A transaction stand-in that records what was written and removed. */
function tx(subjects: string[]) {
  const written: Array<{ data: unknown[]; skipDuplicates?: boolean }> = [];
  const removed: string[] = [];
  const table = (name: string) => ({
    findMany: async () => subjects.map((id) => ({ id })),
    createMany: async (args: { data: unknown[]; skipDuplicates?: boolean }) => {
      if (name === 'countrySubject') written.push(args);
      return { count: args.data.length };
    },
    create: async () => {
      throw new Error(`${name}.create was called`);
    },
    deleteMany: async () => {
      removed.push(name);
      return { count: 0 };
    },
  });
  return {
    written,
    removed,
    client: {
      subject: table('subject'),
      country: table('country'),
      countrySubject: table('countrySubject'),
      countrySubSubject: table('countrySubSubject'),
    } as unknown as Prisma.TransactionClient,
  };
}

const REST = {
  subSubjects: { kind: 'absent' },
  tags: { kind: 'absent' },
  faqs: { kind: 'absent' },
  sections: {},
  cost: null,
  work: null,
  language: null,
  statistics: null,
} as const;

describe('writing it', () => {
  it('fills in whatever is missing and removes nothing', async () => {
    /* The rows already there keep what they know: which of them a course
       stands behind, and the order an editor put them in. */
    const { written, removed, client } = tx(['s-1', 's-2', 's-3']);
    await reconcileCountry(client, 'c-1', {
      ...REST,
      subjects: { kind: 'all' },
    });
    expect(removed).toEqual([]);
    expect(written).toHaveLength(1);
    expect(written[0].skipDuplicates).toBe(true);
    expect(written[0].data).toHaveLength(3);
  });

  it('is not attached a second time by the first-import default', async () => {
    const { written, client } = tx(['s-1']);
    await bulkResource('countries').reconcile!(
      client,
      'c-1',
      { ...REST, subjects: { kind: 'all' } },
      true,
    );
    expect(written).toHaveLength(1);
  });
});

const link = (slug: string, deletedAt: Date | null = null) => ({
  subject: { slug, name: slug, deletedAt },
});

describe('writing the cell', () => {
  it('says the phrase for a destination that lists every subject', () => {
    const row = exportCountryRow(
      { subjectMaps: [link('law'), link('engineering')] },
      { subjectCount: 2 },
    );
    expect(row.subject).toBe(ALL_SUBJECTS_TOKEN);
  });

  it('names them one by one once an editor has narrowed the list', () => {
    const row = exportCountryRow(
      { subjectMaps: [link('law')] },
      { subjectCount: 2 },
    );
    expect(row.subject).toBe('law');
  });

  it('neither counts nor names an archived subject', () => {
    /* It is still linked, so restoring it brings its destinations back --
       but the importer cannot find it, and naming it would make the export
       fail its own re-import. */
    const row = exportCountryRow(
      { subjectMaps: [link('law'), link('alchemy', new Date())] },
      { subjectCount: 2 },
    );
    expect(row.subject).toBe('law');
  });

  it('says nothing for a catalogue with no subjects in it', () => {
    expect(
      exportCountryRow({ subjectMaps: [] }, { subjectCount: 0 }).subject,
    ).toBe('');
  });

  it('names them one by one when it was not told how many there are', () => {
    /* No count is no claim: "all" is only ever said against a number. */
    expect(exportCountryRow({ subjectMaps: [link('law')] }).subject).toBe(
      'law',
    );
  });
});
