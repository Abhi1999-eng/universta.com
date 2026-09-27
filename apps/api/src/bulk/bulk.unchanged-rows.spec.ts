import { BulkOperationsService } from './bulk.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * What a re-upload costs.
 *
 * The way this tool is actually used is: export two hundred countries, edit
 * three of them, upload the whole file back. Every row that already said what
 * the sheet says used to be rewritten anyway -- two hundred deep writes, two
 * hundred moved `updatedAt` stamps, and an audit line claiming the catalogue
 * changed when three rows did. An import now reports what it did rather than
 * what it was handed.
 */

function fakeRequest(): AuthenticatedRequest {
  return {
    ip: '127.0.0.1',
    requestId: 'req-1',
    get: () => 'jest',
  } as unknown as AuthenticatedRequest;
}

/** The two countries stored, as the export projection would read them back. */
const STORED: Record<string, Record<string, unknown>> = {
  'id-india': {
    id: 'id-india',
    externalUid: 'IN',
    slug: 'india',
    name: 'India',
    status: 'PUBLISHED',
    shortDescription: 'Unchanged.',
    isFeatured: false,
    displayOrder: 1,
  },
  'id-kenya': {
    id: 'id-kenya',
    externalUid: 'KE',
    slug: 'kenya',
    name: 'Kenya',
    status: 'PUBLISHED',
    shortDescription: 'The old line.',
    isFeatured: false,
    displayOrder: 2,
  },
};

function build() {
  const update = jest.fn(({ where }: { where: { id: string } }) =>
    Promise.resolve({ id: where.id }),
  );
  const create = jest.fn(() => Promise.resolve({ id: 'id-new' }));
  const country = {
    findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        typeof where.id === 'string'
          ? (STORED[where.id] ?? null)
          : (Object.values(STORED).find(
              (row) =>
                (where.externalUid !== undefined &&
                  row.externalUid === where.externalUid) ||
                (where.externalUid === undefined && row.slug === where.slug),
            ) ?? null),
      ),
    ),
    update,
    create,
  };
  const prisma = {
    country,
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (fn: unknown) =>
      typeof fn === 'function'
        ? await (fn as (tx: unknown) => Promise<unknown>)({ country })
        : Promise.all(fn as Promise<unknown>[]),
    ),
  } as unknown as PrismaService;
  return { prisma, update, create, service: new BulkOperationsService(prisma) };
}

const csv = (rows: string[]) =>
  Buffer.from(['uid,title,excerpt', ...rows].join('\n'), 'utf8');

describe('re-uploading a sheet that mostly repeats itself', () => {
  it('skips the row that says nothing new and writes only the one that changed', async () => {
    const { service, update } = build();

    const summary = await service.import(
      'countries',
      csv(['IN,India,Unchanged.', 'KE,Kenya,A new line.']),
      'countries.csv',
      'upsert',
      fakeRequest(),
      'user-1',
    );

    expect(summary.unchanged).toBe(1);
    expect(summary.updated).toBe(1);
    expect(summary.failed).toBe(0);
    /* India is never written -- not a no-op update, no write at all. */
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'id-kenya' } }),
    );
  });

  it('lets an identical row through in create mode instead of failing it', async () => {
    const { service, update, create } = build();

    const summary = await service.import(
      'countries',
      csv(['IN,India,Unchanged.']),
      'countries.csv',
      'create',
      fakeRequest(),
      'user-1',
    );

    expect(summary.unchanged).toBe(1);
    expect(summary.failed).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('names the columns that differ when create mode refuses a real edit', async () => {
    const { service } = build();

    const summary = await service.import(
      'countries',
      csv(['KE,Kenya,A new line.']),
      'countries.csv',
      'create',
      fakeRequest(),
      'user-1',
    );

    expect(summary.failed).toBe(1);
    expect(summary.errors[0].errors[0]).toContain('excerpt');
    expect(summary.errors[0].errors[0]).toContain('upsert');
  });
});
