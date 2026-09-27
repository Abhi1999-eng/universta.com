import { BulkOperationsService } from './bulk.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * What archiving leaves behind.
 *
 * A country's name, slug and ISO codes are each unique together with its
 * `deletedKey`, which is empty while the row is live. Archiving without
 * filling that key leaves ("algeria", "") in the index, so the slug stays
 * taken and the country can never be created again -- not by hand, and not
 * by the import that put it there. The editor's own delete has always filled
 * it; bulk archive is the same soft delete and did not.
 *
 * Found by archiving a test import and asking what would happen when the
 * same spreadsheet was uploaded a second time.
 */

function fakeRequest(): AuthenticatedRequest {
  return {
    ip: '127.0.0.1',
    requestId: 'req-1',
    get: () => 'jest',
  } as unknown as AuthenticatedRequest;
}

function build(model: string) {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    [model]: { updateMany },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  return { prisma, updateMany, service: new BulkOperationsService(prisma) };
}

describe('bulk archive and the keys it holds', () => {
  it('hands a country its own id so the slug it used is free again', async () => {
    const { service, updateMany } = build('country');

    const result = await service.bulkArchive(
      'countries',
      ['id-a', 'id-b'],
      fakeRequest(),
      'user-1',
    );

    expect(result.archived).toBe(2);
    /* One call per row: each row's key is its own id, which updateMany
       cannot express for a set. */
    expect(updateMany).toHaveBeenCalledTimes(2);
    for (const id of ['id-a', 'id-b'])
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id, deletedAt: null },
          data: expect.objectContaining({
            status: 'ARCHIVED',
            deletedKey: id,
          }),
        }),
      );
  });

  it('still marks the row deleted, not merely archived', async () => {
    const { service, updateMany } = build('country');
    await service.bulkArchive('countries', ['id-a'], fakeRequest(), 'user-1');
    const [{ data }] = updateMany.mock.calls[0] as [
      { data: { deletedAt: Date } },
    ];
    expect(data.deletedAt).toBeInstanceOf(Date);
  });

  /* Only countries carry the column. Everything else is archived in one
     statement, as before -- inventing a key on a model whose indexes do not
     include one would be a write that means nothing. */
  it('leaves a resource without the column alone', async () => {
    const { service, updateMany } = build('subject');

    await service.bulkArchive(
      'subjects',
      ['id-a', 'id-b'],
      fakeRequest(),
      'user-1',
    );

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['id-a', 'id-b'] }, deletedAt: null },
      }),
    );
    const [{ data }] = updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).not.toHaveProperty('deletedKey');
  });
});
