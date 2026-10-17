import { describe, expect, it } from 'vitest';
import {
  catalogErrorLines,
  catalogErrorText,
  catalogFieldErrors,
  catalogFieldLabel,
  subjectInUseText,
} from './catalog-errors';
import { fieldErrorsFromServer } from './country-field-rules';

/**
 * The API answers a failed validation with a generic headline and the real
 * reasons underneath it. Every editor but one showed only the headline, so
 * an author saw "Invalid catalog request" and was left to guess which of two
 * hundred fields the server had objected to.
 */

const rejection = (details: unknown) => ({
  name: 'CatalogMutationError',
  message: 'Invalid catalog request',
  code: 'VALIDATION_ERROR',
  status: 400,
  details,
});

describe('what a rejected catalogue write says', () => {
  it('reads the reasons out instead of the headline', () => {
    const cause = rejection([
      { property: 'subjectIds', code: 'isUuid', message: 'each value in subjectIds must be a UUID' },
      { property: 'name', code: 'isNotEmpty', message: 'name should not be empty' },
    ]);
    expect(catalogErrorText(cause, 'Unable to save country')).toBe(
      'each value in subjectIds must be a UUID · name should not be empty',
    );
  });

  it('names the field when the message does not', () => {
    const cause = rejection([
      { property: 'iso2Code', code: 'length', message: 'must be exactly 2 characters' },
    ]);
    expect(catalogErrorLines(cause)).toEqual([
      'ISO2 code: must be exactly 2 characters',
    ]);
  });

  it('does not repeat a field the message already names', () => {
    const cause = rejection([
      { property: 'subjectIds', message: 'each value in subjectIds must be a UUID' },
    ]);
    expect(catalogErrorLines(cause)).toEqual([
      'each value in subjectIds must be a UUID',
    ]);
  });

  it('keeps the field alongside its message, for a form to place', () => {
    const cause = rejection([
      { property: 'subSubjectIds', message: 'each value in subSubjectIds must be a UUID' },
    ]);
    expect(catalogFieldErrors(cause)).toEqual([
      {
        field: 'subSubjectIds',
        label: 'Specializations',
        message: 'each value in subSubjectIds must be a UUID',
      },
    ]);
  });

  it('says each thing once', () => {
    const cause = rejection([
      { property: 'name', message: 'name should not be empty' },
      { property: 'name', message: 'name should not be empty' },
    ]);
    expect(catalogErrorLines(cause)).toHaveLength(1);
  });

  it('falls back to the headline when there are no details', () => {
    expect(catalogErrorText(rejection(undefined), 'Unable to save')).toBe(
      'Invalid catalog request',
    );
  });

  it('falls back to the caller’s wording for something that is not ours', () => {
    expect(catalogErrorText({}, 'Unable to save country')).toBe(
      'Unable to save country',
    );
    expect(catalogErrorText(new Error('network down'), 'Unable to save')).toBe(
      'network down',
    );
  });

  it('humanises a field nobody has named', () => {
    expect(catalogFieldLabel('tuitionMin')).toBe('Tuition min');
    expect(catalogFieldLabel('faqs.0.question')).toBe('Faqs 0 question');
    expect(catalogFieldLabel('subjectIds')).toBe('Subjects');
  });
});

describe('putting a message back on its own field', () => {
  it('reads `property`, which is what a rejected validation sends', () => {
    /* The readiness check sends `field`; class-validator sends `property`.
       Reading only `field` meant every validation error matched nothing and
       the form fell through to the banner with no field named. */
    expect(
      fieldErrorsFromServer(
        rejection([{ property: 'iso2Code', message: 'must be exactly 2 characters' }]),
      ),
    ).toEqual({ iso2Code: 'must be exactly 2 characters' });
  });

  it('still reads `field`, which is what a readiness failure sends', () => {
    expect(
      fieldErrorsFromServer({
        details: [{ field: 'tagline', message: 'A tagline is required to publish.' }],
      }),
    ).toEqual({ tagline: 'A tagline is required to publish.' });
  });
});

/* A subject delete refused for its courses: the API sends how many still
   use it and how many deleted ones still point at it. A deleted course is
   kept in the database and listed nowhere in the admin, so the second count
   is what explains an empty course list. */
describe('subjectInUseText', () => {
  const inUse = (details: unknown) => ({ name: 'CatalogMutationError', message: 'A subject referenced by courses cannot be deleted', code: 'SUBJECT_IN_USE', status: 409, details });

  it('counts the courses that still use the subject', () => {
    expect(subjectInUseText(inUse({ liveCourses: 3, deletedCourses: 0 }))).toBe('3 courses still use this subject. Move them to another subject first.');
    expect(subjectInUseText(inUse({ liveCourses: 1, deletedCourses: 0 }))).toBe('1 course still uses this subject. Move it to another subject first.');
  });

  it('says plainly when only deleted courses are in the way', () => {
    expect(subjectInUseText(inUse({ liveCourses: 0, deletedCourses: 2 }))).toBe('2 deleted courses still point at this subject; they must be removed from the database first.');
    expect(subjectInUseText(inUse({ liveCourses: 0, deletedCourses: 1 }))).toBe('1 deleted course still points at this subject; it must be removed from the database first.');
  });

  it('names both when both are in the way', () => {
    expect(subjectInUseText(inUse({ liveCourses: 1, deletedCourses: 4 }))).toBe(
      '1 course still uses this subject. Move it to another subject first. 4 deleted courses still point at this subject; they must be removed from the database first.',
    );
  });

  it('leaves any other failure, or missing counts, to the headline', () => {
    expect(subjectInUseText(inUse(null))).toBeNull();
    expect(subjectInUseText(inUse({ liveCourses: 0, deletedCourses: 0 }))).toBeNull();
    expect(subjectInUseText({ ...inUse({ liveCourses: 2, deletedCourses: 0 }), code: 'SUBJECT_STALE_VERSION' })).toBeNull();
    expect(subjectInUseText(new Error('offline'))).toBeNull();
  });
});
