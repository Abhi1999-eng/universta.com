import { describe, expect, it } from 'vitest';
import { variablesForContext } from './variable-autocomplete';

const keys = (context: Parameters<typeof variablesForContext>[0]) =>
  variablesForContext(context).map((variable) => variable.key);

describe('editor variable registry', () => {
  it('returns only the variables resolved for each entity context', () => {
    expect(keys('country')).toEqual(['countryName', 'countrySlug']);
    expect(keys('university')).toEqual([
      'universityName',
      'universitySlug',
      'countryName',
      'countrySlug',
    ]);
    expect(keys('job')).toEqual([
      'jobTitle',
      'jobSlug',
      'jobLocation',
      'jobDepartment',
    ]);
    expect(keys('university')).not.toContain('jobTitle');
    expect(variablesForContext(undefined)).toEqual([]);
  });
});
