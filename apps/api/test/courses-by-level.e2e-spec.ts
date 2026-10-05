import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';

/**
 * A subject's courses, filed under their levels.
 *
 * The subject, specialization and country + subject pages show one section
 * per level -- "Bachelor's: these ten, Master's: these twenty" -- and each
 * section ends in a link to the course list filtered to that level. So the
 * contract is stated against the list: whatever this says a level holds is
 * what `/courses?subject=..&level=..` then opens on.
 */
type Course = {
  id: string;
  subject: { slug: string };
  subSubject: { slug: string } | null;
  courseLevel: { code: string };
  selectedCountry: { slug: string } | null;
};
type Group = {
  level: { id: string; code: string; name: string; educationOrder: number };
  count: number;
  courses: Course[];
};
type Option = { value: string; label: string; count: number };

function envelope(response: { body: unknown }) {
  return response.body as {
    data: unknown;
    meta: { total: number } | null;
    error: { code: string; message: string } | null;
  };
}

describe('courses filed under their levels (e2e)', () => {
  let app: INestApplication<App>;
  const get = (path: string) => request(app.getHttpServer()).get(path);
  const groups = async (query: string) =>
    envelope(await get(`/api/v1/courses/by-level?${query}`).expect(200))
      .data as Group[];
  const list = async (query: string) => {
    const body = envelope(await get(`/api/v1/courses?${query}`).expect(200));
    return { total: body.meta!.total, rows: body.data as Course[] };
  };
  const filters = async (query = '') =>
    envelope(await get(`/api/v1/courses/filter-options?${query}`).expect(200))
      .data as {
      subjects: Option[];
      subSubjects: Array<Option & { subject: { slug: string } }>;
      countries: Option[];
      levels: Option[];
    };

  /** The subject the seed files under the most levels: the one that shows
   * the grouping doing something. */
  let subject: string;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();

    let most = 0;
    for (const option of (await filters()).subjects) {
      const found = (await groups(`subject=${option.value}`)).length;
      if (found > most) {
        most = found;
        subject = option.value;
      }
    }
    expect(most).toBeGreaterThan(1);
  });

  afterAll(async () => {
    await app.close();
  });

  it('needs a subject, and one the catalogue publishes', async () => {
    await get('/api/v1/courses/by-level').expect(400);
    await get('/api/v1/courses/by-level?subject=').expect(400);
    const unknown = envelope(
      await get('/api/v1/courses/by-level?subject=no-such-subject').expect(400),
    );
    expect(unknown.error?.code).toBe('COURSE_FILTER_OPTION_INVALID');
  });

  it('files every course of the subject under its own level, and leaves out a level with none', async () => {
    const found = await groups(`subject=${subject}&perLevel=50`);
    for (const group of found) {
      expect(group.count).toBeGreaterThan(0);
      expect(group.courses.length).toBe(Math.min(group.count, 50));
      for (const course of group.courses) {
        expect(course.courseLevel.code).toBe(group.level.code);
        expect(course.subject.slug).toBe(subject);
      }
    }
    /* No course twice, none missing. */
    const ids = found.flatMap((group) => group.courses.map((row) => row.id));
    expect(new Set(ids).size).toBe(ids.length);
    const whole = await list(`subject=${subject}&limit=1`);
    expect(found.reduce((sum, group) => sum + group.count, 0)).toBe(
      whole.total,
    );
  });

  it('puts the levels in academic order, the order the level list itself uses', async () => {
    const found = await groups(`subject=${subject}`);
    const order = (
      envelope(await get('/api/v1/course-levels').expect(200)).data as Array<{
        code: string;
      }>
    ).map((level) => level.code);
    const codes = found.map((group) => group.level.code);
    expect(codes).toEqual(order.filter((code) => codes.includes(code)));
    const steps = found.map((group) => group.level.educationOrder);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });

  it('says of each level what the course list filtered to that level then shows', async () => {
    for (const group of await groups(`subject=${subject}`)) {
      const listed = await list(
        `subject=${subject}&level=${group.level.code}&limit=12`,
      );
      expect(listed.total).toBe(group.count);
      expect(listed.rows.map((row) => row.id)).toEqual(
        group.courses.map((row) => row.id),
      );
    }
  });

  it('shows only so many per level, and still counts them all', async () => {
    const whole = await groups(`subject=${subject}`);
    const one = await groups(`subject=${subject}&perLevel=1`);
    expect(one.map((group) => [group.level.code, group.count])).toEqual(
      whole.map((group) => [group.level.code, group.count]),
    );
    for (const group of one) expect(group.courses).toHaveLength(1);
    await get(`/api/v1/courses/by-level?subject=${subject}&perLevel=0`).expect(
      400,
    );
    await get(`/api/v1/courses/by-level?subject=${subject}&perLevel=51`).expect(
      400,
    );
  });

  it('with a destination, counts only what is taught there', async () => {
    const countries = (await filters(`subject=${subject}`)).countries;
    expect(countries.length).toBeGreaterThan(0);
    const everywhere = new Map(
      (await groups(`subject=${subject}`)).map((group) => [
        group.level.code,
        group.count,
      ]),
    );
    for (const country of countries.slice(0, 3)) {
      const there = await groups(
        `subject=${subject}&country=${country.value}&perLevel=50`,
      );
      const listed = await list(
        `subject=${subject}&country=${country.value}&limit=1`,
      );
      expect(there.reduce((sum, group) => sum + group.count, 0)).toBe(
        listed.total,
      );
      for (const group of there) {
        expect(group.count).toBeLessThanOrEqual(
          everywhere.get(group.level.code) ?? 0,
        );
        for (const course of group.courses)
          expect(course.selectedCountry?.slug).toBe(country.value);
      }
    }
  });

  it('narrows to one specialization of the subject', async () => {
    const branches = (await filters(`subject=${subject}`)).subSubjects.filter(
      (option) => option.subject.slug === subject,
    );
    expect(branches.length).toBeGreaterThan(0);
    const branch = branches[0].value;
    const found = await groups(
      `subject=${subject}&subSubject=${branch}&perLevel=50`,
    );
    expect(found.length).toBeGreaterThan(0);
    const listed = await list(
      `subject=${subject}&subSubject=${branch}&limit=1`,
    );
    expect(found.reduce((sum, group) => sum + group.count, 0)).toBe(
      listed.total,
    );
    for (const group of found)
      for (const course of group.courses)
        expect(course.subSubject?.slug).toBe(branch);
  });
});
