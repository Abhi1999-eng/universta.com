import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  ACCESS_TOKEN_TYPE,
  AUTH_AUDIENCE,
  AUTH_ISSUER,
} from '../src/auth/auth.types';
import { configureApplication } from '../src/bootstrap';
import { RuntimeConfigService } from '../src/config/runtime-config.service';
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

describe('Phase 1 counselling leads (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let nonAdminToken: string;
  let countrySlug: string;
  let countryId: string;
  let levelCode: string;
  let levelId: string;
  let intakeSlug: string;
  let intakeId: string;
  const emailPrefix = `phase1-leads-${Date.now()}`;

  function fictionalContact(suffix: string) {
    const digits = String(Date.now()).slice(-8);
    return {
      email: `${emailPrefix}-${suffix}@example.invalid`,
      phoneNumber: `+1555${digits}${suffix.length % 10}`.slice(0, 15),
    };
  }

  function validPayload(suffix: string) {
    return {
      fullName: 'Fictional Student',
      ...fictionalContact(suffix),
      countrySlug,
      studyLevelCode: levelCode,
      intakeSlug,
      consent: true,
      message: 'A fictional browser and API test counselling request.',
      sourceType: 'country',
      sourceCountrySlug: countrySlug,
      sourcePagePath: `/countries/${countrySlug}`,
      referringPath: `/countries/${countrySlug}`,
      landingPagePath: '/counselling',
      utmSource: 'phase1-e2e',
    };
  }

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const [country, level, intake] = await Promise.all([
      prisma.country.findFirstOrThrow({
        where: { status: 'PUBLISHED', deletedAt: null },
      }),
      prisma.courseLevel.findFirstOrThrow({ where: { status: 'ACTIVE' } }),
      prisma.intake.findFirstOrThrow({ where: { status: 'ACTIVE' } }),
    ]);
    countrySlug = country.slug;
    countryId = country.id;
    levelCode = level.code;
    levelId = level.id;
    intakeSlug = intake.slug;
    intakeId = intake.id;

    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
      })
      .expect(200);
    adminToken = String(data(login).accessToken);
    const jwt = app.get(JwtService);
    const config = app.get(RuntimeConfigService);
    nonAdminToken = await jwt.signAsync(
      {
        sub: randomUUID(),
        email: 'non-admin@example.invalid',
        roles: ['EDITOR'],
        type: ACCESS_TOKEN_TYPE,
        jti: randomUUID(),
      },
      {
        secret: config.jwtAccessSecret,
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
        expiresIn: '15m',
      },
    );
  });

  afterAll(async () => {
    const leads = await prisma.lead.findMany({
      where: { email: { startsWith: emailPrefix } },
      select: { id: true },
    });
    const ids = leads.map((lead) => lead.id);
    if (ids.length) {
      await prisma.auditLog.deleteMany({
        where: { entityType: 'LEAD', entityId: { in: ids } },
      });
      await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
  });

  it('returns only current database-backed counselling options', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/public/counselling-leads/options')
      .expect(200);
    expect(data(response).countries).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: countrySlug })]),
    );
    expect(data(response).courseLevels).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: levelCode })]),
    );
    expect(data(response).intakes).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: intakeSlug })]),
    );
  });

  it('creates a normalized lead, initial history and non-PII audit atomically', async () => {
    const payload = validPayload('valid');
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .set('Origin', 'http://localhost:3000')
      .send({
        ...payload,
        fullName: '  Fictional   Student  ',
        email: payload.email.toUpperCase(),
        phoneNumber: payload.phoneNumber.replace('+1', '+1 '),
      })
      .expect(201);
    expect(data(response)).toEqual({ received: true });
    const lead = await prisma.lead.findFirstOrThrow({
      where: { email: payload.email },
      include: { statusHistory: true },
    });
    expect(lead).toMatchObject({
      firstName: 'Fictional',
      lastName: 'Student',
      preferredCountryId: countryId,
      preferredCourseLevelId: levelId,
      preferredIntakeId: intakeId,
      sourceType: 'COUNTRY',
      status: 'NEW',
      privacyConsent: true,
      assignedToUserId: null,
    });
    expect(lead.statusHistory).toEqual([
      expect.objectContaining({ oldStatus: null, newStatus: 'NEW' }),
    ]);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'LEAD', entityId: lead.id, action: 'LEAD_CREATED' },
    });
    const serializedAudit = JSON.stringify(audit);
    expect(serializedAudit).not.toContain(payload.email);
    expect(serializedAudit).not.toContain(payload.phoneNumber);
    expect(serializedAudit).not.toContain(payload.message);
    expect(audit.ipAddress).toBeNull();
  });

  it('rejects missing fields, false consent, unexpected fields and invalid options', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send({ ...validPayload('consent'), consent: false })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send({ ...validPayload('unexpected'), unexpected: true })
      .expect(400);
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send({ ...validPayload('option'), countrySlug: 'not-published' })
      .expect(422);
    expect(record(body(invalid).error).code).toBe('LEAD_OPTIONS_INVALID');
  });

  it('returns a safe envelope for globally oversized request bodies', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ message: 'x'.repeat(110_000) }))
      .expect(413);
    expect(record(body(response).error)).toMatchObject({
      code: 'REQUEST_TOO_LARGE',
      message: 'Request body is too large',
    });
  });

  it('falls back safely for tampered source context', async () => {
    const payload = validPayload('source');
    await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send({
        ...payload,
        sourceType: 'course',
        sourceCourseSlug: 'not-a-published-course',
      })
      .expect(201);
    const lead = await prisma.lead.findFirstOrThrow({
      where: { email: payload.email },
    });
    expect(lead).toMatchObject({
      sourceType: 'GENERAL',
      sourceEntityId: null,
    });
  });

  it('handles the honeypot and duplicate submissions with generic success', async () => {
    const honeypot = validPayload('honeypot');
    await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send({ ...honeypot, companyWebsite: 'bot.example' })
      .expect(201);
    expect(await prisma.lead.count({ where: { email: honeypot.email } })).toBe(
      0,
    );

    const duplicate = validPayload('duplicate');
    const first = await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send(duplicate)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send(duplicate)
      .expect(201);
    expect(data(first)).toEqual(data(second));
    expect(await prisma.lead.count({ where: { email: duplicate.email } })).toBe(
      1,
    );
  });

  it('rate limits repeated contact submissions with Retry-After', async () => {
    const payload = {
      ...validPayload('rate'),
      companyWebsite: 'bot.example',
    };
    for (let index = 0; index < 8; index += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/public/counselling-leads')
        .send(payload)
        .expect(201);
    }
    const limited = await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send(payload)
      .expect(429);
    expect(limited.headers['retry-after']).toEqual(expect.any(String));
    expect(record(body(limited).error).code).toBe('RATE_LIMITED');
  });

  it('protects Admin routes from unauthenticated and non-Super-Admin access', async () => {
    const unauthenticated = await request(app.getHttpServer())
      .get('/api/v1/admin/leads')
      .expect(401);
    expect(unauthenticated.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer())
      .get('/api/v1/admin/leads')
      .set('Authorization', `Bearer ${nonAdminToken}`)
      .expect(403);
  });

  it('lists, filters, paginates and retrieves lead detail safely', async () => {
    const payload = validPayload('listing');
    await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send(payload)
      .expect(201);
    const listing = await request(app.getHttpServer())
      .get('/api/v1/admin/leads')
      .query({
        q: payload.email,
        status: 'NEW',
        countryId,
        courseLevelId: levelId,
        intakeId,
        sourceType: 'COUNTRY',
        page: 1,
        limit: 1,
      })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(body(listing).meta).toMatchObject({
      page: 1,
      limit: 1,
      total: 1,
    });
    const rows = body(listing).data as Array<RecordValue>;
    const id = String(rows[0]?.id);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/leads/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(data(detail)).toMatchObject({
      id,
      email: payload.email,
      notes: [],
    });
    await request(app.getHttpServer())
      .get(`/api/v1/admin/leads/${randomUUID()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/admin/leads')
      .query({ createdFrom: '2026-99-99' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('validates status updates, rejects stale writes and creates status audit history', async () => {
    const payload = validPayload('status');
    await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send(payload)
      .expect(201);
    const lead = await prisma.lead.findFirstOrThrow({
      where: { email: payload.email },
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/leads/${lead.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'NOT_REAL',
        expectedUpdatedAt: lead.updatedAt.toISOString(),
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/leads/${lead.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'CONTACTED',
        expectedUpdatedAt: new Date(0).toISOString(),
      })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/leads/${lead.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'CONTACTED',
        expectedUpdatedAt: lead.updatedAt.toISOString(),
        reason: 'Fictional E2E follow-up',
      })
      .expect(200);
    expect(
      await prisma.leadStatusHistory.findFirst({
        where: {
          leadId: lead.id,
          oldStatus: 'NEW',
          newStatus: 'CONTACTED',
        },
      }),
    ).not.toBeNull();
    expect(
      await prisma.auditLog.findFirst({
        where: {
          entityId: lead.id,
          action: 'LEAD_STATUS_UPDATED',
        },
      }),
    ).not.toBeNull();
  });

  it('creates safe internal notes and rejects oversized notes', async () => {
    const payload = validPayload('note');
    const note =
      'Fictional <script>alert("qa")</script> internal follow-up note.';
    await request(app.getHttpServer())
      .post('/api/v1/public/counselling-leads')
      .send(payload)
      .expect(201);
    const lead = await prisma.lead.findFirstOrThrow({
      where: { email: payload.email },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/admin/leads/${lead.id}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note, isPinned: true })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/leads/${lead.id}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'x'.repeat(5001) })
      .expect(400);
    expect(
      await prisma.leadNote.findFirst({
        where: { leadId: lead.id, isPinned: true, note },
      }),
    ).not.toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: lead.id, action: 'LEAD_NOTE_CREATED' },
    });
    expect(JSON.stringify(audit)).not.toContain(note);
  });
});
