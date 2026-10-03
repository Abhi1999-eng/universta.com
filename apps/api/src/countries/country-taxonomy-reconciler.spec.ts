import {
  DERIVED,
  EDITORIAL,
  reconcileCountryTaxonomy,
} from './country-taxonomy-reconciler';
import type { PrismaClient } from '../generated/prisma/client';

/**
 * A destination's subjects and specializations were typed in and nothing
 * checked them against the courses taught there. A country could claim
 * Engineering with no engineering course behind it, and could teach
 * engineering courses without claiming the subject at all.
 *
 * They are worked out now -- but only the worked-out ones. A new market has
 * its guide before it has its catalogue, and the one destination filled in
 * by hand must survive every sweep.
 *
 * A subject link is never deleted, only re-marked. Every destination is
 * born listing every subject, so what the sweep works out for a subject is
 * whether a course stands behind the link, not whether the link exists.
 */

type Row = { id: string; source: string } & Record<string, string>;

function db(
  courses: Array<{ subjectId: string; subSubjectId: string | null }>,
  subjects: Row[] = [],
  specializations: Row[] = [],
) {
  const created: Record<string, unknown[]> = {
    subject: [],
    specialization: [],
  };
  const deleted: Record<string, string[]> = { subject: [], specialization: [] };
  /** Row id to the source it was re-marked with. */
  const marked: Record<string, Record<string, string>> = {
    subject: {},
    specialization: {},
  };
  const table = (
    rows: Row[],
    createdInto: unknown[],
    deletedInto: string[],
    markedInto: Record<string, string>,
  ) => ({
    findMany: async () => rows,
    createMany: async ({ data }: { data: unknown[] }) => {
      createdInto.push(...data);
      return { count: data.length };
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: { in: string[] } };
      data: { source: string };
    }) => {
      for (const id of where.id.in) markedInto[id] = data.source;
      return { count: where.id.in.length };
    },
    deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
      deletedInto.push(...where.id.in);
      return { count: where.id.in.length };
    },
  });
  return {
    created,
    deleted,
    marked,
    prisma: {
      countryCourse: {
        findMany: async () => courses.map((course) => ({ course })),
      },
      countrySubject: table(
        subjects,
        created.subject,
        deleted.subject,
        marked.subject,
      ),
      countrySubSubject: table(
        specializations,
        created.specialization,
        deleted.specialization,
        marked.specialization,
      ),
    } as unknown as PrismaClient,
  };
}

const sub = (id: string, source = DERIVED) =>
  ({ id: `cs-${id}`, subjectId: id, source }) as Row;
const spec = (id: string, source = DERIVED) =>
  ({ id: `css-${id}`, subSubjectId: id, source }) as Row;

