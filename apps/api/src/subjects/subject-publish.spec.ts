import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Publishing a subject publishes only the subject. Each specialization
 * under it keeps its own status: a draft stays a draft until it is
 * published itself, from its editor or the specializations list. The
 * subject editor used to publish every draft specialization along with the
 * subject; this holds the API's half of the rule, so no publish of a
 * subject writes a specialization.
 */

const updatedAt = new Date('2026-10-17T10:00:00Z');
const child = (id: string, status: 'DRAFT' | 'PUBLISHED') => ({
  id,
  name: `Branch ${id}`,
  slug: `branch-${id}`,
  status,
  courseLevels: [],
});
const subject = (status: 'DRAFT' | 'PUBLISHED') => ({
  id: 'cs',
  name: 'QA Test Subject',
  slug: 'qa-test-subject',
  shortDescription: 'A subject with one draft and one published branch.',
  overview: null,
  iconMedia: null,
  listingMedia: null,
  heroMedia: null,
  isFeatured: false,
  displayOrder: 0,
  status,
  publishedAt: status === 'PUBLISHED' ? updatedAt : null,
  createdAt: updatedAt,
  updatedAt,
  courseLevels: [],
  subSubjects: [child('draft', 'DRAFT'), child('live', 'PUBLISHED')],
  _count: { courses: 0, countrySubjects: 0 },
});

function prisma(writes: string[]) {
  const write = (name: string) => (args: unknown) => {
    writes.push(`${name} ${JSON.stringify(args)}`);
    return Promise.resolve({ count: 0 });
  };
  return {
    subject: {
      findFirst: async () => subject('DRAFT'),
      update: async (args: { data: Record<string, unknown> }) => {
        writes.push(`subject.update ${JSON.stringify(args.data)}`);
        return subject('PUBLISHED');
      },
    },
    /* Any write here is the cascade coming back. */
    subSubject: {
      update: write('subSubject.update'),
      updateMany: write('subSubject.updateMany'),
      upsert: write('subSubject.upsert'),
    },
    auditLog: { create: async () => null },
  } as unknown as PrismaService;
}

const request = {
  user: { sub: 'admin-1' },
  headers: {},
  ip: '127.0.0.1',
  get: () => undefined,
} as unknown as AuthenticatedRequest;

describe('publishing a subject', () => {
  it('writes the subject alone, never one of its specializations', async () => {
    const writes: string[] = [];
    await new SubjectsService(prisma(writes)).publish(
      'cs',
      { expectedUpdatedAt: updatedAt.toISOString() },
      request,
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^subject\.update /);
    expect(writes[0]).toContain('"status":"PUBLISHED"');
    expect(writes[0]).not.toContain('subSubjects');
  });

  it('leaves a draft specialization a draft, and a published one published', async () => {
    const result = await new SubjectsService(prisma([])).publish(
      'cs',
      { expectedUpdatedAt: updatedAt.toISOString() },
      request,
    );
    expect(result.status).toBe('PUBLISHED');
    expect(result.subSubjects).toEqual([
      expect.objectContaining({ id: 'draft', status: 'DRAFT' }),
      expect.objectContaining({ id: 'live', status: 'PUBLISHED' }),
    ]);
  });
});
