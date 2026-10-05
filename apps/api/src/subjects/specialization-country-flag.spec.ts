import { SubjectsService } from './subjects.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The country chip draws the country's own flag from its ISO code, and falls
 * back to three neutral bands when it has none. The specialization page's
 * projection left `iso2Code` out of its select, so every destination on it
 * came back without one and India showed as a navy block beside its own
 * name. The subject page next to it has always selected the code.
 */

const COUNTRY = {
  id: 'c-in',
  name: 'India',
  slug: 'india',
  iso2Code: 'IN',
};

function prisma(captured: { select?: unknown }) {
  const subject = {
    id: 'subj-1',
    slug: 'computing',
    name: 'Computing',
    status: 'PUBLISHED',
  };
  const specialization = {
    id: 'spec-1',
    slug: 'information-technology',
    name: 'Information Technology',
    subjectId: subject.id,
    status: 'PUBLISHED',
  };
  return {
    subject: { findFirst: async () => subject },
    subSubject: {
      findFirst: async () => specialization,
      findMany: async () => [],
      count: async () => 0,
    },
    countrySubSubject: {
      findMany: async (args: { select?: unknown }) => {
        captured.select = args.select;
        const picked = (
          args.select as { country?: { select?: Record<string, boolean> } }
        )?.country?.select;
        /* Prisma returns exactly the columns the select names, so the stub
           does too -- that is the whole bug. */
        const country = Object.fromEntries(
          Object.entries(COUNTRY).filter(([key]) => picked?.[key]),
        );
        return [{ country }];
      },
    },
    countryCourse: { groupBy: async () => [] },
    country: { findMany: async () => [] },
    course: { findMany: async () => [], groupBy: async () => [] },
    university: { findMany: async () => [], count: async () => 0 },
  } as unknown as PrismaService;
}

describe('the destinations on a specialization page', () => {
  it('carries each country’s ISO code, which is what draws its flag', async () => {
    const captured: { select?: unknown } = {};
    const service = new SubjectsService(prisma(captured));
    const result = (await service.publicSpecialization(
      'computing',
      'information-technology',
    )) as { countries: Array<Record<string, unknown>> };
    expect(result.countries).toHaveLength(1);
    expect(result.countries[0]).toMatchObject({
      slug: 'india',
      iso2Code: 'IN',
    });
  });

  it('still carries what the chip labels itself with', async () => {
    const captured: { select?: unknown } = {};
    const service = new SubjectsService(prisma(captured));
    const result = (await service.publicSpecialization(
      'computing',
      'information-technology',
    )) as { countries: Array<Record<string, unknown>> };
    expect(result.countries[0]).toMatchObject({
      id: 'c-in',
      name: 'India',
      slug: 'india',
    });
  });
});
