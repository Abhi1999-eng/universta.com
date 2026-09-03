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

  it('stores a guidance card overview written in the editorial subset', async () => {
    const overview = '<p>QA card <strong>overview</strong>.</p>';
    const created = await auth(
      request(app.getHttpServer()).post(
        `/api/v1/admin/countries/${countryId}/consultant-cards`,
      ),
    )
      .send({
        title: `Card ${stamp}`,
        slug: `card-${stamp}`,
        shortDescription: 'Card short description.',
        overview,
        ctaUrl: '/counselling',
      })
      .expect(201);
    expect(record(created).overview).toBe(overview);

    // A second edit of the same rich text saves too.
    const edited = await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/countries/${countryId}/consultant-cards/${String(record(created).id)}`,
      ),
    )
      .send({
        title: `Card ${stamp}`,
        slug: `card-${stamp}`,
        shortDescription: 'Card short description.',
        overview: '<p>Edited <em>overview</em>.</p>',
        ctaUrl: '/counselling',
        expectedUpdatedAt: record(created).updatedAt,
      })
      .expect(200);
    expect(record(edited).overview).toBe('<p>Edited <em>overview</em>.</p>');

    await prisma.consultantLandingCard.delete({
      where: { id: String(record(created).id) },
    });
  });

  it('strips unsafe markup from a guidance card overview', async () => {
    const created = await auth(
      request(app.getHttpServer()).post(
        `/api/v1/admin/countries/${countryId}/consultant-cards`,
      ),
    )
      .send({
        title: `Unsafe ${stamp}`,
        slug: `unsafe-${stamp}`,
        shortDescription: 'Card short description.',
        overview:
          '<p onclick="steal()">Safe</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
        ctaUrl: '/counselling',
      })
      .expect(201);
    const overview = String(record(created).overview);
    expect(overview).toContain('Safe');
    expect(overview).not.toContain('onclick');
    expect(overview).not.toContain('alert(1)');
    expect(overview).not.toContain('javascript:');
    await prisma.consultantLandingCard.delete({
      where: { id: String(record(created).id) },
    });
  });

  it('still refuses markup in a card title, which is a plain-text label', async () => {
    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/admin/countries/${countryId}/consultant-cards`,
      ),
    )
      .send({
        title: '<p>Not a label</p>',
        slug: `label-${stamp}`,
        shortDescription: 'Card short description.',
        ctaUrl: '/counselling',
      })
      .expect(400);
  });

  it('refuses a malformed card CTA URL', async () => {
    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/admin/countries/${countryId}/consultant-cards`,
      ),
    )
      .send({
        title: `Cta ${stamp}`,
        slug: `cta-${stamp}`,
        shortDescription: 'Card short description.',
        ctaUrl: 'not a url at all',
      })
      .expect(400);
  });

  it('offers only real images for an image slot', async () => {
    /* `MediaAsset.mediaType` defaults to 'IMAGE', so a document uploaded
     * without an explicit type reads as one. This is that exact row: it must
     * not be offered to a picker filling an image slot, and it must still be
     * visible in the Media Library itself. */
    const document = await prisma.mediaAsset.create({
      data: {
        title: `QA document ${stamp}`,
        objectKey: `qa-${stamp}.pdf`,
        publicUrl: `/api/v1/media/qa-${stamp}.pdf`,
        originalFileName: `qa-${stamp}.pdf`,
        storedFileName: `qa-${stamp}.pdf`,
        mimeType: 'application/pdf',
        fileSizeBytes: BigInt(1024),
        status: 'ACTIVE',
      },
    });
    try {
      expect(document.mediaType).toBe('IMAGE');

      const options = await auth(
        request(app.getHttpServer()).get(
          '/api/v1/admin/media-options?limit=50',
        ),
      ).expect(200);
      const ids = ((body(options).data ?? []) as Array<{ id: string }>).map(
        (row) => row.id,
      );
      expect(ids).not.toContain(document.id);

      // The same restriction on the Media Library path the picker searches.
      const restricted = await auth(
        request(app.getHttpServer()).get(
          '/api/v1/admin/media?limit=50&kind=image',
        ),
      ).expect(200);
      expect(
        ((body(restricted).data ?? []) as Array<{ id: string }>).map(
          (r) => r.id,
        ),
      ).not.toContain(document.id);

      // ...and the general Media Library still lists it, unfiltered.
      const unrestricted = await auth(
        request(app.getHttpServer()).get('/api/v1/admin/media?limit=50'),
      ).expect(200);
      expect(
        ((body(unrestricted).data ?? []) as Array<{ id: string }>).map(
          (r) => r.id,
        ),
      ).toContain(document.id);
    } finally {
      await prisma.mediaAsset.delete({ where: { id: document.id } });
    }
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
