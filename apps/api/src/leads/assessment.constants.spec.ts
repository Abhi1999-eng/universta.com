import {
  ASSESSMENT_OPTIONS,
  BUDGET_TO_RANGE,
  LEVEL_TO_COURSE_LEVEL,
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
