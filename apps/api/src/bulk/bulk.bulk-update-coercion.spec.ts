import { BulkOperationsService } from './bulk.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/** ISS-035. `bulk-update`'s single generic "New value" text input always
 * sends a string, but `subjects.displayOrder` is a Prisma Int column and
 * `subjects.isFeatured` is a Boolean column -- both reject a raw string and
 * previously surfaced as an unhandled 500. This confirms both are coerced
 * to their real type before `updateMany`, and that an unparsable number
 * value is rejected cleanly instead of reaching Prisma at all. */
describe('BulkOperationsService.bulkUpdate -- field type coercion', () => {
  function fakePrisma(updateMany: jest.Mock) {
    return {
      subject: { updateMany },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
  }
  function fakeRequest(): AuthenticatedRequest {
    return {
      ip: '127.0.0.1',
      requestId: 'req-1',
      get: () => 'jest',
    } as unknown as AuthenticatedRequest;
  }

  it('coerces a string displayOrder to a number', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new BulkOperationsService(fakePrisma(updateMany));
    await service.bulkUpdate(
      'subjects',
      ['id-1'],
      { displayOrder: '42' },
      fakeRequest(),
      'user-1',
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['id-1'] }, deletedAt: null },
      data: { displayOrder: 42 },
    });
  });

  it('coerces a string isFeatured to a boolean', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new BulkOperationsService(fakePrisma(updateMany));
    await service.bulkUpdate(
      'subjects',
      ['id-1'],
      { isFeatured: 'true' },
      fakeRequest(),
      'user-1',
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['id-1'] }, deletedAt: null },
      data: { isFeatured: true },
    });
  });

  it('rejects an unparsable displayOrder before reaching Prisma', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new BulkOperationsService(fakePrisma(updateMany));
    await expect(
      service.bulkUpdate(
        'subjects',
        ['id-1'],
        { displayOrder: 'not-a-number' },
        fakeRequest(),
        'user-1',
      ),
    ).rejects.toThrow('"displayOrder" must be a number');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('leaves a string field like name untouched', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new BulkOperationsService(fakePrisma(updateMany));
    await service.bulkUpdate(
      'subjects',
      ['id-1'],
      { name: 'New Name' },
      fakeRequest(),
      'user-1',
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['id-1'] }, deletedAt: null },
      data: { name: 'New Name' },
    });
  });
});
