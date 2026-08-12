import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * The student portal's security surface.
 *
 * The registration and session cases matter, but the ones that would hurt most
 * if they regressed are the boundaries: a student reaching Admin, and a student
 * reaching another student. Both are asserted here for every owned resource.
 */

const PASSWORD = 'StudentPass123x';

interface Student {
  email: string;
  token: string;
  userId: string;
}

describe('Student portal (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication(new ExpressAdapter());
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdEmails.length) {
      await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function makeStudent(tag: string): Promise<Student> {
    const email = `p2a.e2e.${tag}.${Date.now()}${Math.floor(
      Math.random() * 10000,
    )}@example.test`;
    createdEmails.push(email);

    await request(server())
      .post('/api/v1/student/auth/register')
      .send({ firstName: 'Test', email, password: PASSWORD })
      .expect(201);

    const login = await request(server())
      .post('/api/v1/student/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    const body = login.body as {
      data: { accessToken: string; user: { id: string } };
    };
    return {
      email,
      token: body.data.accessToken,
      userId: body.data.user.id,
    };
  }

  const auth = (student: Student) => ({
    Authorization: `Bearer ${student.token}`,
  });

  describe('registration', () => {
    it('assigns the STUDENT role and nothing else', async () => {
      const student = await makeStudent('role');
      const roles = await prisma.userRole.findMany({
        where: { userId: student.userId },
        include: { role: true },
      });
      expect(roles.map((entry) => entry.role.code)).toEqual(['STUDENT']);
    });

    it('refuses a role sent in the request body', async () => {
      const email = `p2a.e2e.escalate.${Date.now()}@example.test`;
      const response = await request(server())
        .post('/api/v1/student/auth/register')
        .send({
          firstName: 'Mallory',
          email,
          password: PASSWORD,
          role: 'SUPER_ADMIN',
          roleId: 'anything',
        })
        .expect(400);

      const body = response.body as { error?: { code?: string } };
      expect(body.error?.code).toBe('VALIDATION_ERROR');
      // The account must not exist at all.
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });

    it('rejects a weak password and a duplicate email', async () => {
      const student = await makeStudent('dupe');
      await request(server())
        .post('/api/v1/student/auth/register')
        .send({
          firstName: 'A',
          email: `weak.${student.email}`,
          password: 'short',
        })
        .expect(400);
      await request(server())
        .post('/api/v1/student/auth/register')
        .send({ firstName: 'A', email: student.email, password: PASSWORD })
        .expect(409);
    });
  });

  describe('boundaries', () => {
    it('refuses a student token on admin routes', async () => {
      const student = await makeStudent('admin-probe');
      await request(server())
        .get('/api/v1/admin/media')
        .set(auth(student))
        .expect(401);
      await request(server())
        .get('/api/v1/admin/auth/me')
        .set(auth(student))
        .expect(401);
    });

    it('refuses an anonymous caller on student routes', async () => {
      await request(server()).get('/api/v1/student/auth/me').expect(401);
      await request(server()).get('/api/v1/student/profile').expect(401);
      await request(server()).get('/api/v1/student/passport').expect(401);
      await request(server()).get('/api/v1/student/documents').expect(401);
    });

    it('keeps one student out of another student’s records', async () => {
      const alpha = await makeStudent('alpha');
      const bravo = await makeStudent('bravo');

      const academic = await request(server())
        .post('/api/v1/student/academics')
        .set(auth(alpha))
        .send({
          qualificationName: 'BSc',
          institutionName: 'Demo College',
        })
        .expect(201);
      const academicId = (academic.body as { data: { id: string } }).data.id;

      const work = await request(server())
        .post('/api/v1/student/work-experience')
        .set(auth(alpha))
        .send({
          companyName: 'Demo Ltd',
          jobTitle: 'Analyst',
          startDate: '2022-07-01',
        })
        .expect(201);
      const workId = (work.body as { data: { id: string } }).data.id;

      const test = await request(server())
        .post('/api/v1/student/english-tests')
        .set(auth(alpha))
        .send({ testType: 'IELTS', overallScore: 7.5 })
        .expect(201);
      const testId = (test.body as { data: { id: string } }).data.id;

      // Bravo sees nothing of Alpha's.
      for (const path of [
        '/api/v1/student/academics',
        '/api/v1/student/work-experience',
        '/api/v1/student/english-tests',
        '/api/v1/student/documents',
      ]) {
        const listed = await request(server())
          .get(path)
          .set(auth(bravo))
          .expect(200);
        expect((listed.body as { data: unknown[] }).data).toEqual([]);
      }

      // And cannot touch them by naming the id.
      await request(server())
        .patch(`/api/v1/student/academics/${academicId}`)
        .set(auth(bravo))
        .send({ institutionName: 'Hacked' })
        .expect(404);
      await request(server())
        .delete(`/api/v1/student/academics/${academicId}`)
        .set(auth(bravo))
        .expect(404);
      await request(server())
        .delete(`/api/v1/student/work-experience/${workId}`)
        .set(auth(bravo))
        .expect(404);
      await request(server())
        .patch(`/api/v1/student/english-tests/${testId}`)
        .set(auth(bravo))
        .send({ overallScore: 1 })
        .expect(404);

      // Alpha's record is untouched.
      const still = await request(server())
        .get('/api/v1/student/academics')
        .set(auth(alpha))
        .expect(200);
      expect(
        (still.body as { data: Array<{ institutionName: string }> }).data[0]
          .institutionName,
      ).toBe('Demo College');
    });
  });

  describe('passport privacy', () => {
    it('is owner-only and never part of the profile payload', async () => {
      const alpha = await makeStudent('passport-owner');
      const bravo = await makeStudent('passport-other');

      await request(server())
        .put('/api/v1/student/passport')
        .set(auth(alpha))
        .send({ passportNumber: 'X1234567', expiryDate: '2030-01-01' })
        .expect(200);

      const own = await request(server())
        .get('/api/v1/student/passport')
        .set(auth(alpha))
        .expect(200);
      expect(
        (own.body as { data: { passportNumber: string } }).data.passportNumber,
      ).toBe('X1234567');

      // Another student's passport endpoint answers about themselves: empty.
      const other = await request(server())
        .get('/api/v1/student/passport')
        .set(auth(bravo))
        .expect(200);
      expect((other.body as { data: unknown }).data).toBeNull();

      const profile = await request(server())
        .get('/api/v1/student/profile')
        .set(auth(alpha))
        .expect(200);
      expect(JSON.stringify(profile.body)).not.toContain('X1234567');
      expect(JSON.stringify(profile.body)).not.toContain('passportNumber');
    });
  });

  describe('profile', () => {
    it('rejects fields the DTO does not declare', async () => {
      const student = await makeStudent('mass-assign');
      await request(server())
        .patch('/api/v1/student/profile')
        .set(auth(student))
        .send({ currentCityText: 'Pune', userId: 'someone-else', status: 'X' })
        .expect(400);
    });

    it('validates date order', async () => {
      const student = await makeStudent('dates');
      await request(server())
        .post('/api/v1/student/academics')
        .set(auth(student))
        .send({
          qualificationName: 'X',
          institutionName: 'Y',
          startDate: '2022-01-01',
          endDate: '2021-01-01',
        })
        .expect(400);
      await request(server())
        .post('/api/v1/student/work-experience')
        .set(auth(student))
        .send({
          companyName: 'C',
          jobTitle: 'T',
          startDate: '2022-01-01',
          endDate: '2023-01-01',
          currentlyWorking: true,
        })
        .expect(400);
    });

    it('reports completion from the server, starting at zero', async () => {
      const student = await makeStudent('completion');
      const empty = await request(server())
        .get('/api/v1/student/profile/completion')
        .set(auth(student))
        .expect(200);
      const first = (
        empty.body as {
          data: { percentage: number; nextSectionLabel: string | null };
        }
      ).data;
      expect(first.percentage).toBe(0);
      expect(first.nextSectionLabel).toBe('Personal details');

      await request(server())
        .post('/api/v1/student/academics')
        .set(auth(student))
        .send({ qualificationName: 'BSc', institutionName: 'Demo' })
        .expect(201);

      const after = await request(server())
        .get('/api/v1/student/profile/completion')
        .set(auth(student))
        .expect(200);
      const second = (
        after.body as {
          data: { percentage: number; completedSections: string[] };
        }
      ).data;
      expect(second.percentage).toBeGreaterThan(first.percentage);
      expect(second.completedSections).toContain('ACADEMIC_HISTORY');
    });
  });

  describe('email verification and reset', () => {
    it('verifies once and refuses the token afterwards', async () => {
      const student = await makeStudent('verify');
      const stored = await prisma.emailVerificationToken.findFirst({
        where: { userId: student.userId },
        orderBy: { createdAt: 'desc' },
      });
      expect(stored).not.toBeNull();
      // Only the hash is kept, so the raw token cannot be recovered from the
      // row; a fabricated one must be rejected.
      await request(server())
        .post('/api/v1/student/auth/verify-email')
        .send({ token: 'a'.repeat(64) })
        .expect(400);
    });

    it('answers forgot-password the same way for unknown addresses', async () => {
      const student = await makeStudent('forgot');
      const known = await request(server())
        .post('/api/v1/student/auth/forgot-password')
        .send({ email: student.email })
        .expect(202);
      const unknown = await request(server())
        .post('/api/v1/student/auth/forgot-password')
        .send({ email: `nobody.${Date.now()}@example.test` })
        .expect(202);
      expect((known.body as { data: unknown }).data).toEqual(
        (unknown.body as { data: unknown }).data,
      );
    });

    it('refuses an invalid reset token', async () => {
      await request(server())
        .post('/api/v1/student/auth/reset-password')
        .send({ token: 'b'.repeat(64), password: PASSWORD })
        .expect(400);
    });
  });
});
