import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * A delete that is refused has to say what refused it.
 *
 * Two countries were ticked on the bulk screen, the phrase typed, Delete
 * pressed -- and nothing happened that anybody could see. Both still had
 * universities, which is a good reason not to delete a country and was
 * reported as "Still referenced by another record": no country named, no
 * table, no number. Nothing to go and act on.
 *
 * Through the HTTP endpoint and a real database, because the reason is read
 * out of the database's own error and no stub of it would prove anything.
 */

type Blocked = { id: string; label: string; reason: string };

function data(response: { body: unknown }): {
  deleted: number;
  blocked: Blocked[];
} {
  return (response.body as { data: { deleted: number; blocked: Blocked[] } })
    .data;
}

describe('bulk delete says what is in the way (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token = '';
  const stamp = `bulkdel${randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const countryIds: string[] = [];
  const universityIds: string[] = [];
  let subjectId = '';

  const purge = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/admin/bulk/countries/bulk-delete')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  async function makeCountry(label: string) {
    const continent = await prisma.continent.findFirstOrThrow({
      where: { status: 'ACTIVE', deletedAt: null },
    });
    const country = await prisma.country.create({
      data: {
        continentId: continent.id,
        name: `Delete ${label} ${stamp}`,
        slug: `delete-${label}-${stamp}`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    countryIds.push(country.id);
    await prisma.countrySubject.create({
      data: { countryId: country.id, subjectId },
    });
    return country;
  }

  async function makeUniversity(label: string, countryId: string) {
    const university = await prisma.university.create({
      data: {
        countryId,
        name: `Delete ${label} University ${stamp}`,
        slug: `delete-university-${label}-${stamp}`,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    universityIds.push(university.id);
    return university;
  }

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
    token = String(
      (login.body as { data: { accessToken: string } }).data.accessToken,
    );
    subjectId = (
      await prisma.subject.create({
        data: {
          name: `Delete Subject ${stamp}`,
          slug: `delete-subject-${stamp}`,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    await prisma.university
      .deleteMany({ where: { id: { in: universityIds } } })
      .catch(() => undefined);
    await prisma.country
      .deleteMany({ where: { id: { in: countryIds } } })
      .catch(() => undefined);
    await prisma.subject
      .deleteMany({ where: { id: subjectId } })
      .catch(() => undefined);
    await app.close();
  });

  it('refuses a country that still has universities, by name, with how many', async () => {
    const country = await makeCountry('held');
    await makeUniversity('one', country.id);
    await makeUniversity('two', country.id);

    const result = data(await purge({ ids: [country.id] }));

    expect(result.deleted).toBe(0);
    expect(result.blocked).toEqual([
      {
        id: country.id,
        label: country.name,
        reason: '2 universities still point to it',
      },
    ]);
  });

  it('leaves a refused country exactly as it was', async () => {
    /* The joins are removed first and the country after, in one
       transaction: a refusal has to put the joins back, or a country that
       could not be deleted would come out of the attempt with no subjects. */
    const country = await makeCountry('intact');
    await makeUniversity('three', country.id);

    await purge({ ids: [country.id] });

    expect(
      await prisma.country.findUnique({ where: { id: country.id } }),
    ).not.toBeNull();
    expect(
      await prisma.countrySubject.count({ where: { countryId: country.id } }),
    ).toBe(1);
  });

  it('says "1 university", not "1 universities"', async () => {
    const country = await makeCountry('single');
    await makeUniversity('four', country.id);
    const result = data(await purge({ ids: [country.id] }));
    expect(result.blocked[0].reason).toBe('1 university still points to it');
  });

  it('counts an archived university too, because the database does', async () => {
    const country = await makeCountry('archived');
    const university = await makeUniversity('five', country.id);
    await prisma.university.update({
      where: { id: university.id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    const result = data(await purge({ ids: [country.id] }));
    expect(result.deleted).toBe(0);
    expect(result.blocked[0].reason).toBe('1 university still points to it');
  });

  it('deletes the ones that are free and names the one that is not', async () => {
    const free = await makeCountry('free');
    const held = await makeCountry('mixed');
    await makeUniversity('six', held.id);

    const result = data(await purge({ ids: [free.id, held.id] }));

    expect(result.deleted).toBe(1);
    expect(result.blocked.map((row) => row.label)).toEqual([held.name]);
    expect(
      await prisma.country.findUnique({ where: { id: free.id } }),
    ).toBeNull();
  });

  it('lets the country go once its universities have gone', async () => {
    const country = await makeCountry('released');
    const university = await makeUniversity('seven', country.id);
    expect(data(await purge({ ids: [country.id] })).deleted).toBe(0);

    await prisma.university.delete({ where: { id: university.id } });

    const result = data(await purge({ ids: [country.id] }));
    expect(result).toEqual({ deleted: 1, blocked: [] });
    expect(
      await prisma.countrySubject.count({ where: { countryId: country.id } }),
    ).toBe(0);
  });
});
