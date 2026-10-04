import { purgeBlockReason, purgeBlocker } from './bulk.service';

/**
 * Reading what the database said.
 *
 * Prisma reports a refused delete as P2003 and, through the driver adapter,
 * no longer says which relation refused: the fields this used to read are
 * gone, so every refusal came out as "another record". MySQL's own sentence
 * is still carried inside the error, and it names the table and the column.
 */

const refused = (table: string, column: string) => ({
  code: 'P2003',
  meta: {
    modelName: 'Country',
    driverAdapterError: {
      cause: {
        originalCode: '1451',
        originalMessage: `Cannot delete or update a parent row: a foreign key constraint fails (\`universta\`.\`${table}\`, CONSTRAINT \`${table}_${column}_fkey\` FOREIGN KEY (\`${column}\`) REFERENCES \`countries\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE)`,
        kind: 'ForeignKeyConstraintViolation',
        constraint: { fields: [column] },
      },
    },
  },
});

describe('which table is in the way', () => {
  it('is read from the database’s own sentence', () => {
    expect(purgeBlocker(refused('universities', 'country_id'))).toEqual({
      table: 'universities',
      column: 'country_id',
    });
  });

  it('is nothing when the error carries no such sentence', () => {
    expect(purgeBlocker({ code: 'P2003', meta: {} })).toBeNull();
    expect(purgeBlocker(new Error('boom'))).toBeNull();
    expect(purgeBlocker(null)).toBeNull();
  });

  it('takes identifiers only, since they go back into a statement', () => {
    const forged = refused('universities` WHERE 1=1; --', 'country_id');
    expect(purgeBlocker(forged)).toBeNull();
  });
});

describe('the reason an operator is given', () => {
  it('says how many of what', () => {
    expect(purgeBlockReason(refused('universities', 'country_id'), 40)).toBe(
      '40 universities still point to it',
    );
  });

  it('agrees in number when there is one', () => {
    expect(purgeBlockReason(refused('universities', 'country_id'), 1)).toBe(
      '1 university still points to it',
    );
    expect(purgeBlockReason(refused('courses', 'subject_id'), 1)).toBe(
      '1 course still points to it',
    );
  });

  it('reads a table name as words', () => {
    expect(
      purgeBlockReason(
        refused('university_course_offerings', 'generic_course_id'),
        3,
      ),
    ).toBe('3 university course offerings still point to it');
    expect(
      purgeBlockReason(refused('student_applications', 'university_id'), 1),
    ).toBe('1 student application still points to it');
  });

  it('still names the table when the count could not be had', () => {
    expect(purgeBlockReason(refused('universities', 'country_id'))).toBe(
      'universities still point to it',
    );
  });

  it('admits it does not know which, rather than naming a guess', () => {
    expect(purgeBlockReason({ code: 'P2003', meta: {} })).toBe(
      'Other records still point to it',
    );
  });

  it('passes any other failure through as it was said', () => {
    expect(purgeBlockReason(new Error('Lock wait timeout'))).toBe(
      'Lock wait timeout',
    );
  });
});
