export const COUNTRY_DERIVED_MIGRATION =
  '20260823090000_country_derived_configuration';

export type CountryDerivedMigrationState = {
  migration?: { finishedAt: Date | null; rolledBackAt: Date | null };
  countryColumns: ReadonlySet<string>;
  universityColumns: ReadonlySet<string>;
  qsRankingIndexExists: boolean;
  popularUniversitiesExists: boolean;
  popularCoursesExists: boolean;
};

/**
 * Returns true only for the verified state left when the original migration
 * has completed its columns/index work but fails creating its first FK table
 * because the database default collation differs from the established Country
 * table collation. Any other failed state must remain blocked for review.
 */
export function needsCountryDerivedMigrationRecovery(
  state: CountryDerivedMigrationState,
) {
  if (
    !state.migration ||
    state.migration.finishedAt ||
    state.migration.rolledBackAt
  ) {
    return false;
  }

  const requiredCountryColumns = [
    'feature_codes',
    'accepted_tests',
    'intake_months',
    'post_study_work_permit_months',
  ];
  if (
    requiredCountryColumns.some(
      (column) => !state.countryColumns.has(column),
    ) ||
    !state.universityColumns.has('qs_ranking') ||
    !state.qsRankingIndexExists ||
    state.popularUniversitiesExists ||
    state.popularCoursesExists
  ) {
    throw new Error(
      `Refusing to recover ${COUNTRY_DERIVED_MIGRATION}: the failed migration is not in the known safe partial state.`,
    );
  }

  return true;
}
