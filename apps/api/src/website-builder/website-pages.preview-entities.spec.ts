import { WebsitePagesService } from './website-pages.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * JOB-M4. The template preview picker offered roles that had closed and
 * records scheduled for later or already expired -- each a page that does
 * not take applications, or answers 404.
 */

type Row = Record<string, unknown>;

function service() {
  const calls: Record<string, Row> = {};
  const model = (name: string) => ({
    findMany: async (args: Row) => {
      calls[name] = args;
      return [];
    },
  });
  const prisma = {
    job: model('job'),
    event: model('event'),
    scholarship: model('scholarship'),
    consultant: model('consultant'),
    university: model('university'),
    universityCourseOffering: model('offering'),
    subject: model('subject'),
  } as unknown as PrismaService;
  return { svc: new WebsitePagesService(prisma), calls };
}

const window = [
  {
    OR: [
      { publishStartsAt: null },
      { publishStartsAt: { lte: new Date('2026-10-19T12:00:00Z') } },
    ],
  },
  {
    OR: [
      { publishEndsAt: null },
      { publishEndsAt: { gt: new Date('2026-10-19T12:00:00Z') } },
    ],
  },
];

describe('Template preview records', () => {
  beforeEach(() =>
    jest.useFakeTimers({ now: new Date('2026-10-19T12:00:00Z') }),
  );
  afterEach(() => jest.useRealTimers());

  it('offers only open roles inside their publishing window', async () => {
    const { svc, calls } = service();
    await svc.previewEntities('job-detail');
    expect(calls.job.where).toEqual({
      status: 'PUBLISHED',
      deletedAt: null,
      AND: [
        ...window,
        {
          OR: [
            { expiryDate: null },
            { expiryDate: { gte: new Date('2026-10-19T00:00:00Z') } },
          ],
        },
      ],
    });
  });

  it.each([
    ['event-detail', 'event'],
    ['scholarship-detail', 'scholarship'],
    ['consultant-detail', 'consultant'],
    ['university-detail', 'university'],
    ['university-course-offering', 'offering'],
  ])('offers %s records only inside their window', async (key, model) => {
    const { svc, calls } = service();
    await svc.previewEntities(key);
    expect(calls[model].where).toEqual({
      status: 'PUBLISHED',
      deletedAt: null,
      AND: window,
    });
  });

  it('leaves records with no publishing window as they were', async () => {
    const { svc, calls } = service();
    await svc.previewEntities('subject-detail');
    expect(calls.subject.where).toEqual({
      status: 'PUBLISHED',
      deletedAt: null,
    });
  });
});
