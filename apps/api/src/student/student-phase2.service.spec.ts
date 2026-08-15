import { HttpException } from '@nestjs/common';
import { StudentPhase2Service } from './student-phase2.service';

describe('StudentPhase2Service saved catalogue boundary', () => {
  const profile = { id: '00000000-0000-0000-0000-000000000001' };
  const prisma = {
    studentProfile: { upsert: jest.fn(), findUnique: jest.fn() },
    university: { findFirst: jest.fn() },
    studentSavedUniversity: { upsert: jest.fn() },
    studentApplication: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    studentApplicationTimeline: { create: jest.fn() },
    studentNotification: { create: jest.fn() },
    $transaction: jest.fn(),
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

  it('does not reveal another student’s application by an id guessed in the URL', async () => {
    (prisma as any).studentProfile.upsert.mockResolvedValue(profile);
    (prisma as any).studentApplication.findFirst.mockResolvedValue(null);
    await expect(
      service.application('student-a', '00000000-0000-0000-0000-000000000099'),
    ).rejects.toBeInstanceOf(HttpException);
    expect((prisma as any).studentApplication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '00000000-0000-0000-0000-000000000099', studentProfileId: profile.id },
      }),
    );
  });

  it('turns an accepted offer into the real ACCEPTED application state', async () => {
    (prisma as any).studentProfile.upsert.mockResolvedValue(profile);
    (prisma as any).studentApplication.findFirst.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000099',
      status: 'OFFER_RECEIVED',
      offerDecision: null,
    });
    (prisma as any).studentApplication.update.mockReturnValue('application-update');
    (prisma as any).studentApplicationTimeline.create.mockReturnValue('timeline-create');
    (prisma as any).$transaction.mockResolvedValue([]);
    (prisma as any).studentNotification.create.mockResolvedValue({});
    (prisma as any).studentProfile.findUnique.mockResolvedValue(null);
    await expect(
      service.decideOffer('student-a', '00000000-0000-0000-0000-000000000099', 'ACCEPTED'),
    ).resolves.toEqual({ status: 'ACCEPTED', decision: 'ACCEPTED' });
    expect((prisma as any).studentApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) }),
    );
  });

  it('rejects impossible staff status transitions before changing the application', async () => {
    (prisma as any).studentApplication.findUnique.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000099',
      studentProfileId: profile.id,
      status: 'APPLICATION_STARTED',
    });
    await expect(
      service.adminSetApplicationStatus('admin', '00000000-0000-0000-0000-000000000099', 'ENROLLED'),
    ).rejects.toBeInstanceOf(HttpException);
    expect((prisma as any).studentApplication.update).not.toHaveBeenCalled();
  });
});
