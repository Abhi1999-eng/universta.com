import { BulkOperationsService } from './bulk.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Two ways to say the same thing in the `subject` cell, and neither is an
 * edit.
 *
 * A destination that lists every subject downloads as "All subjects". A
 * sheet somebody typed names them one by one. The comparison used to know
 * only the downloaded spelling, so the typed sheet was marked changed on
 * every import, forever -- and in create mode, refused -- for a country it
 * described exactly.
 */

function fakeRequest(): AuthenticatedRequest {
  return {
    ip: '127.0.0.1',
    requestId: 'req-1',
    get: () => 'jest',
  } as unknown as AuthenticatedRequest;
}

const SUBJECTS = [
  { id: 's-law', slug: 'law', name: 'Law' },
  { id: 's-eng', slug: 'engineering', name: 'Engineering' },
];

/** A country linked to both subjects there are. */
const STORED = {
  id: 'id-uk',
  externalUid: 'UK',
  slug: 'united-kingdom',
  name: 'United Kingdom',
  status: 'PUBLISHED',
  shortDescription: 'Unchanged.',
  isFeatured: false,
  displayOrder: 1,
  subjectMaps: SUBJECTS.map((subject) => ({
    subject: { ...subject, deletedAt: null },
  })),
};

function build() {
  const update = jest.fn(() => Promise.resolve({ id: STORED.id }));
  const country = {
    findFirst: jest.fn(() => Promise.resolve(STORED)),
    update,
    create: jest.fn(),
  };
  /** Accepts whatever the reconciler writes; these tests only ask whether
   * the row was written at all. */
  const anyTable = new Proxy(
    {},
    { get: () => () => Promise.resolve({ count: 0 }) },
  );
  const prisma = {
    country,
    subject: {
      count: jest.fn().mockResolvedValue(SUBJECTS.length),
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: { OR: Array<{ slug?: string; name?: string }> };
        }) =>
          Promise.resolve(
            SUBJECTS.find((row) =>
              where.OR.some(
                (term) => term.slug === row.slug || term.name === row.name,
              ),
            ) ?? null,
          ),
      ),
    },
    subSubject: { findMany: jest.fn().mockResolvedValue([]) },
    countrySubSubject: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (fn: unknown) =>
      typeof fn === 'function'
        ? await (fn as (tx: unknown) => Promise<unknown>)({
            country,
            countrySubject: anyTable,
            countrySubSubject: anyTable,
          })
        : Promise.all(fn as Promise<unknown>[]),
    ),
  } as unknown as PrismaService;
  return { update, service: new BulkOperationsService(prisma) };
}

const upload = (cell: string, mode: 'upsert' | 'create' = 'upsert') => {
  const { service, update } = build();
  return service
    .import(
      'countries',
      Buffer.from(
        ['uid,title,subject', `UK,United Kingdom,${cell}`].join('\n'),
        'utf8',
      ),
      'countries.csv',
      mode,
      fakeRequest(),
      'user-1',
    )
    .then((summary) => ({ summary, update }));
};

describe('a country that lists every subject, re-imported', () => {
  it('is unchanged when the sheet says "All subjects", as the download does', async () => {
    const { summary, update } = await upload('All subjects');
    expect(summary).toMatchObject({ unchanged: 1, updated: 0, failed: 0 });
    expect(update).not.toHaveBeenCalled();
  });

  it('is unchanged when the sheet names every one of them instead', async () => {
    const { summary, update } = await upload('law | engineering');
    expect(summary).toMatchObject({ unchanged: 1, updated: 0, failed: 0 });
    expect(update).not.toHaveBeenCalled();
  });

  it('is unchanged when it names them by display name, in another order', async () => {
    const { summary } = await upload('Engineering | Law');
    expect(summary).toMatchObject({ unchanged: 1, updated: 0, failed: 0 });
  });

  it('is not refused in create mode for naming them one by one', async () => {
    /* Create mode rejects a row that would change an existing record. This
       one changes nothing. */
    const { summary } = await upload('law | engineering', 'create');
    expect(summary).toMatchObject({ unchanged: 1, failed: 0 });
  });

  it('is still written when the sheet narrows it', async () => {
    const { summary, update } = await upload('law');
    expect(summary).toMatchObject({ unchanged: 0, updated: 1, failed: 0 });
    expect(update).toHaveBeenCalledTimes(1);
  });
});
