import { describe, expect, it } from 'vitest';
import type { CourseAvailability } from './catalog';
import {
  academicRows,
  englishRows,
  feeRange,
  hasEntryDetail,
  intakeRows,
} from './course-entry';

const row = (over: Partial<CourseAvailability> = {}): CourseAvailability => ({
  id: 'a1',
  country: { id: 'c1', name: 'Germany', slug: 'germany' },
  ...over,
});

describe('the money a destination asks for', () => {
  it('prints a range when the ends differ', () => {
    expect(feeRange({ min: '200000', max: '450000', currencyCode: 'INR' })).toBe(
      'INR 200,000 – 450,000',
    );
  });

  it('prints one figure when both ends agree', () => {
    /* "0 – 0" reads as a range nobody set, not as a course that is free. */
    expect(feeRange({ min: '0', max: '0', currencyCode: 'EUR' })).toBe('EUR 0');
  });

  it('prints the end it has when only one is recorded', () => {
    expect(feeRange({ max: '15000', currencyCode: 'GBP' })).toBe('GBP 15,000');
  });

  it('says nothing when neither end is recorded', () => {
    expect(feeRange({ currencyCode: 'EUR' })).toBeNull();
    expect(feeRange(null)).toBeNull();
  });

  it('drops the currency rather than inventing one', () => {
    expect(feeRange({ min: '500' })).toBe('500');
  });
});

describe('the academic bar', () => {
  it('reads a percentage and a CGPA', () => {
    expect(
      academicRows(row({ academicRequirements: { percentage: '70', cgpa: '3.2' } })),
    ).toEqual([
      { label: 'Academic minimum', value: '70%' },
      { label: 'Minimum CGPA', value: '3.2' },
    ]);
  });

  it('counts work experience in months, and says "1 month" once', () => {
    expect(academicRows(row({ workExperienceMonths: 1 }))[0]).toEqual({
      label: 'Work experience',
      value: '1 month',
    });
    expect(academicRows(row({ workExperienceMonths: 24 }))[0]?.value).toBe(
      '24 months',
    );
  });

  it('leaves out what nobody recorded, rather than printing a zero', () => {
    expect(academicRows(row({ academicRequirements: { percentage: null, cgpa: null } }))).toEqual([]);
    expect(academicRows(row())).toEqual([]);
  });
});

describe('the English tests a destination names a number for', () => {
  it('lists only the tests with a score behind them', () => {
    expect(
      englishRows(
        row({ englishRequirements: { ielts: '6.5', toefl: null, pte: '59', duolingo: null } }),
      ),
    ).toEqual([
      { label: 'IELTS', value: '6.5' },
      { label: 'PTE', value: '59' },
    ]);
  });

  it('says nothing when no test has a number', () => {
    expect(englishRows(row({ englishRequirements: {} }))).toEqual([]);
    expect(englishRows(row())).toEqual([]);
  });
});

describe('the intakes a destination opens', () => {
  const intake = (over = {}) => ({
    id: 'i1',
    intake: { id: 'x', name: 'September', slug: 'september' },
    ...over,
  });

  it('carries the deadline as a plain date', () => {
    expect(
      intakeRows(row({ intakes: [intake({ applicationDeadline: '2027-01-15T00:00:00.000Z' })] })),
    ).toEqual([
      { id: 'i1', name: 'September', deadline: '2027-01-15', notes: null },
    ]);
  });

  it('keeps an intake whose deadline nobody recorded', () => {
    /* Knowing a course starts in September is useful even when the closing
       date is unknown, so the row stays and the cell says so. */
    expect(intakeRows(row({ intakes: [intake()] }))[0]?.deadline).toBeNull();
  });

  it('leaves out an intake that has been switched off', () => {
    expect(intakeRows(row({ intakes: [intake({ status: 'INACTIVE' })] }))).toEqual([]);
  });

  it('falls back to the short label, then to a plain word', () => {
    expect(
      intakeRows(row({ intakes: [{ id: 'i2', intake: { id: 'x', name: '', slug: 's', shortLabel: 'Fall' } }] }))[0]?.name,
    ).toBe('Fall');
    expect(intakeRows(row({ intakes: [{ id: 'i3' }] }))[0]?.name).toBe('Intake');
  });
});

describe('whether a destination has anything to say', () => {
  it('is false for a mapping that is only a country', () => {
    expect(hasEntryDetail(row())).toBe(false);
  });

  it('is true as soon as one fact is recorded', () => {
    expect(hasEntryDetail(row({ tuition: { min: '100' } }))).toBe(true);
    expect(hasEntryDetail(row({ englishRequirements: { ielts: '6.5' } }))).toBe(true);
    expect(hasEntryDetail(row({ admissionRequirements: 'A degree.' }))).toBe(true);
  });

  it('is not fooled by empty prose', () => {
    expect(hasEntryDetail(row({ admissionRequirements: '   ' }))).toBe(false);
  });
});
