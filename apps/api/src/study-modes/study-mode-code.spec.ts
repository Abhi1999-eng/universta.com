import { StudyModesService } from './study-modes.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Only a study level's code is fixed once created (its level pages are
 * addressed by it). A study mode shares the masters' form and DTO, and
 * its code can still change.
 */

const current = {
  id: 'm1',
  code: 'ONLINE',
  name: 'Online',
  description: null,
  displayOrder: 1,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe("a study mode's code", () => {
  it('can still be changed', async () => {
    const writes: Record<string, unknown>[] = [];
    const prisma = {
      studyMode: {
        findUnique: async () => current,
        update: async (args: { data: Record<string, unknown> }) => {
          writes.push(args.data);
          return { ...current, ...args.data };
        },
      },
      auditLog: { create: async () => null },
    } as unknown as PrismaService;
    await new StudyModesService(prisma).update('m1', { code: 'ONLINE2' }, {
      user: { sub: 'admin-1' },
      headers: {},
      ip: '127.0.0.1',
      get: () => undefined,
    } as unknown as AuthenticatedRequest);
    expect(writes[0]).toMatchObject({ code: 'ONLINE2' });
  });
});
