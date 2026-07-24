import { PrismaService } from './prisma.service';

jest.mock('@prisma/adapter-mariadb', () => ({
  PrismaMariaDb: class PrismaMariaDb {},
}));
jest.mock('../generated/prisma/client', () => ({
  Prisma: { sql: jest.fn() },
  PrismaClient: class PrismaClient {},
}));

describe('PrismaService lifecycle', () => {
  it('connects during module initialization and disconnects during shutdown', async () => {
    const service = Object.create(PrismaService.prototype) as PrismaService & {
      $connect: jest.Mock;
      $disconnect: jest.Mock;
    };
    service.$connect = jest.fn().mockResolvedValue(undefined);
    service.$disconnect = jest.fn().mockResolvedValue(undefined);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(service.$connect.mock.calls).toHaveLength(1);
    expect(service.$disconnect.mock.calls).toHaveLength(1);
  });
});
