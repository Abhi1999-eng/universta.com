import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * What the admin's record editor may write, and what it is told when a
 * value cannot be stored. Each case here was either dropped without a word,
 * stored in a form the site then mishandled, or reached the database and
 * came back as a raw 500.
 */

type Row = Record<string, unknown>;

function fakePrisma(existing: Row = {}) {
  const created: Array<{ model: string; data: Row }> = [];
  const updated: Array<{ model: string; data: Row }> = [];
  const model = (name: string) => ({
    create: async ({ data }: { data: Row }) => {
      created.push({ model: name, data });
      return { id: `${name}-1`, ...data };
    },
    update: async ({ data }: { data: Row }) => {
      updated.push({ model: name, data });
      return { id: `${name}-1`, ...existing, ...data };
    },
    findFirst: async () => ({ id: `${name}-1`, ...existing }),
  });
  const prisma = {
    universityCourseOffering: model('offering'),
    testimonial: model('testimonial'),
    successStory: model('successStory'),
    consultant: model('consultant'),
    job: model('job'),
    event: model('event'),
    seoMetadata: {
      findUnique: async () => null,
      upsert: async () => ({}),
      updateMany: async () => ({ count: 0 }),
    },
    redirect: {
      upsert: async () => ({}),
      updateMany: async () => ({ count: 0 }),
    },
  } as unknown as PrismaService;
  return { prisma, created, updated };
}

function service(existing?: Row) {
  const fake = fakePrisma(existing);
  return {
    svc: new ExpandedService(fake.prisma, {} as ExperimentsService),
    ...fake,
  };
}

const rejectsWith = (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toMatchObject({ response: { code } });

describe('ExpandedService admin writes', () => {
  /* C2. Every programme page said "Needs verification" and "Course code:
     Not listed", and no admin save could change either. */
  it('stores an offering’s course code and verified date', async () => {
    const { svc, created } = service();
    await svc.adminCreate('offerings', {
      name: 'MSc Demo Studies',
      slug: 'msc-demo-studies',
      courseCode: ' DEMO-101 ',
      verifiedAt: '2026-10-06',
    });
    expect(created[0].data).toMatchObject({
      courseCode: 'DEMO-101',
      verifiedAt: new Date('2026-10-06'),
    });
  });

  it('refuses an offering’s verified date that is not a date', async () => {
    const { svc } = service();
    await rejectsWith(
      svc.adminCreate('offerings', {
        name: 'MSc Demo Studies',
        slug: 'msc-demo-studies',
        verifiedAt: 'last week',
      }),
      'VALIDATION_ERROR',
    );
  });

});
