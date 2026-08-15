import { describe, expect, it } from 'vitest';
import {
  safeStudentReturnTo,
  studentLoginHref,
  studentRegisterHref,
} from './student-return-to';

describe('student return paths', () => {
  it('keeps a same-origin public path and its query string', () => {
    expect(safeStudentReturnTo('/universities/demo-university?tab=courses')).toBe(
      '/universities/demo-university?tab=courses',
    );
    expect(studentLoginHref('/courses?country=canada')).toBe(
      '/student/login?returnTo=%2Fcourses%3Fcountry%3Dcanada',
    );
  });

  it('falls back to the student dashboard for unsafe return paths', () => {
    for (const value of [
      'https://example.invalid',
      '//example.invalid',
      '/\\example.invalid',
      'javascript:alert(1)',
      null,
    ]) {
      expect(safeStudentReturnTo(value)).toBe('/student');
    }
    expect(studentRegisterHref('https://example.invalid')).toBe(
      '/student/register?returnTo=%2Fstudent',
    );
  });
});