describe('working a destination’s taxonomy out from its courses', () => {
  it('adds the subject a course brings with it', async () => {
    const { prisma, created } = db([
      { subjectId: 'engineering', subSubjectId: null },
    ]);
    const change = await reconcileCountryTaxonomy(prisma, 'c1');
    expect(change.subjectsAdded).toBe(1);
    expect(created.subject[0]).toMatchObject({
      countryId: 'c1',
      subjectId: 'engineering',
      source: DERIVED,
    });
  });

  it('adds the specialization too, when the course names one', async () => {
    const { prisma, created } = db([
      { subjectId: 'engineering', subSubjectId: 'mechanical' },
    ]);
    const change = await reconcileCountryTaxonomy(prisma, 'c1');
    expect(change.specializationsAdded).toBe(1);
    expect(created.specialization[0]).toMatchObject({
      subSubjectId: 'mechanical',
      source: DERIVED,
    });
  });

  it('hands a subject back to the editor once no course carries it', async () => {
    /* Not deleted. Every destination starts out listing every subject, and
       deleting here would take that link away for good the first time a
       programme was published and then withdrawn. */
    const { prisma, deleted, marked } = db([], [sub('engineering')]);
    const change = await reconcileCountryTaxonomy(prisma, 'c1');
    expect(change.subjectsRemoved).toBe(1);
    expect(marked.subject).toEqual({ 'cs-engineering': EDITORIAL });
    expect(deleted.subject).toEqual([]);
  });

  it('never takes away what an editor meant', async () => {
    /* A new market has its guide before it has its catalogue. */
    const { prisma, deleted, marked } = db([], [sub('engineering', EDITORIAL)]);
    const change = await reconcileCountryTaxonomy(prisma, 'c1');
    expect(change.subjectsRemoved).toBe(0);
    expect(deleted.subject).toEqual([]);
    expect(marked.subject).toEqual({});
  });

  it('marks a listed subject as taught when a course arrives under it', async () => {
    /* The usual case once every destination lists every subject: the link
       is already there, and left EDITORIAL the page would go on saying no
       programme stood behind a field that had one. */
    const { prisma, created, marked } = db(
      [{ subjectId: 'engineering', subSubjectId: null }],
      [sub('engineering', EDITORIAL)],
    );
    const change = await reconcileCountryTaxonomy(prisma, 'c1');
    expect(change.subjectsAdded).toBe(1);
    expect(marked.subject).toEqual({ 'cs-engineering': DERIVED });
    /* Re-marked, not written a second time: the pair is unique. */
    expect(created.subject).toEqual([]);
  });

  it('leaves a subject that is already marked taught alone', async () => {
    const { prisma, created, marked } = db(
      [{ subjectId: 'engineering', subSubjectId: null }],
      [sub('engineering')],
    );
    const change = await reconcileCountryTaxonomy(prisma, 'c1');
    expect(change.subjectsAdded).toBe(0);
    expect(change.subjectsRemoved).toBe(0);
    expect(created.subject).toEqual([]);
    expect(marked.subject).toEqual({});
  });

  it('touches only the subject whose courses changed', async () => {
    const { prisma, marked } = db(
      [{ subjectId: 'engineering', subSubjectId: null }],
      [sub('engineering', EDITORIAL), sub('law', EDITORIAL), sub('medicine')],
    );
    await reconcileCountryTaxonomy(prisma, 'c1');
    expect(marked.subject).toEqual({
      'cs-engineering': DERIVED,
      'cs-medicine': EDITORIAL,
    });
  });

  it('counts one subject once, however many courses carry it', async () => {
    const { prisma } = db([
      { subjectId: 'engineering', subSubjectId: 'mechanical' },
      { subjectId: 'engineering', subSubjectId: 'civil' },
      { subjectId: 'engineering', subSubjectId: 'mechanical' },
    ]);
    const change = await reconcileCountryTaxonomy(prisma, 'c1');
    expect(change.subjectsAdded).toBe(1);
    expect(change.specializationsAdded).toBe(2);
  });

  it('leaves a destination with no courses and no links alone', async () => {
    const { prisma, created, deleted } = db([]);
    const change = await reconcileCountryTaxonomy(prisma, 'c1');
    expect(change).toEqual({
      subjectsAdded: 0,
      subjectsRemoved: 0,
      specializationsAdded: 0,
      specializationsRemoved: 0,
    });
    expect(created.subject).toEqual([]);
    expect(deleted.specialization).toEqual([]);
  });

  it('removes a stale derived specialization while keeping an editorial one', async () => {
    /* Specializations are not attached by default, so theirs still come and
       go with the courses -- nothing is re-marked. */
    const { prisma, deleted, marked } = db(
      [],
      [],
      [spec('mechanical'), spec('civil', EDITORIAL)],
    );
    const change = await reconcileCountryTaxonomy(prisma, 'c1');
    expect(change.specializationsRemoved).toBe(1);
    expect(deleted.specialization).toEqual(['css-mechanical']);
    expect(marked.specialization).toEqual({});
  });
});
