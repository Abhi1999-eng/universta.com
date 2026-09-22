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
  budget: {
    'under-10k': 1,
    '10-20k': 1,
    '20-35k': 2,
    'over-35k': 2,
    unsure: -1,
  },
  intent: { ready: 3, shortlisting: 2, researching: 1 },
};

export const ASSESSMENT_BANDS = [
  { id: 'high', label: 'High intent', min: 9 },
  { id: 'medium', label: 'Medium intent', min: 4 },
  { id: 'low', label: 'Early exploration', min: Number.NEGATIVE_INFINITY },
] as const;

export type AssessmentBandId = (typeof ASSESSMENT_BANDS)[number]['id'];

export function scoreAssessment(
  answers: Partial<Record<AssessmentStepId, string>>,
) {
  let total = 0;
  for (const step of ASSESSMENT_STEP_IDS) {
    const chosen = answers[step];
    if (!chosen) continue;
    total += SCORES[step]?.[chosen] ?? 0;
  }
  const band =
    ASSESSMENT_BANDS.find((entry) => total >= entry.min) ??
    ASSESSMENT_BANDS[ASSESSMENT_BANDS.length - 1];
  return {
    score: total,
    band: band.id,
    bandLabel: band.label,
  };
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
export const BUDGET_TO_RANGE: Record<
  string,
  { min: number | null; max: number | null }
> = {
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

/**
 * The catalogue subject a "What do you want to study?" answer names, so the
 * lead's Subject is set rather than left "Not selected" beside an answer that
 * said exactly what the student wants. Candidates are tried in order; a broad
 * answer ("Social Sciences & Law") takes its first published match.
 */
export const FIELD_TO_SUBJECT_SLUGS: Record<string, readonly string[]> = {
  engineering: ['engineering'],
  'computer-science': ['computer-science'],
  business: ['business-and-management', 'business-management'],
  health: ['health-and-medicine', 'health-medicine'],
  'social-sciences': ['social-sciences', 'law'],
  arts: ['design-and-creative-arts', 'creative-arts-design'],
};

/**
 * The intake a student means by "The next intake": of the destination's
 * intakes, the one that starts soonest after this month. An intake starting
 * this month is treated as under way, so it is the one after. The other
 * timing answers ("within 12 months", "flexible") name no single intake and
 * are left to the counsellor, in the assessment answers.
 */
export function nextIntake<T extends { id: string; startMonth: number | null }>(
  intakes: readonly T[],
  now: Date = new Date(),
): T | null {
  const month = now.getUTCMonth() + 1;
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const intake of intakes) {
    if (!intake.startMonth || intake.startMonth < 1 || intake.startMonth > 12)
      continue;
    const distance = (intake.startMonth - month + 12) % 12 || 12;
    if (distance < bestDistance) {
      best = intake;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Each question and answer as the student saw them, for the counsellor.
 * Mirrors the question set in the web app's `study-abroad-assessment.ts`; the
 * spec beside this file keeps the option ids of both in step.
 */
export const ASSESSMENT_COPY: Record<
  AssessmentStepId,
  { question: string; options: Record<string, string> }
> = {
  field: {
    question: 'What do you want to study?',
    options: {
      engineering: 'Engineering & Technology',
      'computer-science': 'Computer Science & IT',
      business: 'Business & Management',
      health: 'Health & Life Sciences',
      'social-sciences': 'Social Sciences & Law',
      arts: 'Arts, Design & Humanities',
      undecided: 'Still deciding',
    },
  },
  level: {
    question: 'Which level are you applying for?',
    options: {
      bachelors: "Bachelor's",
      masters: "Master's",
      mba: 'MBA / Business',
      phd: 'PhD / Research',
      other: 'Diploma or other',
    },
  },
  qualification: {
    question: 'What have you studied so far?',
    options: {
      school: 'School / Class 12',
      diploma: 'Diploma',
      bachelors: "Bachelor's degree",
      masters: "Master's degree",
    },
  },
  score: {
    question: 'What is your academic score?',
    options: {
      high: 'Above 80% / 8.0 CGPA',
      mid: '65-80% / 6.5-8.0 CGPA',
      low: '50-65% / 5.0-6.5 CGPA',
      below: 'Below 50%',
      unknown: 'Not sure yet',
    },
  },
  language: {
    question: 'Where are you with language tests?',
    options: {
      'have-english': 'I have an English score',
      'have-local': 'I have a local-language certificate',
      booked: 'Test booked',
      preparing: 'Preparing now',
      none: 'Not started',
    },
  },
  experience: {
    question: 'Do you have work experience?',
    options: {
      none: 'None',
      'under-2': 'Under 2 years',
      '2-5': '2-5 years',
      'over-5': 'More than 5 years',
    },
  },
  intake: {
    question: 'Which intake are you targeting?',
    options: {
      next: 'The next intake',
      'within-year': 'Within 12 months',
      'over-year': 'More than a year away',
      flexible: 'Flexible',
    },
  },
  budget: {
    question: 'What annual budget are you working with?',
    options: {
      'under-10k': 'Under 10,000 EUR equivalent',
      '10-20k': '10,000 - 20,000',
      '20-35k': '20,000 - 35,000',
      'over-35k': 'Above 35,000',
      unsure: 'Not decided yet',
    },
  },
  intent: {
    question: 'Where are you in the process?',
    options: {
      ready: 'Ready to apply',
      shortlisting: 'Shortlisting universities',
      researching: 'Researching options',
      exploring: 'Just exploring',
    },
  },
};

export type AssessmentSummary = {
  band: string | null;
  bandLabel: string | null;
  score: number | null;
  completedAt: string | null;
  answers: Array<{ id: string; question: string; answer: string }>;
};

/** The stored assessment, readable: every answered question with its label,
 * in the order the student was asked. Unknown ids are shown as stored rather
 * than dropped, so nothing a lead recorded goes missing from its page. */
export function assessmentSummary(value: unknown): AssessmentSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const stored =
    record.answers && typeof record.answers === 'object'
      ? (record.answers as Record<string, unknown>)
      : {};
  const answers = ASSESSMENT_STEP_IDS.flatMap((step) => {
    const chosen = stored[step];
    if (typeof chosen !== 'string') return [];
    const copy = ASSESSMENT_COPY[step];
    return [
      {
        id: step,
        question: copy.question,
        answer: copy.options[chosen] ?? chosen,
      },
    ];
  });
  return {
    band: typeof record.band === 'string' ? record.band : null,
    bandLabel: typeof record.bandLabel === 'string' ? record.bandLabel : null,
    score: typeof record.score === 'number' ? record.score : null,
    completedAt:
      typeof record.completedAt === 'string' ? record.completedAt : null,
    answers,
  };
}
