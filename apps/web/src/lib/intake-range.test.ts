import { describe, expect, it } from 'vitest';
import { intakeRange } from './intake-range';

describe('intakeRange', () => {
  it.each([
    [{ startMonth: 9, endMonth: 11 }, 'September – November'],
    [{ startMonth: 9, endMonth: 9 }, 'September'],
    [{ startMonth: 11, endMonth: 2 }, 'November – February'],
    [{ shortLabel: 'Sep' }, 'Sep'],
  ])('formats %o as %s', (intake, expected) => {
    expect(intakeRange(intake)).toBe(expected);
  });
});
