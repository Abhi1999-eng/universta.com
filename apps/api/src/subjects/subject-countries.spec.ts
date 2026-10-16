import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * The destinations a subject (or a specialization) is listed for, set from
 * the subject's own editor: the editor's ticks replace the editorial links,
 * a destination that teaches it through a published course stays listed
 * whatever is sent, and a link to a deleted destination is left out.
 */

const subject = {
  id: 'cs',
  name: 'Computer Science',
  slug: 'computer-science',
  status: 'PUBLISHED',
  deletedAt: null,
  courseLevels: [],
  subSubjects: [],
  _count: { courses: 0, countrySubjects: 0 },
};
const country = (id: string, name: string, deletedAt: Date | null = null) => ({
  id,
  name,
  slug: name.toLowerCase(),
  status: 'PUBLISHED',
  deletedAt,
});

function prisma(calls: Record<string, unknown[]>) {
  const record = (name: string) => (args: unknown) => {
    (calls[name] ??= []).push(args);
  };
  const links = [
    {
      countryId: 'uk',
      source: 'DERIVED',
      country: country('uk', 'United Kingdom'),
    },
    { countryId: 'de', source: 'EDITORIAL', country: country('de', 'Germany') },
    {
      countryId: 'xx',
      source: 'EDITORIAL',
      country: country('xx', 'Gone', new Date()),
    },
  ];
  const tx = {
    countrySubject: {
      deleteMany: async (args: unknown) => {
        record('deleteMany')(args);
        return { count: 2 };
      },
      findMany: async () => [{ countryId: 'uk' }],
      createMany: async (args: unknown) => {
        record('createMany')(args);
        return { count: 1 };
      },
    },
  };
  return {
    subject: { findFirst: async () => subject },
    country: {
      count: async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in.filter((id) => id !== 'nope').length,
    },
    countrySubject: {
      findMany: async () => links,
    },
    $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    auditLog: { create: async () => null },
  } as unknown as PrismaService;
}
const request = {
  user: { sub: 'admin-1' },
  headers: {},
  ip: '127.0.0.1',
  get: () => undefined,
} as unknown as AuthenticatedRequest;

describe('a subject’s destinations, set from the subject', () => {
  it('lists the live destinations by name and says which are derived', async () => {
    const service = new SubjectsService(prisma({}));
    const rows = await service.listSubjectCountries('cs');
    expect(rows.map((row) => [row.country.name, row.source])).toEqual([
      ['Germany', 'EDITORIAL'],
      ['United Kingdom', 'DERIVED'],
    ]);
  });

  it('replaces the editorial links and keeps the derived ones', async () => {
    const calls: Record<string, unknown[]> = {};
    const service = new SubjectsService(prisma(calls));
    await service.putSubjectCountries(
      'cs',
      { countryIds: ['uk', 'fr', 'fr'] },
      request,
    );
    expect(calls.deleteMany[0]).toEqual({
      where: { subjectId: 'cs', source: 'EDITORIAL' },
    });
    // The UK already stands (derived); only France is written, once.
    expect((calls.createMany[0] as { data: unknown[] }).data).toEqual([
      { countryId: 'fr', subjectId: 'cs', source: 'EDITORIAL' },
    ]);
  });

  it('refuses a destination that does not exist', async () => {
    const service = new SubjectsService(prisma({}));
    await expect(
      service.putSubjectCountries('cs', { countryIds: ['nope'] }, request),
    ).rejects.toMatchObject({
      response: { code: 'COUNTRY_INVALID' },
    });
  });
});
