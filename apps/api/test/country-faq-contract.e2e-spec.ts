import { ExpressAdapter } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A FAQ answer is public-facing prose. It is rendered through the shared
 * sanitised rich-text policy, so it has to be accepted on the way in on those
 * same terms.
 *
 * It used to be validated as a plain-text "copy" field, which rejected any
 * markup outright. Ten published Countries already held `<p>`-wrapped answers,
 * so those answers could never be saved again -- and because saving a Country
 * re-sent every FAQ it owned, an unrelated edit to any of those Countries
 * failed with "Editorial section content is invalid".
 */
function body(response: { body: unknown }): Record<string, unknown> {
  return response.body && typeof response.body === 'object'
    ? (response.body as Record<string, unknown>)
    : {};
}
function record(response: { body: unknown }): Record<string, unknown> {
  const value = body(response).data;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

describe('country FAQ answer contract (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  let countryId = '';
  const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;

  /** Verbatim from the published Poland FAQ that blocked every save. */
  const STORED_HTML =
    '<p>The cost profile contains illustrative demo ranges only. Tuition, accommodation and personal costs vary by programme and city.</p>';

  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('x-request-id', 'faq-e2e');

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);

    const email =
      process.env.SEED_ADMIN_EMAIL ??
      process.env.SUPER_ADMIN_EMAIL ??
      'admin@universta.local';
    const password =
      process.env.SEED_ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD;
    if (!password) throw new Error('A local Super Admin password is required');
    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email, password })
      .expect(200);
    token = String(record(login).accessToken);

    const continent = await prisma.continent.findFirstOrThrow({
      where: { status: 'ACTIVE', deletedAt: null },
    });
    const country = await prisma.country.create({
      data: {
        continentId: continent.id,
        name: `FAQ contract ${stamp}`,
        slug: `faq-contract-${stamp}`,
        pageHeading: 'FAQ contract',
        shortDescription: 'FAQ contract fixture',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    countryId = country.id;
  }, 120_000);

  afterAll(async () => {
    await prisma.countryFaq
      .deleteMany({ where: { countryId } })
      .catch(() => undefined);
    await prisma.country
      .deleteMany({ where: { id: countryId } })
      .catch(() => undefined);
    await app.close();
  }, 60_000);

  const createFaq = (answer: string) =>
    auth(
      request(app.getHttpServer()).post(
        `/api/v1/admin/countries/${countryId}/faqs`,
      ),
    ).send({
      question: `Does an editorial answer save? ${stamp}`,
      answer,
      status: 'ACTIVE',
      displayOrder: 0,
      isFeatured: false,
    });

  it('stores an answer written in the editorial subset unchanged', async () => {
    const created = await createFaq(STORED_HTML).expect(201);
    expect(record(created).answer).toBe(STORED_HTML);

    // Re-saving it is what an unrelated Country edit used to do, and what the
    // blanket plain-text rule made impossible.
    const again = await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/countries/${countryId}/faqs/${String(record(created).id)}`,
      ),
    )
      .send({
        question: `Does an editorial answer save? ${stamp}`,
        answer: STORED_HTML,
        status: 'ACTIVE',
        displayOrder: 0,
        isFeatured: false,
        expectedUpdatedAt: record(created).updatedAt,
      })
      .expect(200);
    expect(record(again).answer).toBe(STORED_HTML);

    // And an edit to the rich text itself round-trips.
    const edited = await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/countries/${countryId}/faqs/${String(record(created).id)}`,
      ),
    )
      .send({
        question: `Does an editorial answer save? ${stamp}`,
        answer: '<p>Plan for <strong>tuition</strong> first.</p>',
        status: 'ACTIVE',
        displayOrder: 0,
        isFeatured: false,
        expectedUpdatedAt: record(again).updatedAt,
      })
      .expect(200);
    expect(record(edited).answer).toBe(
      '<p>Plan for <strong>tuition</strong> first.</p>',
    );

    await prisma.countryFaq.delete({
      where: { id: String(record(created).id) },
    });
  });

  it('strips unsafe markup from an answer instead of storing it', async () => {
    const created = await createFaq(
      '<p onclick="steal()">Safe</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
    ).expect(201);
    const answer = String(record(created).answer);
    expect(answer).toContain('Safe');
    expect(answer).not.toContain('onclick');
    expect(answer).not.toContain('alert(1)');
    expect(answer).not.toContain('javascript:');
    await prisma.countryFaq.delete({
      where: { id: String(record(created).id) },
    });
  });

  it('still refuses markup in the question, which is a plain-text label', async () => {
    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/admin/countries/${countryId}/faqs`,
      ),
    )
      .send({
        question: '<p>Not a label</p>',
        answer: 'Plain answer.',
        status: 'ACTIVE',
        displayOrder: 0,
        isFeatured: false,
      })
      .expect(400);
  });
});
