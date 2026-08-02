import { describe, expect, it } from 'vitest';
import { safeDetails } from './catalog-proxy';

/** ISS-015. Publish readiness failures answer 422 with a list of
 * {field, message} pairs naming what is still missing. The proxy's detail
 * allow-list only covered COUNTRY_NOT_READY, so the other three readiness
 * codes were flattened to `details: null`.
 *
 * Proven against production: publishing an unready course returned
 *   API   → details: [{field: "studyModes", …}, {field: "countries", …}]
 *   proxy → details: null
 * leaving the admin with "Complete course readiness requirements before
 * publishing" and nothing to act on.
 *
 * These pin that every readiness code keeps its detail, and that the
 * allow-list still withholds details for everything else. */

const readiness = [
  { field: 'studyModes', message: 'At least one active Study Mode is required' },
  { field: 'countries', message: 'At least one verified available published country mapping is required' },
];

describe('safeDetails', () => {
  it.each([
    'COUNTRY_NOT_READY',
    'COURSE_NOT_READY',
    'SUBJECT_NOT_READY',
    'SUB_SUBJECT_NOT_READY',
  ])('passes the readiness breakdown through for %s', (code) => {
    expect(safeDetails(code, readiness)).toEqual(readiness);
  });

  it('still passes validation details through', () => {
    const details = [{ property: 'slug', code: 'min', message: 'too short' }];
    expect(safeDetails('VALIDATION_ERROR', details)).toEqual(details);
  });

  it('withholds details for codes that are not on the allow-list', () => {
    expect(safeDetails('COURSE_CONFLICT', { internal: 'sql text' })).toBeNull();
    expect(safeDetails('INTERNAL_ERROR', { stack: 'trace' })).toBeNull();
    expect(safeDetails('FORBIDDEN', { user: 'someone@example.com' })).toBeNull();
  });

  it('does not match a code that merely mentions readiness', () => {
    expect(safeDetails('NOT_READY_SOMETHING', { leak: true })).toBeNull();
    expect(safeDetails('not_ready', { leak: true })).toBeNull();
    expect(safeDetails('COURSE_NOT_READY_EXTRA', { leak: true })).toBeNull();
  });

  it('returns whatever the API sent, including an empty list', () => {
    expect(safeDetails('COURSE_NOT_READY', [])).toEqual([]);
    expect(safeDetails('COURSE_NOT_READY', null)).toBeNull();
  });
});
