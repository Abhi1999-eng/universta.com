import { CountryEditorialService } from './country-editorial.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CountriesService } from '../countries.service';
import type { CountryProfilesService } from '../profiles/country-profiles.service';

/**
 * T-C4 and T-C6. The country guide's "Student voices" kept an expired
 * testimonial and showed one dated to go live next year, and never carried
 * the student's photo. The fake below applies the testimonials filter the
 * guide asks for, so the cases say which quotes a reader would see.
 */

type Row = Record<string, unknown>;

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND')
      return (condition as Row[]).every((part) => matches(row, part));
    if (key === 'OR')
      return (condition as Row[]).some((part) => matches(row, part));
    const value = row[key];
    if (condition === null) return value === null || value === undefined;
    if (typeof condition !== 'object' || condition instanceof Date)
      return value === condition;
    const ops = condition as { lte?: Date; gt?: Date };
    if (!(value instanceof Date)) return false;
    if (ops.lte && !(value <= ops.lte)) return false;
    if (ops.gt && !(value > ops.gt)) return false;
    return true;
  });
}

const quote = (id: string, window: Row = {}) => ({
  id,
  quote: `Quote ${id}`,
  attribution: 'A fictional student',
  attributionNote: null,
  displayOrder: 0,
  imageMediaId: null,
  status: 'PUBLISHED',
  deletedAt: null,
  publishStartsAt: null,
  publishEndsAt: null,
  ...window,
});

const stored = [
  quote('always'),
  quote('expired', { publishEndsAt: new Date('2026-10-01T00:00:00Z') }),
  quote('next-year', { publishStartsAt: new Date('2027-01-01T00:00:00Z') }),
  quote('in-window', {
    publishStartsAt: new Date('2026-10-01T00:00:00Z'),
    publishEndsAt: new Date('2026-12-31T00:00:00Z'),
    imageMediaId: 'media-1',
  }),
  quote('draft', { status: 'DRAFT' }),
];

function service() {
  const prisma = {
    country: {
      findFirst: async (args: {
        include: { testimonials: { where: Row; select: Row } };
      }) => ({
        id: 'country-1',
        contentSections: [],
        faqs: [],
        consultantCards: [],
        testimonials: stored
          .filter((row) => matches(row, args.include.testimonials.where))
          .map((row) => {
            const picked: Row = {};
            for (const key of Object.keys(args.include.testimonials.select))
              picked[key] = (row as Row)[key];
            return picked;
          }),
      }),
    },
    seoMetadata: { findUnique: async () => null },
    consultant: { findMany: async () => [] },
    mediaAsset: {
      findMany: async () => [
        {
          id: 'media-1',
          publicUrl: '/media/student.jpg',
          title: 'Student',
          altText: 'A fictional student',
          width: 400,
          height: 400,
        },
      ],
    },
  } as unknown as PrismaService;
  const countries = {
    publicDetail: async () => ({ id: 'country-1', slug: 'japan' }),
  } as unknown as CountriesService;
  const profiles = {
    publicBundle: async () => ({}),
    publicDetail: () => ({}),
  } as unknown as CountryProfilesService;
  return new CountryEditorialService(prisma, countries, profiles);
}

describe('A country guide’s student testimonials', () => {
  beforeEach(() =>
    jest.useFakeTimers({ now: new Date('2026-10-19T12:00:00Z') }),
  );
  afterEach(() => jest.useRealTimers());

  it('shows only quotes inside their publishing window', async () => {
    const page = await service().publicPage('japan');
    expect(page.testimonials.map((item) => item.id)).toEqual([
      'always',
      'in-window',
    ]);
  });

  it('carries the student’s photo, or none', async () => {
    const page = await service().publicPage('japan');
    expect(page.testimonials[0].imageMedia).toBeNull();
    expect(page.testimonials[1]).toMatchObject({
      quote: 'Quote in-window',
      imageMedia: {
        id: 'media-1',
        publicUrl: '/media/student.jpg',
        width: 400,
        height: 400,
      },
    });
    expect(page.testimonials[1]).not.toHaveProperty('imageMediaId');
  });
});
