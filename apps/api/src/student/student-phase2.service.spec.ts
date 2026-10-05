import { HttpException } from '@nestjs/common';
import { StudentPhase2Service } from './student-phase2.service';

describe('StudentPhase2Service saved catalogue boundary', () => {
  const profile = { id: '00000000-0000-0000-0000-000000000001' };
  const prisma = {
    studentProfile: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    university: { findFirst: jest.fn() },
    studentSavedUniversity: { upsert: jest.fn() },
    studentApplication: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    studentApplicationTimeline: { create: jest.fn() },
    studentNotification: { create: jest.fn() },
    studentReferral: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
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
        where: {
          id: '00000000-0000-0000-0000-000000000099',
          studentProfileId: profile.id,
        },
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
    (prisma as any).studentApplication.update.mockReturnValue(
      'application-update',
    );
    (prisma as any).studentApplicationTimeline.create.mockReturnValue(
      'timeline-create',
    );
    (prisma as any).$transaction.mockResolvedValue([]);
    (prisma as any).studentNotification.create.mockResolvedValue({});
    (prisma as any).studentProfile.findUnique.mockResolvedValue(null);
    await expect(
      service.decideOffer(
        'student-a',
        '00000000-0000-0000-0000-000000000099',
        'ACCEPTED',
      ),
    ).resolves.toEqual({ status: 'ACCEPTED', decision: 'ACCEPTED' });
    expect((prisma as any).studentApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      }),
    );
  });

  it('rejects impossible staff status transitions before changing the application', async () => {
    (prisma as any).studentApplication.findUnique.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000099',
      studentProfileId: profile.id,
      status: 'APPLICATION_STARTED',
    });
    await expect(
      service.adminSetApplicationStatus(
        'admin',
        '00000000-0000-0000-0000-000000000099',
        'ENROLLED',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect((prisma as any).studentApplication.update).not.toHaveBeenCalled();
  });

  it('moves a referral forward only when a student submits their own application', async () => {
    (prisma as any).studentProfile.upsert.mockResolvedValue(profile);
    (prisma as any).studentApplication.findFirst.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000099',
      status: 'APPLICATION_STARTED',
    });
    (prisma as any).studentApplication.update.mockReturnValue(
      'application-update',
    );
    (prisma as any).studentApplicationTimeline.create.mockReturnValue(
      'timeline-create',
    );
    (prisma as any).$transaction.mockResolvedValue([]);
    (prisma as any).studentReferral.findUnique.mockResolvedValue({
      id: 'referral-id',
      stage: 'APPLICATION_STARTED',
      rewardStatus: 'NOT_ELIGIBLE',
    });
    (prisma as any).studentProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.submitApplication(
        'student-a',
        '00000000-0000-0000-0000-000000000099',
      ),
    ).resolves.toEqual({ status: 'SUBMITTED' });

    expect((prisma as any).studentReferral.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { stage: 'APPLICATION_SUBMITTED' },
      }),
    );
  });

  it('makes an enrolled referral eligible from the single reward configuration', async () => {
    (prisma as any).studentApplication.findUnique.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000099',
      studentProfileId: profile.id,
      status: 'ACCEPTED',
    });
    (prisma as any).studentApplication.update.mockReturnValue(
      'application-update',
    );
    (prisma as any).studentApplicationTimeline.create.mockReturnValue(
      'timeline-create',
    );
    (prisma as any).$transaction.mockResolvedValue([]);
    (prisma as any).studentReferral.findUnique.mockResolvedValue({
      id: 'referral-id',
      stage: 'OFFER_RECEIVED',
      rewardStatus: 'NOT_ELIGIBLE',
    });
    (prisma as any).studentProfile.findUnique.mockResolvedValue(null);

    await service.adminSetApplicationStatus(
      'admin',
      '00000000-0000-0000-0000-000000000099',
      'ENROLLED',
    );

    expect((prisma as any).studentReferral.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          stage: 'ENROLLED',
          rewardStatus: 'ELIGIBLE',
          rewardAmount: 1000,
          rewardCurrency: 'INR',
        },
      }),
    );
  });

  it('returns a strictly safe referral progress payload', async () => {
    (prisma as any).studentProfile.upsert.mockResolvedValue(profile);
    (prisma as any).studentProfile.findUniqueOrThrow.mockResolvedValue({
      referralCode: 'UNI-TEST',
    });
    (prisma as any).studentReferral.findMany.mockResolvedValue([
      {
        id: 'referral-id',
        stage: 'REGISTERED',
        rewardStatus: 'NOT_ELIGIBLE',
        rewardAmount: null,
        rewardCurrency: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        referredProfile: { user: { firstName: 'Avery' } },
      },
    ]);

    await expect(service.referral('student-a')).resolves.toEqual({
      code: 'UNI-TEST',
      referrals: [
        expect.objectContaining({
          id: 'referral-id',
          referredStudent: 'Avery',
          stage: 'REGISTERED',
        }),
      ],
    });
    expect((prisma as any).studentReferral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ email: expect.anything() }),
      }),
    );
  });
});

/**
 * The dashboard's nearest deadline links to the course it is for. A course's
 * page moved under its university's country, and this link kept the flat
 * /universities/<u>/courses/<o> address, which now only redirects.
 */
describe('StudentPhase2Service dashboard deadline', () => {
  const profile = { id: '00000000-0000-0000-0000-000000000001' };
  const intakeFindFirst = jest.fn();
  const prisma = {
    studentProfile: {
      upsert: jest.fn().mockResolvedValue(profile),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ referralCode: 'UNI-X' }),
    },
    studentApplication: {
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    studentScholarshipApplication: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    studentNotification: { count: jest.fn().mockResolvedValue(0) },
    studentConsultantAssignment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    universityCourseIntake: { findFirst: intakeFindFirst },
  } as never;
  const service = new StudentPhase2Service(prisma, {} as never);

  it('links the deadline to the course under its university’s country', async () => {
    jest
      .spyOn(service, 'recommendations')
      .mockResolvedValue({ offerings: [] } as never);
    intakeFindFirst.mockResolvedValue({
      deadline: new Date('2030-01-15T00:00:00.000Z'),
      offering: {
        name: 'MSc Computer Science',
        slug: 'msc-computer-science',
        university: {
          slug: 'university-of-oxford',
          country: { slug: 'united-kingdom' },
        },
      },
    });

    const dashboard = await service.dashboard('student-user');

    expect(dashboard.nearestDeadline).toEqual({
      label: 'MSc Computer Science',
      date: '2030-01-15T00:00:00.000Z',
      href: '/study-abroad/united-kingdom/universities/university-of-oxford/courses/msc-computer-science',
    });
    expect(intakeFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          offering: {
            select: expect.objectContaining({
              university: {
                select: { slug: true, country: { select: { slug: true } } },
              },
            }),
          },
        }),
      }),
    );
  });
});
