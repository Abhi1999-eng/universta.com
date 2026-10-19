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

  /* T-C1. The country guide's "Student voices" could only be filled from
     the database: the API dropped countryId. */
  it('stores the country a testimonial is filed under', async () => {
    const { svc, created } = service();
    await svc.adminCreate('testimonials', {
      quote: 'A fictional demonstration quote.',
      countryId: 'country-1',
    });
    expect(created[0].data).toMatchObject({ countryId: 'country-1' });
  });

  /* SS-C1. A story saved without its journey reached the database, which
     cannot hold an empty one, and the editor saw "Internal server error". */
  describe('a success story’s journey', () => {
    it('is required when a story is created', async () => {
      const { svc } = service();
      await rejectsWith(
        svc.adminCreate('success-stories', {
          title: 'A demonstration story',
          slug: 'a-demonstration-story',
        }),
        'JOURNEY_REQUIRED',
      );
      await rejectsWith(
        svc.adminCreate('success-stories', {
          title: 'A demonstration story',
          slug: 'a-demonstration-story',
          journey: '<p><br></p>',
        }),
        'JOURNEY_REQUIRED',
      );
    });

    it('cannot be emptied on an update, but need not be sent', async () => {
      const { svc } = service({ slug: 'a-demonstration-story' });
      for (const journey of [null, '', '<p><br></p>', '<p>&nbsp;</p>'])
        await rejectsWith(
          svc.adminUpdate('success-stories', 'story-1', { journey }),
          'JOURNEY_REQUIRED',
        );
      await expect(
        svc.adminUpdate('success-stories', 'story-1', { title: 'Renamed' }),
      ).resolves.toMatchObject({ title: 'Renamed' });
    });

    it('is stored when it has words in it', async () => {
      const { svc, created } = service();
      await svc.adminCreate('success-stories', {
        title: 'A demonstration story',
        slug: 'a-demonstration-story',
        journey: '<p>A fictional journey.</p>',
      });
      expect(created[0].data.journey).toContain('A fictional journey.');
    });
  });

  /* JOB-C2. "careers.example.test/apply" saved, and the Apply button
     opened our own 404. */
  describe('a job’s application link and email', () => {
    const job = { title: 'Demo role', slug: 'demo-role' };

    it('accepts an https link and an address', async () => {
      const { svc, created } = service();
      await svc.adminCreate('jobs', {
        ...job,
        applicationUrl: 'https://careers.example.test/apply',
        applicationEmail: 'jobs@example.test',
      });
      expect(created[0].data).toMatchObject({
        applicationUrl: 'https://careers.example.test/apply',
        applicationEmail: 'jobs@example.test',
      });
    });

    it('refuses a link without https:// and an email without a domain', async () => {
      const { svc } = service();
      for (const applicationUrl of [
        'careers.example.test/apply',
        'http://careers.example.test/apply',
        '/careers/apply',
      ])
        await rejectsWith(
          svc.adminCreate('jobs', { ...job, applicationUrl }),
          'APPLICATION_URL_INVALID',
        );
      await rejectsWith(
        svc.adminCreate('jobs', { ...job, applicationEmail: 'jobs@example' }),
        'APPLICATION_EMAIL_INVALID',
      );
    });

    it('lets both be cleared', async () => {
      const { svc, updated } = service({ slug: 'demo-role' });
      await svc.adminUpdate('jobs', 'job-1', {
        applicationUrl: null,
        applicationEmail: null,
      });
      expect(updated[0].data).toMatchObject({
        applicationUrl: null,
        applicationEmail: null,
      });
    });
  });

  /* EV-C3. A timezone typed as "Tokyo" saved, and every visitor's events
     listing answered 500. */
  describe('an event’s time zone', () => {
    const event = {
      title: 'Demo session',
      slug: 'demo-session',
      startsAt: '2026-11-20T09:00:00.000Z',
    };

    it('accepts an IANA zone', async () => {
      const { svc, created } = service();
      await svc.adminCreate('events', { ...event, timezone: 'Asia/Tokyo' });
      expect(created[0].data.timezone).toBe('Asia/Tokyo');
    });

    it('refuses a zone no formatter knows, with a named error', async () => {
      const { svc } = service();
      await rejectsWith(
        svc.adminCreate('events', { ...event, timezone: 'Tokyo' }),
        'INVALID_TIMEZONE',
      );
    });

    it('leaves the zone alone when none is sent', async () => {
      const { svc, created } = service();
      await svc.adminCreate('events', { ...event, timezone: '' });
      expect(created[0].data).not.toHaveProperty('timezone');
    });
  });
});
