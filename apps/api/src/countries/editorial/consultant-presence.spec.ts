import { CountryEditorialService } from './country-editorial.service';

/**
 * Who a student could ask about a destination, and where they are.
 *
 * Counted from the consultants already recorded against the destination
 * rather than curated a second time, so the chip row on a country guide can
 * never offer a city the directory then shows as empty.
 */

type Consultant = {
  id: string;
  locations: Array<{ location: { city: string } }>;
};

function presenceOf(consultants: Consultant[]) {
  const prisma = {
    consultant: { findMany: jest.fn().mockResolvedValue(consultants) },
  };
  const service = new CountryEditorialService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {},
  );
  return {
    prisma,
    run: () =>
      (
        service as unknown as {
          consultantPresence: (id: string) => Promise<{
            total: number;
            cities: Array<{ city: string; count: number }>;
          }>;
        }
      ).consultantPresence('country-1'),
  };
}

const at = (id: string, ...cities: string[]): Consultant => ({
  id,
  locations: cities.map((city) => ({ location: { city } })),
});

describe('consultant presence for a destination', () => {
  it('counts the consultants who work on it', async () => {
    const { run } = presenceOf([at('a', 'Delhi'), at('b', 'Dubai')]);
    expect((await run()).total).toBe(2);
  });

  /* One firm with three branches in a city is one consultant a student can
     approach, not three. */
  it('counts a firm once however many offices it keeps in a city', async () => {
    const { run } = presenceOf([at('a', 'Delhi', 'Delhi', 'Delhi')]);
    expect((await run()).cities).toEqual([{ city: 'Delhi', count: 1 }]);
  });

  it('puts the busiest city first', async () => {
    const { run } = presenceOf([
      at('a', 'Dubai'),
      at('b', 'Delhi'),
      at('c', 'Delhi'),
    ]);
    expect((await run()).cities).toEqual([
      { city: 'Delhi', count: 2 },
      { city: 'Dubai', count: 1 },
    ]);
  });

  /* A long tail of one-office cities belongs on the directory, not in a row
     of chips under a heading. */
  it('offers no more cities than a chip row can carry', async () => {
    const { run } = presenceOf(
      Array.from({ length: 12 }, (_, i) => at(`c${i}`, `City ${i}`)),
    );
    expect((await run()).cities).toHaveLength(6);
  });

  it('leaves out an office with no city recorded', async () => {
    const { run } = presenceOf([at('a', '  '), at('b', 'Delhi')]);
    expect((await run()).cities).toEqual([{ city: 'Delhi', count: 1 }]);
  });

  /* A consultant with no office still advises on the destination. */
  it('counts a consultant who has no office at all', async () => {
    const { run } = presenceOf([at('a')]);
    expect(await run()).toEqual({ total: 1, cities: [] });
  });

  it('asks only for published consultants of this destination', async () => {
    const { prisma, run } = presenceOf([]);
    await run();
    expect(prisma.consultant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          deletedAt: null,
          countries: { some: { countryId: 'country-1' } },
        }),
      }),
    );
  });
});
