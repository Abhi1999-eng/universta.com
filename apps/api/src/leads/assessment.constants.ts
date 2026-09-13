/**
 * The assessment's answer vocabulary, as the server knows it.
 *
 * The browser computes a band to show progress, but nothing it sends is
 * trusted: every answer is checked against these lists and the score is
 * recomputed here before a lead is written. An unknown option is rejected
 * rather than stored, so a hand-rolled request cannot put arbitrary text into a
 * counsellor's queue or inflate an intent band.
 *
 * This mirrors the approved design's question set. It is deliberately a
 * constant rather than a table: a question set is product copy, not something
 * an editor tunes per destination, and all ten country pages ship the same one.
 */

export const ASSESSMENT_OPTIONS = {
  field: [
    'engineering',
    'computer-science',
    'business',
    'health',
    'social-sciences',
    'arts',
    'undecided',
  ],
  level: ['bachelors', 'masters', 'mba', 'phd', 'other'],
  qualification: ['school', 'diploma', 'bachelors', 'masters'],
  score: ['high', 'mid', 'low', 'below', 'unknown'],
  language: ['have-english', 'have-local', 'booked', 'preparing', 'none'],
  experience: ['none', 'under-2', '2-5', 'over-5'],
  intake: ['next', 'within-year', 'over-year', 'flexible'],
  budget: ['under-10k', '10-20k', '20-35k', 'over-35k', 'unsure'],
  intent: ['ready', 'shortlisting', 'researching', 'exploring'],
} as const;

export type AssessmentStepId = keyof typeof ASSESSMENT_OPTIONS;

export const ASSESSMENT_STEP_IDS = Object.keys(
  ASSESSMENT_OPTIONS,
) as AssessmentStepId[];

/** The points each option carries, exactly as the approved design scores it. */
const SCORES: Partial<Record<AssessmentStepId, Record<string, number>>> = {
  field: { undecided: -1 },
  score: { high: 2, mid: 1, unknown: -1 },
  language: { 'have-english': 2, 'have-local': 2, booked: 1 },
  experience: { '2-5': 1, 'over-5': 1 },
  intake: { next: 2, 'within-year': 1 },
  budget: { 'under-10k': 1, '10-20k': 1, '20-35k': 2, 'over-35k': 2, unsure: -1 },
  intent: { ready: 3, shortlisting: 2, researching: 1 },
};

export const ASSESSMENT_BANDS = [
  { id: 'high', label: 'High intent', min: 9 },
  { id: 'medium', label: 'Medium intent', min: 4 },
  { id: 'low', label: 'Early exploration', min: Number.NEGATIVE_INFINITY },
] as const;

export type AssessmentBandId = (typeof ASSESSMENT_BANDS)[number]['id'];

export function scoreAssessment(answers: Partial<Record<AssessmentStepId, string>>) {
  let total = 0;
  for (const step of ASSESSMENT_STEP_IDS) {
    const chosen = answers[step];
    if (!chosen) continue;
    total += SCORES[step]?.[chosen] ?? 0;
  }
  const band =
    ASSESSMENT_BANDS.find((entry) => total >= entry.min) ??
    ASSESSMENT_BANDS[ASSESSMENT_BANDS.length - 1];
  return { score: total, band: band.id as AssessmentBandId, bandLabel: band.label };
}

/** The catalogue's course level for an assessment level answer, where one maps. */
export const LEVEL_TO_COURSE_LEVEL: Record<string, string> = {
  bachelors: 'UG',
  masters: 'PG',
  mba: 'MBA',
  phd: 'PHD',
  other: 'DIPLOMA',
};

/**
 * The budget answers are ranges the student picks, not figures they typed. They
 * are stored against the lead's budget columns so existing Admin filters work,
 * with the currency left unset because the question asks in "EUR equivalent"
 * terms rather than a real quoted currency.
 */
export const BUDGET_TO_RANGE: Record<string, { min: number | null; max: number | null }> = {
  'under-10k': { min: null, max: 10000 },
  '10-20k': { min: 10000, max: 20000 },
  '20-35k': { min: 20000, max: 35000 },
  'over-35k': { min: 35000, max: null },
  unsure: { min: null, max: null },
};

/** English status answers that mean the student already holds a score. */
export const LANGUAGE_TO_TEST_STATUS: Record<string, string> = {
  'have-english': 'HELD',
  'have-local': 'HELD_LOCAL',
  booked: 'BOOKED',
  preparing: 'PREPARING',
  none: 'NOT_STARTED',
};
