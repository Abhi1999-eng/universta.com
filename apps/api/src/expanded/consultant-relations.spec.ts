import { ExpandedService } from './expanded.service';
import {
  consultantLanguageWrites,
  consultantLocationWrites,
  consultantServiceWrites,
  serviceSlug,
} from './consultant-relations';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * CON-C2, CON-C3, CON-M3. Every admin save of a consultant deleted and
 * recreated its offices, services and languages: addresses were wiped,
 * services were renamed "<name>-<position>" (two "Visa documentation"
 * filters on the directory, and ?service= links lost the consultant) and
 * language codes were cleared. These run the writes the service builds
 * against stored rows, the way Prisma would apply them.
 */

type Row = Record<string, unknown> & { id?: string };

/** Applies a nested to-many write to a list of rows, as Prisma would. */
function apply(rows: Row[], write: Row, key: 'id' | 'locationId'): Row[] {
  let next = [...rows];
  const removeWhere = write.deleteMany as Row | undefined;
  if (removeWhere) {
    const ids = (removeWhere[key] as { in: string[] } | undefined)?.in ?? [];
    next = next.filter((row) => !ids.includes(row[key] as string));
  }
  for (const change of [
    ...((write.update as Row[] | undefined) ?? []),
    ...((write.updateMany as Row[] | undefined) ?? []),
  ]) {
    const target = (change.where as Row)[key];
    next = next.map((row) =>
      row[key] === target ? { ...row, ...(change.data as Row) } : row,
    );
  }
  let n = 0;
  for (const created of (write.create as Row[] | undefined) ?? []) {
    n += 1;
    next.push({
      ...(key === 'id' ? { id: `new-${n}`, code: null } : {}),
      ...created,
    });
  }
  return next;
}

const stored = {
  locations: [
    { locationId: 'delhi', address: '12 Connaught Place' },
    { locationId: 'pune', address: '4 FC Road' },
  ],
  services: [
    {
      id: 'svc-1',
      name: 'Visa documentation',
      slug: 'visa-documentation',
      displayOrder: 1,
    },
    {
      id: 'svc-2',
      name: 'Course guidance',
      slug: 'course-guidance',
      displayOrder: 2,
    },
  ],
  languages: [
    { id: 'lang-1', name: 'English', code: 'en' },
    { id: 'lang-2', name: 'Hindi', code: 'hi' },
  ],
};

describe('A consultant’s offices, services and languages on an admin save', () => {
  it('keeps every row, with its id, slug, code and address, on an unchanged save', async () => {
    const writes: Row[] = [];
    const prisma = {
      consultant: {
        findFirst: async () => ({
          id: 'consultant-1',
          name: 'Demo Advisers',
          slug: 'demo-advisers',
          ...stored,
          countries: [],
        }),
        update: async ({ data }: { data: Row }) => {
          writes.push(data);
          return { id: 'consultant-1', slug: 'demo-advisers', ...data };
        },
      },
      seoMetadata: { findUnique: async () => null },
    } as unknown as PrismaService;
    const svc = new ExpandedService(prisma, {} as ExperimentsService);
    /* What the form sends when nothing was changed. */
    await svc.adminUpdate('consultants', 'consultant-1', {
      name: 'Demo Advisers',
      locationIds: ['delhi', 'pune'],
      locationAddresses: { delhi: '12 Connaught Place', pune: '4 FC Road' },
      services: ['Visa documentation', 'Course guidance'],
      languages: ['English', 'Hindi'],
    });
    /* Nothing deleted, nothing recreated: the lists are not written. */
    const data = writes[0];
    for (const key of ['locations', 'services', 'languages'])
      expect(data).not.toHaveProperty(key);
  });

  it('keeps an office’s address when the form leaves it out', () => {
    const write = consultantLocationWrites(
      ['delhi', 'pune'],
      undefined,
      stored.locations,
    );
    expect(apply(stored.locations, write, 'locationId')).toEqual(
      stored.locations,
    );
  });

  it('deletes only an unticked office, adds a new one and sets addresses given', () => {
    const write = consultantLocationWrites(
      ['delhi', 'mumbai'],
      { delhi: ' 14 Connaught Place ', mumbai: '' },
      stored.locations,
    );
    expect(apply(stored.locations, write, 'locationId')).toEqual([
      { locationId: 'delhi', address: '14 Connaught Place' },
      { locationId: 'mumbai', address: null },
    ]);
  });

  it('slugs a service from its name alone', () => {
    expect(serviceSlug('Visa documentation')).toBe('visa-documentation');
    const write = consultantServiceWrites(
      ['Visa documentation', 'Course guidance', 'Scholarship search'],
      stored.services,
    );
    expect(apply(stored.services, write, 'id')).toEqual([
      ...stored.services,
      {
        id: 'new-1',
        code: null,
        name: 'Scholarship search',
        slug: 'scholarship-search',
        displayOrder: 3,
      },
    ]);
  });

  it('slugs a new consultant’s services without a position suffix', () => {
    expect(
      consultantServiceWrites(
        ['Visa documentation', 'Course guidance'],
        undefined,
      ),
    ).toEqual({
      create: [
        {
          name: 'Visa documentation',
          slug: 'visa-documentation',
          displayOrder: 1,
        },
        { name: 'Course guidance', slug: 'course-guidance', displayOrder: 2 },
      ],
    });
  });

  it('removes a service that was taken out and keeps the rest', () => {
    const write = consultantServiceWrites(['Course guidance'], stored.services);
    expect(apply(stored.services, write, 'id')).toEqual([
      {
        id: 'svc-2',
        name: 'Course guidance',
        slug: 'course-guidance',
        displayOrder: 1,
      },
    ]);
  });

  it('never gives two services one slug', () => {
    const write = consultantServiceWrites(
      ['Visa: guidance', 'Visa guidance'],
      [],
    );
    expect((write.create ?? []).map((row) => row.slug)).toEqual([
      'visa-guidance',
      'visa-guidance-2',
    ]);
  });

  it('keeps a language’s code, including when only its case changed', () => {
    const write = consultantLanguageWrites(
      ['english', 'Tamil'],
      stored.languages,
    );
    expect(apply(stored.languages, write, 'id')).toEqual([
      { id: 'lang-1', name: 'english', code: 'en' },
      { id: 'new-1', code: null, name: 'Tamil' },
    ]);
  });
});
