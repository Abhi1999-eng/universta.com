import {
  calculateProfileCompletion,
  PROFILE_SECTIONS,
  type CompletionInput,
} from './profile-completion';

/** The number a student reads on Home. It must be deterministic, and it must
 * never depend on anything but the facts below. */

const empty: CompletionInput = {
  dateOfBirth: null,
  nationalityCountryId: null,
  currentCountryId: null,
  preferredSubjectId: null,
  preferredCourseLevelId: null,
  preferredCountryCount: 0,
  academicRecordCount: 0,
  englishTestCount: 0,
  hasPassport: false,
  documentTypes: [],
};

const full: CompletionInput = {
  dateOfBirth: new Date('2003-04-17'),
  nationalityCountryId: 'country-1',
  currentCountryId: 'country-2',
  preferredSubjectId: 'subject-1',
  preferredCourseLevelId: 'level-1',
  preferredCountryCount: 2,
  academicRecordCount: 1,
  englishTestCount: 1,
  hasPassport: true,
  documentTypes: ['RESUME', 'SOP', 'LOR'],
};

describe('profile completion', () => {
  it('starts at zero and names the first thing to do', () => {
    const result = calculateProfileCompletion(empty);
    expect(result.percentage).toBe(0);
    expect(result.completedSections).toEqual([]);
    expect(result.missingSections).toHaveLength(PROFILE_SECTIONS.length);
    expect(result.nextSection).toBe('PERSONAL_INFORMATION');
    expect(result.nextSectionLabel).toBe('Personal details');
  });

  it('reaches a hundred and then has nothing left to suggest', () => {
    const result = calculateProfileCompletion(full);
    expect(result.percentage).toBe(100);
    expect(result.missingSections).toEqual([]);
    expect(result.nextSection).toBeNull();
    expect(result.nextSectionLabel).toBeNull();
  });

  it('counts a section only when all of its facts are present', () => {
    const halfPersonal = calculateProfileCompletion({
      ...empty,
      dateOfBirth: new Date('2003-04-17'),
      nationalityCountryId: 'country-1',
    });
    expect(halfPersonal.completedSections).not.toContain(
      'PERSONAL_INFORMATION',
    );

    const wholePersonal = calculateProfileCompletion({
      ...empty,
      dateOfBirth: new Date('2003-04-17'),
      nationalityCountryId: 'country-1',
      currentCountryId: 'country-2',
    });
    expect(wholePersonal.completedSections).toEqual(['PERSONAL_INFORMATION']);
  });

  it('maps each document type to its own section', () => {
    const resumeOnly = calculateProfileCompletion({
      ...empty,
      documentTypes: ['RESUME'],
    });
    expect(resumeOnly.completedSections).toEqual(['RESUME']);
    expect(resumeOnly.missingSections).toContain('STATEMENT_OF_PURPOSE');
    expect(resumeOnly.missingSections).toContain('RECOMMENDATION_LETTER');
  });

  it('weights every section the same, so the bar moves predictably', () => {
    const one = calculateProfileCompletion({ ...empty, hasPassport: true });
    const two = calculateProfileCompletion({
      ...empty,
      hasPassport: true,
      englishTestCount: 1,
    });
    expect(one.percentage).toBe(Math.round(100 / PROFILE_SECTIONS.length));
    expect(two.percentage).toBe(Math.round(200 / PROFILE_SECTIONS.length));
  });

  it('suggests the next step in onboarding order, not at random', () => {
    const result = calculateProfileCompletion({
      ...full,
      englishTestCount: 0,
      hasPassport: false,
    });
    expect(result.nextSection).toBe('ENGLISH_TEST');
    expect(result.nextSectionLabel).toBe('English test score');
  });
});
