import {
  BULK_RESOURCES,
  bulkFieldValueErrors,
  bulkFields,
} from './bulk-resources';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * CON-C13. A consultant import stored any verification state as typed, and
 * the admin then showed a state the record did not have. Only the three the
 * admin and the profile know are accepted.
 */

const consultants = BULK_RESOURCES.consultants;
/* A row with no countries listed never reaches the database. */
const prisma = {} as PrismaService;

describe('Consultant import verification states', () => {
  it('offers the three states in the template', () => {
    expect(
      bulkFields(consultants).find(
        (field) => field.key === 'verificationStatus',
      )?.allowedValues,
    ).toEqual(['UNVERIFIED', 'PENDING', 'VERIFIED']);
  });

  it('refuses any other state on the row', async () => {
    const row = { name: 'Demo Advisers', verificationStatus: 'CHECKED' };
    expect(bulkFieldValueErrors(consultants, row)).toEqual([
      expect.stringContaining('"CHECKED" is invalid'),
    ]);
    await expect(consultants.parseRow(row, prisma)).resolves.toEqual({
      errors: [expect.stringContaining('verificationStatus must be one of')],
    });
  });

  it('accepts Pending, and reads a blank as Unverified', async () => {
    await expect(
      consultants.parseRow(
        { name: 'Demo Advisers', verificationStatus: 'PENDING' },
        prisma,
      ),
    ).resolves.toMatchObject({ data: { verificationStatus: 'PENDING' } });
    await expect(
      consultants.parseRow(
        { name: 'Demo Advisers', verificationStatus: '' },
        prisma,
      ),
    ).resolves.toMatchObject({ data: { verificationStatus: 'UNVERIFIED' } });
  });
});
