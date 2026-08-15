import { HttpException } from '@nestjs/common';
import { StudentPhase2Service } from './student-phase2.service';

describe('StudentPhase2Service saved catalogue boundary', () => {
  const profile = { id: '00000000-0000-0000-0000-000000000001' };
  const prisma = {
    studentProfile: { upsert: jest.fn() },
    university: { findFirst: jest.fn() },
    studentSavedUniversity: { upsert: jest.fn() },
  } as never;
  const email = { sendPortalNotification: jest.fn() } as never;
  const service = new StudentPhase2Service(prisma, email);

  beforeEach(() => jest.clearAllMocks());

  it('does not save a withdrawn or unpublished university', async () => {
    (prisma as any).studentProfile.upsert.mockResolvedValue(profile);
    (prisma as any).university.findFirst.mockResolvedValue(null);
    await expect(
      service.saveUniversity(
        'student-user',
        '00000000-0000-0000-0000-000000000002',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect((prisma as any).university.findFirst).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-0000-0000-000000000002',
        status: 'PUBLISHED',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(
      (prisma as any).studentSavedUniversity.upsert,
    ).not.toHaveBeenCalled();
  });

  it('writes the save against the resolved caller profile, never a caller-supplied profile id', async () => {
    (prisma as any).studentProfile.upsert.mockResolvedValue(profile);
    (prisma as any).university.findFirst.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000002',
    });
    await service.saveUniversity(
      'student-user',
      '00000000-0000-0000-0000-000000000002',
    );
    expect((prisma as any).studentSavedUniversity.upsert).toHaveBeenCalledWith({
      where: {
        studentProfileId_universityId: {
          studentProfileId: profile.id,
          universityId: '00000000-0000-0000-0000-000000000002',
        },
      },
      create: {
        studentProfileId: profile.id,
        universityId: '00000000-0000-0000-0000-000000000002',
      },
      update: {},
    });
  });
});
