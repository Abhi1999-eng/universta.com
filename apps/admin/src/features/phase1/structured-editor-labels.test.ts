import { describe, expect, it } from 'vitest';
import { offeringDurationUnit, rowFieldLabel, singularTitle } from './structured-editor-labels';

describe('words the structured editor shows', () => {
  it('names a repeated row’s fields in sentence case', () => {
    expect(rowFieldLabel('city')).toBe('City');
    expect(rowFieldLabel('minimumScore')).toBe('Minimum score');
    expect(rowFieldLabel('name')).toBe('Name');
  });

  it('names the add button in the singular, properly', () => {
    expect(singularTitle('Campuses')).toBe('Campus');
    expect(singularTitle('Accreditations')).toBe('Accreditation');
    expect(singularTitle('Academic and English-test requirements')).toBe(
      'Academic and English-test requirement',
    );
    expect(singularTitle('Courses')).toBe('Course');
  });
});

describe('the unit a course’s duration is saved with', () => {
  it('is the unit the field showed when a duration is entered and the unit left alone', () => {
    expect(offeringDurationUnit({ durationMin: '3', durationMax: '3' })).toBe('YEARS');
    expect(offeringDurationUnit({ durationMax: '18' })).toBe('YEARS');
  });

  it('is the editor’s own choice when there is one', () => {
    expect(offeringDurationUnit({ durationMin: '18', durationUnit: 'MONTHS' })).toBe('MONTHS');
  });

  it('is nothing when there is no duration', () => {
    expect(offeringDurationUnit({})).toBeUndefined();
    expect(offeringDurationUnit({ durationMin: ' ', durationUnit: '' })).toBeUndefined();
  });
});
