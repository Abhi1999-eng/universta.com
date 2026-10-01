import { bulkResource } from './bulk-resources';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * A specialization has no sheet of its own: its slug is unique inside its
 * subject rather than across the table, so a row carrying only a slug names
 * nothing in particular. It rides on the subject's row instead, in one
 * pipe-separated column, the same shape the country sheet uses for its own
 * taxonomy.
 *
 * The column adds and renames; it never removes. A specialization has
 * courses hanging off it, and dropping one because a sheet left it out would
 * orphan them somewhere nobody was looking.
 */

const subjects = bulkResource('subjects');

type Row = { id: string; name: string; slug: string; deletedAt: Date | null };

function tx(existing: Row[]) {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<{ id: string; data: Record<string, unknown> }> = [];
  return {
    calls: { created, updated },
    client: {
      subSubject: {
        findMany: async () => existing,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return data;
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          updated.push({ id: where.id, data });
          return data;
        },
      },
    },
  };
}

const parse = (cell: string | undefined, status = 'DRAFT') =>
  subjects.parseRow(
    { name: 'Computer Science', specializations: cell, status } as Record<
      string,
      string
    >,
    {} as PrismaService,
  );
const listed = (parsed: { relations?: unknown }) =>
  (parsed.relations as { rows: unknown }).rows;

describe('specializations on the subject sheet', () => {
  it('reads a pipe-separated cell and derives each slug', async () => {
    const parsed = await parse('Artificial Intelligence | Cyber Security');
    expect(listed(parsed)).toEqual([
      { name: 'Artificial Intelligence', slug: 'artificial-intelligence' },
      { name: 'Cyber Security', slug: 'cyber-security' },
    ]);
  });

  it('ignores blank segments and repeats', async () => {
    const parsed = await parse(' Data Science ||  data science | ');
    expect(listed(parsed)).toEqual([
      { name: 'Data Science', slug: 'data-science' },
    ]);
  });

  it('treats an empty cell as nothing to say', async () => {
    expect(listed(await parse(undefined))).toEqual([]);
    expect(listed(await parse('   '))).toEqual([]);
  });

  it('creates the ones the subject does not have yet', async () => {
    const { client, calls } = tx([]);
    const parsed = await parse('Artificial Intelligence | Cyber Security');
    await subjects.reconcile!(client, 'subject-1', parsed.relations);

    expect(calls.created).toEqual([
      expect.objectContaining({
        subjectId: 'subject-1',
        name: 'Artificial Intelligence',
        slug: 'artificial-intelligence',
        status: 'DRAFT',
      }),
      expect.objectContaining({
        name: 'Cyber Security',
        slug: 'cyber-security',
      }),
    ]);
  });

  it('matches one that is already there rather than adding it twice', async () => {
    const { client, calls } = tx([
      {
        id: 'spec-1',
        name: 'Artificial Intelligence',
        slug: 'artificial-intelligence',
        deletedAt: null,
      },
    ]);
    const parsed = await parse('Artificial Intelligence | Cyber Security');
    await subjects.reconcile!(client, 'subject-1', parsed.relations);

    expect(calls.created).toHaveLength(1);
    expect(calls.created[0]).toMatchObject({ slug: 'cyber-security' });
    expect(calls.updated).toEqual([]);
  });

  it('renames one whose slug still matches', async () => {
    const { client, calls } = tx([
      {
        id: 'spec-1',
        name: 'Cyber Security',
        slug: 'cyber-security',
        deletedAt: null,
      },
    ]);
    // Same slug, new wording.
    const parsed = await parse('Cyber security');
    await subjects.reconcile!(client, 'subject-1', parsed.relations);

    expect(calls.created).toEqual([]);
    expect(calls.updated).toEqual([
      { id: 'spec-1', data: { name: 'Cyber security', deletedAt: null } },
    ]);
  });

  it('leaves out of the cell what it does not name', async () => {
    const { client, calls } = tx([
      {
        id: 'spec-keep',
        name: 'Machine Learning',
        slug: 'machine-learning',
        deletedAt: null,
      },
    ]);
    const parsed = await parse('Artificial Intelligence');
    await subjects.reconcile!(client, 'subject-1', parsed.relations);

    // Nothing is deleted: removal stays in the editor, where the courses
    // that depend on it are on screen.
    expect(calls.updated).toEqual([]);
    expect(calls.created).toHaveLength(1);
  });

  it('exports what the subject has, ready to re-upload', () => {
    expect(
      subjects.toExportRow({
        slug: 'computer-science',
        name: 'Computer Science',
        shortDescription: null,
        isFeatured: true,
        status: 'PUBLISHED',
        displayOrder: 0,
        subSubjects: [
          { name: 'Artificial Intelligence' },
          { name: 'Cyber Security' },
        ],
      }),
    ).toMatchObject({
      specializations: 'Artificial Intelligence | Cyber Security',
    });
  });
});

describe('the publication state of a bulk-created specialization', () => {
  it('follows the row that named it', async () => {
    const published = tx([]);
    await subjects.reconcile!(
      published.client,
      'subject-1',
      (await parse('Artificial Intelligence', 'PUBLISHED')).relations,
    );
    expect(published.calls.created[0]).toMatchObject({ status: 'PUBLISHED' });
    expect(published.calls.created[0].publishedAt).toBeInstanceOf(Date);

    const draft = tx([]);
    await subjects.reconcile!(
      draft.client,
      'subject-1',
      (await parse('Artificial Intelligence', 'DRAFT')).relations,
    );
    expect(draft.calls.created[0]).toMatchObject({ status: 'DRAFT' });
    expect(draft.calls.created[0].publishedAt).toBeUndefined();
  });
});

/**
 * The subject sheet carries specializations as names and derives each slug
 * from the name. A catalogue that spells "Accounting & Finance" as
 * `accounting-and-finance` does not agree with that derivation, which drops
 * the ampersand: `accounting-finance`. Exporting those subjects and
 * importing the export straight back therefore created a second row beside
 * every one of them -- 27 of the 1,077 on the demo.
 */
describe('a specialization whose slug is not its name slugified', () => {
  const stored = [
    {
      id: 'spec-1',
      name: 'Accounting & Finance',
      slug: 'accounting-and-finance',
      deletedAt: null,
    },
  ];

  function table() {
    const created: Array<Record<string, unknown>> = [];
    const updated: Array<Record<string, unknown>> = [];
    return {
      created,
      updated,
      tx: {
        subSubject: {
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

  const subjects = bulkResource('subjects');

  it('is recognised by its name, and not created a second time', async () => {
    const parsed = await subjects.parseRow(
      {
        name: 'Business & Management',
        specializations: 'Accounting & Finance',
        status: 'PUBLISHED',
      },
      {} as never,
    );
    const { tx, created } = table();
    await subjects.reconcile!(tx, 'subject-1', parsed.relations);
    expect(created).toEqual([]);
  });

  it('still creates one the subject really does not have', async () => {
    const parsed = await subjects.parseRow(
      {
        name: 'Business & Management',
        specializations: 'Accounting & Finance | Risk & Insurance',
        status: 'PUBLISHED',
      },
      {} as never,
    );
    const { tx, created } = table();
    await subjects.reconcile!(tx, 'subject-1', parsed.relations);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ name: 'Risk & Insurance' });
  });
});
