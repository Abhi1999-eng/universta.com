import { describe, expect, it } from '@jest/globals';
import type { PrismaClient } from '../generated/prisma/client';
import {
  FOUNDATION_CONTINENTS,
  reconcileFoundationContinents,
} from './foundation-continent-seed';

type Row = {
  id: string;
  name: string;
  slug: string;
  code: string;
  deletedAt: Date | null;
  deletedKey: string;
  linkedCountryIds?: string[];
};

function fixture(initial: Row[]) {
  const rows = [...initial];
  const create = jest.fn(
    async ({
      data,
    }: {
      data: Omit<Row, 'id' | 'deletedAt' | 'deletedKey'>;
    }) => {
      const row: Row = {
        ...data,
        id: `continent-${rows.length + 1}`,
        deletedAt: null,
        deletedKey: '',
      };
      rows.push(row);
      return row;
    },
  );
  const findMany = jest.fn(
    async ({ where }: { where: { OR: Array<Partial<Row>> } }) =>
      rows.filter(
        (row) =>
          row.deletedAt === null &&
          where.OR.some(
            (candidate) =>
              candidate.name === row.name ||
              candidate.slug === row.slug ||
              candidate.code === row.code,
          ),
      ),
  );
  return {
    rows,
    create,
    prisma: {
      continent: { findMany, create },
    } as unknown as PrismaClient,
  };
}

describe('foundation continent reconciliation', () => {
  it('creates canonical continents once and is idempotent on a non-empty database', async () => {
    const state = fixture([]);

    await reconcileFoundationContinents(state.prisma, 'admin-1');
    await reconcileFoundationContinents(state.prisma, 'admin-1');

    expect(state.rows.filter((row) => row.deletedAt === null)).toHaveLength(
      FOUNDATION_CONTINENTS.length,
    );
    expect(state.create).toHaveBeenCalledTimes(FOUNDATION_CONTINENTS.length);
  });

  it('preserves a live legacy code match and its Country relations instead of attempting a conflicting slug create', async () => {
    const legacyEurope: Row = {
      id: 'legacy-europe',
      name: 'European Region',
      slug: 'european-region',
      code: 'EU',
      deletedAt: null,
      deletedKey: '',
      linkedCountryIds: ['country-1'],
    };
    const state = fixture([legacyEurope]);

    await reconcileFoundationContinents(state.prisma, 'admin-1');

    expect(state.rows.find((row) => row.id === 'legacy-europe')).toEqual(
      legacyEurope,
    );
    expect(
      state.rows.filter((row) => row.deletedAt === null && row.code === 'EU'),
    ).toEqual([legacyEurope]);
    expect(state.create).toHaveBeenCalledTimes(
      FOUNDATION_CONTINENTS.length - 1,
    );
  });

  it('does not revive a deleted canonical row, allowing a clean recreation without deleting history', async () => {
    const deletedEurope: Row = {
      id: 'deleted-europe',
      name: 'Europe',
      slug: 'europe',
      code: 'EU',
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedKey: 'deleted-europe',
    };
    const state = fixture([deletedEurope]);

    await reconcileFoundationContinents(state.prisma, 'admin-1');

    expect(state.rows.find((row) => row.id === 'deleted-europe')).toEqual(
      deletedEurope,
    );
    expect(
      state.rows.filter((row) => row.deletedAt === null && row.code === 'EU'),
    ).toHaveLength(1);
  });
});
