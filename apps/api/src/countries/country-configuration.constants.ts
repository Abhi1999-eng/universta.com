export const COUNTRY_FEATURES = [
  ['BUDGET_FRIENDLY', 'Budget friendly'],
  ['IELTS_OPTIONAL', 'IELTS optional'],
  ['HIGH_VISA_SUCCESS', 'High visa success'],
  ['PR_FRIENDLY', 'PR friendly'],
  ['TOP_RANKED_UNIVERSITIES', 'Top ranked universities'],
  ['PART_TIME_ALLOWED', 'Part-time allowed'],
  ['POST_STUDY_WORK_AVAILABLE', 'Post-study work available'],
  ['LANGUAGE_WAIVER', 'Language waiver'],
] as const;

export const COUNTRY_FEATURE_CODES = COUNTRY_FEATURES.map(([code]) => code);
export type CountryFeatureCode = (typeof COUNTRY_FEATURE_CODES)[number];

export const COUNTRY_TESTS = ['IELTS', 'TOEFL', 'PTE'] as const;
export type CountryTest = (typeof COUNTRY_TESTS)[number];

export const INTAKE_MONTHS = [
  [1, 'January'],
  [2, 'February'],
  [3, 'March'],
  [4, 'April'],
  [5, 'May'],
  [6, 'June'],
  [7, 'July'],
  [8, 'August'],
  [9, 'September'],
  [10, 'October'],
  [11, 'November'],
  [12, 'December'],
] as const;

export function countryFeatureLabel(code: string): string {
  return COUNTRY_FEATURES.find(([value]) => value === code)?.[1] ?? code;
}
