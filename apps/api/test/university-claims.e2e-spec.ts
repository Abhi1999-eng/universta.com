import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === 'object' ? (value as RecordValue) : {};
}
function body(response: { body: unknown }): RecordValue {
  return record(response.body);
}
function data(response: { body: unknown }): RecordValue {
  return record(body(response).data);
}
function arrayData(response: { body: unknown }): RecordValue[] {
  const value = body(response).data;
  return Array.isArray(value) ? (value as RecordValue[]) : [];
}
function errorCode(response: { body: unknown }): string {
  const error = body(response).error;
  return record(error).code as string;
}

describe('University Claim workflow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const suffix = randomUUID().slice(0, 8);
  let universityId = '';
  let universitySlug = '';
  let claimId = '';

  const admin = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${adminToken}`);

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
      .expect(200);
    adminToken = String(data(login).accessToken);

    const continent = await prisma.continent.findFirst({
      where: { deletedAt: null },
    });
    const country = await prisma.country.create({
      data: {
        continentId: continent!.id,
        name: `Claims E2E Country ${suffix}`,
        pageHeading: `Claims E2E Country ${suffix}`,
        slug: `claims-e2e-country-${suffix}`,
        shortDescription:
          'Fictional country used only for university claim e2e coverage.',
        status: 'PUBLISHED',
      },
    });
    universitySlug = `claims-e2e-university-${suffix}`;
    const university = await prisma.university.create({
      data: {
        countryId: country.id,
        name: `Claims E2E University ${suffix}`,
        slug: universitySlug,
        shortDescription:
          'Fictional university fixture used only for claim e2e coverage.',
        status: 'PUBLISHED',
      },
    });
    universityId = university.id;
  });

  afterAll(async () => {
    if (universityId) {
      await prisma.universityClaimStatusHistory.deleteMany({
        where: { claim: { universityId } },
      });
      await prisma.universityClaimNote.deleteMany({
        where: { claim: { universityId } },
      });
      await prisma.universityClaimRequest.deleteMany({
        where: { universityId },
      });
      const university = await prisma.university.findUnique({
        where: { id: universityId },
      });
      await prisma.university.deleteMany({ where: { id: universityId } });
      if (university)
        await prisma.country.deleteMany({
          where: { id: university.countryId },
        });
    }
    await app.close();
  });

  it('rejects a claim missing required fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/phase1/university-claims')
      .send({
        universitySlug,
        claimantName: '',
        workEmail: 'not-an-email',
        message: '',
      })
      .expect(422);
  });

  it('rejects a claim without consent', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/phase1/university-claims')
      .send({
        universitySlug,
        claimantName: 'Fictional Claimant',
        workEmail: `claimant-${suffix}@example.com`,
        message: 'I manage this fictional demo institution.',
        consent: false,
      })
      .expect(422);
  });

  it('silently accepts a honeypot-triggered submission without creating a row', async () => {
    const before = await prisma.universityClaimRequest.count({
      where: { universityId },
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/phase1/university-claims')
      .send({
        universitySlug,
        claimantName: 'Bot',
        workEmail: `bot-${suffix}@example.com`,
        message: 'spam',
        consent: true,
        companyWebsite: 'http://spam.example',
      })
      .expect(201);
    expect(data(response).received).toBe(true);
    const after = await prisma.universityClaimRequest.count({
      where: { universityId },
    });
    expect(after).toBe(before);
  });

  it('submits a valid claim', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/phase1/university-claims')
      .send({
        universitySlug,
        claimantName: 'Fictional Claimant',
        workEmail: `claimant-${suffix}@example.com`,
        jobTitle: 'Admissions Director',
        organization: 'Claims E2E University',
        message:
          'I manage this fictional demo institution and would like to claim its listing.',
        consent: true,
      })
      .expect(201);
    expect(data(response).received).toBe(true);
    expect(data(response).duplicate).toBe(false);
    expect(typeof data(response).claimNumber).toBe('string');
  });

  it('treats a second submission from the same email for the same university as a duplicate', async () => {
    // The service also rate-limits repeat submissions from the same
    // email+university within a 10s window (matching the existing
    // ContactInquiry convention) to blunt rapid spam; that is a distinct
    // concern from duplicate-open-request detection, so this test moves
    // the clock forward past that window to exercise the duplicate path
    // specifically rather than the rate limiter.
    const realNow = Date.now;
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => realNow() + 15_000);
    try {
      const response = await request(app.getHttpServer())
        .post('/api/v1/phase1/university-claims')
        .send({
          universitySlug,
          claimantName: 'Fictional Claimant',
          workEmail: `claimant-${suffix}@example.com`,
          message: 'Following up on my earlier request.',
          consent: true,
        })
        .expect(201);
      expect(data(response).duplicate).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('lists the claim in the admin queue', async () => {
    const response = await admin(
      'get',
      '/api/v1/admin/university-claims',
    ).expect(200);
    const rows = arrayData(response);
    const match = rows.find(
      (row) => (row.workEmail as string) === `claimant-${suffix}@example.com`,
    );
    expect(match).toBeTruthy();
    claimId = String(match!.id);
  });

  it('returns claim detail with the university relation', async () => {
    const response = await admin(
      'get',
      `/api/v1/admin/university-claims/${claimId}`,
    ).expect(200);
    expect((data(response).university as RecordValue).slug).toBe(
      universitySlug,
    );
    expect(data(response).status).toBe('SUBMITTED');
  });

  it('rejects an invalid status transition', async () => {
    const response = await admin(
      'patch',
      `/api/v1/admin/university-claims/${claimId}/status`,
    )
      .send({ status: 'NOT_A_REAL_STATUS' })
      .expect(400);
    expect(errorCode(response)).toBe('INVALID_STATUS');
  });

  it('adds a note to the claim', async () => {
    await admin('post', `/api/v1/admin/university-claims/${claimId}/notes`)
      .send({
        note: 'Verified the claimant appears on the official staff directory.',
      })
      .expect(201);
    const response = await admin(
      'get',
      `/api/v1/admin/university-claims/${claimId}`,
    ).expect(200);
    const notes = (data(response).notes as RecordValue[]) ?? [];
    expect(notes.length).toBe(1);
  });

  it('transitions the claim through review to approved and records status history', async () => {
    await admin('patch', `/api/v1/admin/university-claims/${claimId}/status`)
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    await admin('patch', `/api/v1/admin/university-claims/${claimId}/status`)
      .send({
        status: 'APPROVED',
        reason: 'Confirmed via official email domain match.',
      })
      .expect(200);
    const response = await admin(
      'get',
      `/api/v1/admin/university-claims/${claimId}`,
    ).expect(200);
    expect(data(response).status).toBe('APPROVED');
    const history = (data(response).statusHistory as RecordValue[]) ?? [];
    expect(history.length).toBe(2);
    expect(history[0].newStatus).toBe('APPROVED');
  });

  it('approving a claim does not grant any admin/partner access', async () => {
    const response = await admin(
      'get',
      `/api/v1/admin/university-claims/${claimId}`,
    ).expect(200);
    const claim = data(response);
    expect(claim).not.toHaveProperty('accessToken');
    expect(claim).not.toHaveProperty('userId');
  });

  it('archives the claim', async () => {
    await admin('delete', `/api/v1/admin/university-claims/${claimId}`).expect(
      200,
    );
    const response = await admin(
      'get',
      `/api/v1/admin/university-claims/${claimId}`,
    ).expect(404);
    expect(errorCode(response)).toBe('CLAIM_NOT_FOUND');
  });

  it('rejects a claim for a university that does not exist', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/phase1/university-claims')
      .send({
        universitySlug: 'not-a-real-university-slug',
        claimantName: 'Fictional Claimant',
        workEmail: `claimant2-${suffix}@example.com`,
        message: 'Testing an invalid target.',
        consent: true,
      })
      .expect(400);
  });
});
