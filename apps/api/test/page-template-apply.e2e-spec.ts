import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' ? (value as RecordValue) : {};
}

function data(response: { body: unknown }): RecordValue {
  return record(record(response.body).data);
}

/** Applying a page template is one admin action: it assigns the template and
 * creates the sections the page is missing. The contract these tests pin down
 * is that the action is safe to repeat -- it never duplicates a section, never
 * overwrites content an admin has edited, and never fails with a bare 500. */
describe('Page template apply (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const stamp = Date.now();
  let templateId = '';
  const pageIds: string[] = [];

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
  });

  afterAll(async () => {
    for (const id of pageIds) {
      await prisma.pageSection.deleteMany({ where: { pageId: id } });
      await prisma.page.deleteMany({ where: { id } });
    }
    if (templateId)
      await prisma.pageTemplate.deleteMany({ where: { id: templateId } });
    await app.close();
  });

  function admin(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
    return request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  async function newPage(suffix: string): Promise<string> {
    const created = await admin('post', '/api/v1/admin/phase1/pages')
      .send({
        title: `Template apply ${stamp} ${suffix}`,
        slug: `template-apply-${stamp}-${suffix}`,
        pageType: 'EDITORIAL_PAGE',
      })
      .expect(201);
    const id = String(data(created).id);
    pageIds.push(id);
    return id;
  }

  async function liveSections(pageId: string) {
    return prisma.pageSection.findMany({
      where: { pageId, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
  }

  it('creates a template that carries its own sections', async () => {
    const created = await admin('post', '/api/v1/admin/page-templates')
      .send({
        name: `Apply Template ${stamp}`,
        pageFamily: 'EDITORIAL_PAGE',
        isActive: true,
        defaultSections: [
          { sectionType: 'RICH_TEXT', heading: 'About Universta' },
          { sectionType: 'RICH_TEXT', heading: 'What We Do' },
          { sectionType: 'CTA', heading: 'Talk To Our Counsellors' },
        ],
      })
      .expect(201);
    templateId = String(data(created).id);
    expect((data(created).defaultSectionsJson as unknown[]).length).toBe(3);
  });

  it('assigns the template and applies its sections in one action', async () => {
    const pageId = await newPage('fresh');
    // No separate assignment call: passing templateId is the whole action.
    const applied = await admin(
      'post',
      `/api/v1/admin/page-templates/apply-defaults/${pageId}`,
    )
      .send({ templateId })
      .expect(201);

    expect(data(applied)).toMatchObject({
      created: 3,
      restored: 0,
      skipped: 0,
    });
    const page = await prisma.page.findUnique({ where: { id: pageId } });
    expect(page?.templateId).toBe(templateId);
    expect((await liveSections(pageId)).map((s) => s.sectionKey)).toEqual([
      'about-universta',
      'what-we-do',
      'talk-to-our-counsellors',
    ]);
  });

  it('is idempotent: re-applying adds nothing and duplicates nothing', async () => {
    const pageId = await newPage('idempotent');
    await admin('post', `/api/v1/admin/page-templates/apply-defaults/${pageId}`)
      .send({ templateId })
      .expect(201);
    const again = await admin(
      'post',
      `/api/v1/admin/page-templates/apply-defaults/${pageId}`,
    )
      .send({ templateId })
      .expect(201);

    expect(data(again)).toMatchObject({ created: 0, skipped: 3 });
    expect(await liveSections(pageId)).toHaveLength(3);
  });

  it('never overwrites content the admin has already edited', async () => {
    const pageId = await newPage('preserve');
    await admin('post', `/api/v1/admin/page-templates/apply-defaults/${pageId}`)
      .send({ templateId })
      .expect(201);
    const [first] = await liveSections(pageId);
    await admin(
      'patch',
      `/api/v1/admin/phase1/pages/${pageId}/sections/${first.id}`,
    )
      .send({ heading: 'Edited by admin' })
      .expect(200);

    await admin('post', `/api/v1/admin/page-templates/apply-defaults/${pageId}`)
      .send({ templateId })
      .expect(201);

    const sections = await liveSections(pageId);
    expect(sections).toHaveLength(3);
    expect(
      sections.find((s) => s.sectionKey === first.sectionKey)?.heading,
    ).toBe('Edited by admin');
  });

  it('adds only the missing sections when the page already has some', async () => {
    const pageId = await newPage('partial');
    await admin('post', `/api/v1/admin/phase1/pages/${pageId}/sections`)
      .send({
        sectionKey: 'what-we-do',
        sectionType: 'RICH_TEXT',
        heading: 'Hand written',
      })
      .expect(201);

    const applied = await admin(
      'post',
      `/api/v1/admin/page-templates/apply-defaults/${pageId}`,
    )
      .send({ templateId })
      .expect(201);

    expect(data(applied)).toMatchObject({ created: 2, skipped: 1 });
    const sections = await liveSections(pageId);
    expect(sections).toHaveLength(3);
    expect(sections.find((s) => s.sectionKey === 'what-we-do')?.heading).toBe(
      'Hand written',
    );
  });

  /** The `[pageId, sectionKey]` unique index counts soft-deleted rows, so a
   * key whose section had been deleted still occupied the index. Re-applying
   * used to send that key to an insert and fail the whole request with a bare
   * Internal server error, wedging the page for good. */
  it('recovers a deleted section instead of failing with a 500', async () => {
    const pageId = await newPage('deleted');
    await admin('post', `/api/v1/admin/page-templates/apply-defaults/${pageId}`)
      .send({ templateId })
      .expect(201);
    const [first] = await liveSections(pageId);
    await admin(
      'delete',
      `/api/v1/admin/phase1/pages/${pageId}/sections/${first.id}`,
    ).expect(200);
    expect(await liveSections(pageId)).toHaveLength(2);

    const applied = await admin(
      'post',
      `/api/v1/admin/page-templates/apply-defaults/${pageId}`,
    )
      .send({ templateId })
      .expect(201);

    expect(data(applied)).toMatchObject({ restored: 1, skipped: 2 });
    const sections = await liveSections(pageId);
    expect(sections).toHaveLength(3);
    expect(sections.map((s) => s.sectionKey)).toContain(first.sectionKey);
  });

  it('rejects applying with no template as a clear 400, not a 500', async () => {
    const pageId = await newPage('untemplated');
    const response = await admin(
      'post',
      `/api/v1/admin/page-templates/apply-defaults/${pageId}`,
    ).expect(400);
    expect(record(record(response.body).error).code).toBe(
      'PAGE_TEMPLATE_NOT_ASSIGNED',
    );
  });
});
