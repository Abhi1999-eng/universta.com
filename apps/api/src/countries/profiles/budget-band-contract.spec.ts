import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BUDGET_BANDS } from './profile.constants';
import { CostProfileDto } from './profile.dto';

/**
 * One vocabulary, everywhere. The stored column is a plain VARCHAR, so nothing
 * in the database stops a writer inventing its own bands -- which is exactly
 * what happened: a seeding script wrote LOW / MEDIUM / HIGH straight through
 * Prisma and the public Budget filter, which matches on these values, stopped
 * returning anything at all.
 */
describe('country cost profile budget band contract', () => {
  const dto = (budgetBand: string) =>
    plainToInstance(CostProfileDto, { budgetBand });

  it('pins the canonical vocabulary the filters and Admin both use', () => {
    expect([...BUDGET_BANDS]).toEqual([
      'BUDGET_FRIENDLY',
      'MID_RANGE',
      'PREMIUM',
    ]);
  });

  it('accepts every canonical band', async () => {
    for (const band of BUDGET_BANDS)
      expect(await validate(dto(band))).toHaveLength(0);
  });

  it('rejects the legacy bands the backfill maps away', async () => {
    for (const legacy of ['LOW', 'MEDIUM', 'HIGH']) {
      const errors = await validate(dto(legacy));
      expect(errors.some((error) => error.property === 'budgetBand')).toBe(
        true,
      );
    }
  });

  it('treats an absent band as a real state rather than a default', async () => {
    expect(await validate(plainToInstance(CostProfileDto, {}))).toHaveLength(0);
  });
});
