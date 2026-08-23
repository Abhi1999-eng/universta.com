import { describe, expect, it } from '@jest/globals';
import { needsCountryDerivedMigrationRecovery } from './country-derived-migration-recovery';

const completeColumns = new Set([
  'feature_codes',
  'accepted_tests',
  'intake_months',
  'post_study_work_permit_months',
]);

describe('Country derived-data migration recovery', () => {
  it('recognises only the collation-failure partial state as recoverable', () => {
    expect(
      needsCountryDerivedMigrationRecovery({
        migration: { finishedAt: null, rolledBackAt: null },
        countryColumns: completeColumns,
        universityColumns: new Set(['qs_ranking']),
        qsRankingIndexExists: true,
        popularUniversitiesExists: false,
        popularCoursesExists: false,
      }),
    ).toBe(true);
  });

  it('does nothing for an unapplied, completed, or rolled-back migration', () => {
    for (const migration of [
      undefined,
      { finishedAt: new Date(), rolledBackAt: null },
      { finishedAt: null, rolledBackAt: new Date() },
    ]) {
      expect(
        needsCountryDerivedMigrationRecovery({
          migration,
          countryColumns: completeColumns,
          universityColumns: new Set(['qs_ranking']),
          qsRankingIndexExists: true,
          popularUniversitiesExists: false,
          popularCoursesExists: false,
        }),
      ).toBe(false);
    }
  });

  it('refuses to resolve an unverified failed shape', () => {
    expect(() =>
      needsCountryDerivedMigrationRecovery({
        migration: { finishedAt: null, rolledBackAt: null },
        countryColumns: new Set(),
        universityColumns: new Set(['qs_ranking']),
        qsRankingIndexExists: true,
        popularUniversitiesExists: false,
        popularCoursesExists: false,
      }),
    ).toThrow('known safe partial state');
    expect(() =>
      needsCountryDerivedMigrationRecovery({
        migration: { finishedAt: null, rolledBackAt: null },
        countryColumns: completeColumns,
        universityColumns: new Set(['qs_ranking']),
        qsRankingIndexExists: true,
        popularUniversitiesExists: true,
        popularCoursesExists: false,
      }),
    ).toThrow('known safe partial state');
    expect(() =>
      needsCountryDerivedMigrationRecovery({
        migration: { finishedAt: null, rolledBackAt: null },
        countryColumns: completeColumns,
        universityColumns: new Set(['qs_ranking']),
        qsRankingIndexExists: false,
        popularUniversitiesExists: false,
        popularCoursesExists: false,
      }),
    ).toThrow('known safe partial state');
  });
});
