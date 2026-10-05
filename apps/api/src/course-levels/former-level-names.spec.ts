import { formerLevelCode, formerLevelNames } from './former-level-names';

describe('the names four levels had before the rename', () => {
  it('still say which level they meant, whatever the case or spacing', () => {
    expect(formerLevelCode('Undergraduate')).toBe('UG');
    expect(formerLevelCode('  postgraduate ')).toBe('PG');
    expect(formerLevelCode('Master of Business Administration')).toBe('MBA');
    expect(formerLevelCode('DOCTOR OF PHILOSOPHY')).toBe('PHD');
  });

  it('are not a second name for anything else', () => {
    for (const term of ['', '   ', 'Bachelor', "Bachelor's", 'Diploma', 'UG'])
      expect(formerLevelCode(term)).toBeNull();
    expect(formerLevelCode(null)).toBeNull();
    expect(formerLevelCode(undefined)).toBeNull();
  });

  it('cover exactly the four levels the migration renamed', () => {
    expect(
      formerLevelNames()
        .map((row) => row.code)
        .sort(),
    ).toEqual(['MBA', 'PG', 'PHD', 'UG']);
  });
});
