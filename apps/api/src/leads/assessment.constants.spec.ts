import {
  ASSESSMENT_COPY,
  ASSESSMENT_OPTIONS,
  ASSESSMENT_STEP_IDS,
  BUDGET_TO_RANGE,
  FIELD_TO_SUBJECT_SLUGS,
  LEVEL_TO_COURSE_LEVEL,
  assessmentSummary,
  nextIntake,
  scoreAssessment,
} from './assessment.constants';

/**
 * The intent band decides which leads reach a counsellor first, so it is
 * computed here from answers the server has already recognised -- never taken
 * from the browser that submitted them.
 */
describe('assessment scoring', () => {
  it('scores a student who is ready to apply as high intent', () => {
    const { score, band } = scoreAssessment({
      field: 'engineering',
      level: 'masters',
      qualification: 'bachelors',
      score: 'high',
      language: 'have-english',
      experience: '2-5',
      intake: 'next',
      budget: '20-35k',
      intent: 'ready',
    });
    expect(score).toBe(12);
    expect(band).toBe('high');
  });

  it('scores a student who is only looking around as early exploration', () => {
    const { band } = scoreAssessment({
      field: 'undecided',
      score: 'unknown',
      language: 'none',
      intake: 'flexible',
      budget: 'unsure',
      intent: 'exploring',
    });
    expect(band).toBe('low');
  });

  it('puts a partly-answered profile in the middle rather than at an extreme', () => {
    const { band } = scoreAssessment({
      level: 'masters',
      score: 'mid',
      language: 'booked',
      intent: 'shortlisting',
    });
    expect(band).toBe('medium');
  });

  it('ignores an answer it does not recognise rather than crediting it', () => {
    const known = scoreAssessment({ intent: 'ready' });
    const withJunk = scoreAssessment({
      intent: 'ready',
      // @ts-expect-error -- exactly the shape a hand-rolled request would send
      nonsense: 'ready',
    });
    expect(withJunk.score).toBe(known.score);
  });

  it('scores nothing at all as the lowest band, not as an error', () => {
    expect(scoreAssessment({}).band).toBe('low');
  });
});

describe('assessment answer mapping', () => {
  it('maps every study level to a course level the catalogue knows', () => {
    for (const level of ASSESSMENT_OPTIONS.level)
      expect(LEVEL_TO_COURSE_LEVEL[level]).toBeTruthy();
  });

  it('maps every budget answer to a range, including the undecided one', () => {
    for (const budget of ASSESSMENT_OPTIONS.budget)
      expect(BUDGET_TO_RANGE[budget]).toBeDefined();
    /* "Not decided yet" must not imply a budget of zero. */
    expect(BUDGET_TO_RANGE.unsure).toEqual({ min: null, max: null });
  });

  it('keeps the open-ended bands open at the right end', () => {
    expect(BUDGET_TO_RANGE['under-10k'].min).toBeNull();
    expect(BUDGET_TO_RANGE['over-35k'].max).toBeNull();
  });
});

describe('what a counsellor reads off an assessment lead', () => {
  it('labels every option the server accepts', () => {
    for (const step of ASSESSMENT_STEP_IDS)
      for (const option of ASSESSMENT_OPTIONS[step])
        expect(ASSESSMENT_COPY[step].options[option]).toBeTruthy();
  });

  it('names a subject for every field answer except "still deciding"', () => {
    for (const field of ASSESSMENT_OPTIONS.field)
      if (field !== 'undecided')
        expect(FIELD_TO_SUBJECT_SLUGS[field]?.length).toBeGreaterThan(0);
    expect(FIELD_TO_SUBJECT_SLUGS.undecided).toBeUndefined();
  });

  it('lists the answers with their questions, in the order asked', () => {
    expect(
      assessmentSummary({
        answers: { intake: 'next', field: 'engineering', budget: 'unsure' },
        band: 'medium',
        bandLabel: 'Medium intent',
        score: 5,
        completedAt: '2026-09-22T14:15:00.000Z',
      }),
    ).toEqual({
      band: 'medium',
      bandLabel: 'Medium intent',
      score: 5,
      completedAt: '2026-09-22T14:15:00.000Z',
      answers: [
        {
          id: 'field',
          question: 'What do you want to study?',
          answer: 'Engineering & Technology',
        },
        {
          id: 'intake',
          question: 'Which intake are you targeting?',
          answer: 'The next intake',
        },
        {
          id: 'budget',
          question: 'What annual budget are you working with?',
          answer: 'Not decided yet',
        },
      ],
    });
  });

  it('has no summary for a lead that did not come from the assessment', () => {
    expect(assessmentSummary(null)).toBeNull();
    expect(assessmentSummary([])).toBeNull();
  });
});

describe('nextIntake', () => {
  const intakes = [
    { id: 'feb', startMonth: 2 },
    { id: 'sep', startMonth: 9 },
  ];
  const on = (iso: string) => new Date(iso);

  it('picks the intake that starts soonest after this month', () => {
    expect(nextIntake(intakes, on('2026-03-10T00:00:00Z'))?.id).toBe('sep');
    expect(nextIntake(intakes, on('2026-10-01T00:00:00Z'))?.id).toBe('feb');
  });

  /* An intake starting this month is already under way. */
  it('moves past an intake that starts this month', () => {
    expect(nextIntake(intakes, on('2026-09-22T00:00:00Z'))?.id).toBe('feb');
  });

  it('has nothing to pick when the destination lists no intakes', () => {
    expect(nextIntake([], on('2026-09-22T00:00:00Z'))).toBeNull();
    expect(
      nextIntake([{ id: 'x', startMonth: null }], on('2026-09-22T00:00:00Z')),
    ).toBeNull();
  });
});
