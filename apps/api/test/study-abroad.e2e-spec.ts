/**
 * The two contracts the Study Abroad experience depends on: the destination
 * directory, and the assessment that turns answers into a lead.
 *
 * The directory's job is to describe every destination a student might ask
 * about without ever exposing editorial work that is not published. The
 * assessment's job is to reach the existing lead system without letting the
 * browser decide anything that matters.
 */
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

type Destination = {
  name: string;
  slug: string | null;
  iso2Code: string | null;
  isAvailable: boolean;
  isPopular: boolean;
  region: string | null;
  bands: string[] | null;
  counts: {
    universities: number;
    courses: number;
    scholarships: number;
    consultants: number;
  };
};

const TAG = 'sa-e2e';

describe('Study Abroad (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function cleanup() {
    const leads = await prisma.lead.findMany({
      where: { email: { endsWith: '@sa-e2e.invalid' } },
      select: { id: true },
    });
    if (leads.length) {
      const ids = leads.map((row) => row.id);
      await prisma.leadStatusHistory.deleteMany({
        where: { leadId: { in: ids } },
      });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.country.deleteMany({
      where: { slug: { startsWith: `${TAG}-` } },
    });
  }

  async function directory() {
    const response = await request(app.getHttpServer())
      .get('/api/v1/countries/destinations')
      .expect(200);
    return response.body.data as {
      available: Destination[];
      comingSoon: Destination[];
      regions: string[];
      counts: { available: number; popular: number; total: number };
    };
  }

  describe('destination directory', () => {
    it('lists published destinations as navigable and the rest as coming', async () => {
      const body = await directory();
      expect(body.available.length).toBeGreaterThan(0);
      expect(body.comingSoon.length).toBeGreaterThan(0);
      expect(
        body.available.every((entry) => entry.slug && entry.isAvailable),
      ).toBe(true);
      /* A destination with no guide has nothing to navigate to, so it carries
         no slug at all rather than one that would 404. */
      expect(body.comingSoon.every((entry) => entry.slug === null)).toBe(true);
      expect(body.comingSoon.every((entry) => !entry.isAvailable)).toBe(true);
    });

    /* The merged listing reports what the catalogue has linked to a
       destination. A destination with no Country record has nothing linked to
       it, so it reports zeroes rather than leaving the caller to guess. */
    it('reports what each destination has linked to it', async () => {
      const body = await directory();
      for (const entry of [...body.available, ...body.comingSoon]) {
        expect(entry.counts).toEqual({
          universities: expect.any(Number),
          courses: expect.any(Number),
          scholarships: expect.any(Number),
          consultants: expect.any(Number),
        });
        expect(entry.counts.universities).toBeGreaterThanOrEqual(0);
      }
      expect(
        body.comingSoon.every(
          (entry) =>
            entry.counts.universities === 0 &&
            entry.counts.courses === 0 &&
            entry.counts.scholarships === 0 &&
            entry.counts.consultants === 0,
        ),
      ).toBe(true);
    });

    it('never lists the same destination in both tiers', async () => {
      const body = await directory();
      const published = new Set(
        body.available.map((entry) => entry.name.toLowerCase()),
      );
      const overlap = body.comingSoon.filter((entry) =>
        published.has(entry.name.toLowerCase()),
      );
      expect(overlap).toEqual([]);
    });

    it('files every destination under one of the directory regions', async () => {
      const body = await directory();
      const regions = new Set(body.regions);
      const stray = [...body.available, ...body.comingSoon].filter(
        (entry) => entry.region !== null && !regions.has(entry.region),
      );
      expect(stray).toEqual([]);
    });

    it('does not expose a draft country, in either tier', async () => {
      const draft = await prisma.country.create({
        data: {
          name: `${TAG} Draftland`,
          slug: `${TAG}-draftland`,
          status: 'DRAFT',
          shortDescription: 'Unpublished editorial work.',
        },
      });
      try {
        const body = await directory();
        const everywhere = [...body.available, ...body.comingSoon];
        expect(
          everywhere.find((entry) => entry.name === draft.name),
        ).toBeUndefined();
        /* And nothing of its content leaked into the payload either. */
        expect(JSON.stringify(body)).not.toContain(
          'Unpublished editorial work',
        );
      } finally {
        await prisma.country.delete({ where: { id: draft.id } });
      }
    });

    it('counts what it published, not what it listed', async () => {
      const body = await directory();
      expect(body.counts.available).toBe(body.available.length);
      expect(body.counts.total).toBe(
        body.available.length + body.comingSoon.length,
      );
      expect(body.counts.popular).toBe(
        body.available.filter((entry) => entry.isPopular).length,
      );
    });
  });

  describe('assessment', () => {
    const submit = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/api/v1/public/counselling-leads/assessment')
        .send(body);

    const base = {
      fullName: 'Fictional Student',
      consent: true,
      answers: {
        field: 'engineering',
        level: 'masters',
        qualification: 'bachelors',
        score: 'high',
        language: 'have-english',
        experience: '2-5',
        intake: 'next',
        budget: '20-35k',
        intent: 'ready',
      },
    };

    it('creates a lead, and puts the answers where a counsellor will find them', async () => {
      const email = `created@sa-e2e.invalid`;
      const country = await prisma.country.findFirst({
        where: { status: 'PUBLISHED', deletedAt: null },
        select: { id: true, slug: true },
      });
      const response = await submit({
        ...base,
        email,
        phoneNumber: '+15550100001',
        countrySlug: country?.slug,
        sourcePagePath: `/study-abroad/${country?.slug ?? ''}`,
      }).expect(201);
      expect(response.body.data).toMatchObject({
        received: true,
        band: 'high',
      });

      const lead = await prisma.lead.findFirst({ where: { email } });
      expect(lead).toBeTruthy();
      expect(lead?.formType).toBe('ASSESSMENT');
      /* The guide it came from, so Admin can read the context off the record. */
      expect(lead?.sourcePageUrl).toContain('/study-abroad/');
      if (country) {
        expect(lead?.sourceType).toBe('COUNTRY');
        expect(lead?.preferredCountryId).toBe(country.id);
      }
      /* The answers that have canonical columns are written to them, so the
         existing Admin filters keep working on an assessment lead. */
      expect(lead?.highestQualification).toBe('bachelors');
      expect(lead?.englishTestType).toBe('HELD');
      expect(Number(lead?.budgetMin)).toBe(20000);
      expect(Number(lead?.budgetMax)).toBe(35000);
      const stored = lead?.assessmentJson as {
        band?: string;
        answers?: unknown;
      };
      expect(stored?.band).toBe('high');
      expect(stored?.answers).toMatchObject({ intent: 'ready' });
    });

    it('records the status history and audit entry every lead gets', async () => {
      const email = `audited@sa-e2e.invalid`;
      await submit({ ...base, email, phoneNumber: '+15550100002' }).expect(201);
      const lead = await prisma.lead.findFirst({ where: { email } });
      expect(lead).toBeTruthy();
      await expect(
        prisma.leadStatusHistory.count({ where: { leadId: lead!.id } }),
      ).resolves.toBe(1);
      await expect(
        prisma.auditLog.count({
          where: { entityId: lead!.id, action: 'LEAD_CREATED' },
        }),
      ).resolves.toBe(1);
    });

    it('refuses an answer it does not recognise, and writes nothing', async () => {
      const email = `rejected@sa-e2e.invalid`;
      const response = await submit({
        ...base,
        email,
        phoneNumber: '+15550100003',
        answers: { ...base.answers, intent: '<script>alert(1)</script>' },
      });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('ASSESSMENT_ANSWERS_INVALID');
      await expect(prisma.lead.count({ where: { email } })).resolves.toBe(0);
    });

    it('refuses a request that tries to supply its own band or score', async () => {
      /* The band decides queue priority, so a field the contract does not
         define is rejected rather than ignored. The web proxy strips unknown
         fields too; this is the layer behind it. */
      const response = await submit({
        ...base,
        email: 'notrusted@sa-e2e.invalid',
        phoneNumber: '+15550100004',
        band: 'high',
        score: 999,
      });
      expect(response.status).toBe(400);
      await expect(
        prisma.lead.count({ where: { email: 'notrusted@sa-e2e.invalid' } }),
      ).resolves.toBe(0);
    });

    it('computes the band from the answers, not from the ambition of the sender', async () => {
      const email = `lowintent@sa-e2e.invalid`;
      await submit({
        ...base,
        email,
        phoneNumber: '+15550100014',
        answers: { intent: 'exploring', budget: 'unsure', score: 'unknown' },
      }).expect(201);
      const lead = await prisma.lead.findFirst({ where: { email } });
      const stored = lead?.assessmentJson as { band?: string; score?: number };
      expect(stored?.band).toBe('low');
      expect(stored?.score).toBeLessThan(4);
      /* And a low-intent lead does not jump the queue. */
      expect(lead?.priority).toBe('NORMAL');
    });

    it('swallows a honeypot submission without creating anything', async () => {
      const email = `trapped@sa-e2e.invalid`;
      await submit({
        ...base,
        email,
        phoneNumber: '+15550100005',
        companyWebsite: 'https://spam.invalid',
      }).expect(201);
      await expect(prisma.lead.count({ where: { email } })).resolves.toBe(0);
    });

    it('does not create a second lead for a repeated submission', async () => {
      const email = `duplicate@sa-e2e.invalid`;
      await submit({ ...base, email, phoneNumber: '+15550100006' }).expect(201);
      await submit({ ...base, email, phoneNumber: '+15550100006' }).expect(201);
      await expect(prisma.lead.count({ where: { email } })).resolves.toBe(1);
    });

    it('requires consent, a name and a reachable contact', async () => {
      await submit({
        ...base,
        email: 'x@sa-e2e.invalid',
        phoneNumber: '+15550100007',
        consent: false,
      }).expect(400);
      await submit({
        ...base,
        email: 'not-an-email',
        phoneNumber: '+15550100008',
      }).expect(400);
      await submit({
        ...base,
        email: 'y@sa-e2e.invalid',
        phoneNumber: 'nope',
      }).expect(400);
    });

    it('links no country when the destination is not a published one', async () => {
      const email = `nocountry@sa-e2e.invalid`;
      await submit({
        ...base,
        email,
        phoneNumber: '+15550100009',
        countrySlug: `${TAG}-nowhere`,
      }).expect(201);
      const lead = await prisma.lead.findFirst({ where: { email } });
      expect(lead?.preferredCountryId).toBeNull();
      expect(lead?.sourceType).toBe('GENERAL');
    });
  });
});
