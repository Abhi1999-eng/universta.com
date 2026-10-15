import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMasterDto } from './dto/master.dto';
import { CourseLevelsService } from './course-levels.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * The admin's "Deactivate" on a level or a study mode sends the status
 * alone. The update used to demand the code and the name with it, so the
 * button failed with "code must match ... name must be a string".
 */

const current = {
  id: 'pathway',
  code: 'PATHWAY',
  name: 'Pathway Program',
  description: null,
  educationOrder: 1,
  displayOrder: 0,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

describe('deactivating a master record by its status alone', () => {
  it('accepts a body that names only the status', async () => {
    const dto = plainToInstance(UpdateMasterDto, { status: 'INACTIVE' });
    expect(await validate(dto)).toEqual([]);
  });

  it('still refuses a malformed code when one is sent', async () => {
    const dto = plainToInstance(UpdateMasterDto, { code: 'bad code!' });
    expect((await validate(dto)).map((e) => e.property)).toEqual(['code']);
  });

  it('keeps the code and name the record has when they are left out', async () => {
    const calls: Record<string, unknown>[] = [];
    const prisma = {
      courseLevel: {
        findFirst: async () => current,
        findUnique: async () => current,
        update: async (args: Record<string, unknown>) => {
          calls.push(args);
          return { ...current, status: 'INACTIVE' };
        },
      },
      course: { count: async () => 0 },
      auditLog: { create: async () => null },
    } as unknown as PrismaService;
    const request = {
      user: { sub: 'admin-1' },
      headers: {},
      ip: '127.0.0.1',
      get: () => undefined,
    } as unknown as AuthenticatedRequest;
    const service = new CourseLevelsService(prisma);
    const result = await service.update(
      'pathway',
      { status: 'INACTIVE' },
      request,
    );
    expect((calls[0] as { data: Record<string, unknown> }).data).toMatchObject({
      code: 'PATHWAY',
      name: 'Pathway Program',
      status: 'INACTIVE',
    });
    expect(result.status).toBe('INACTIVE');
  });
});
