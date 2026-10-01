import { describe, expect, it } from 'vitest';
import {
  catalogErrorLines,
  catalogErrorText,
  catalogFieldErrors,
  catalogFieldLabel,
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
