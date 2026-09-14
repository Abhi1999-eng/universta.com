import { parseCalculatorConfig } from './calculator-config';

/**
 * The calculator is the one place on a country guide where the site does
 * arithmetic on an editor's numbers, so the document it works from is checked
 * before it is trusted. A half-valid configuration is refused outright: a
 * calculator missing a factor would quietly produce a different figure from the
 * one that was set up, which is worse than no calculator at all.
 */

const valid = {
  base: { livingMin: 850, livingMax: 1200, insurance: 130, semesterFee: 275 },
  factors: [
    {
      id: 'city',
      label: 'Location',
      options: [
        { value: 'small', label: 'Smaller city', mult: 0.84 },
        { value: 'metro', label: 'Capital', mult: 1.45 },
      ],
    },
    {
      id: 'programme',
      label: 'Programme type',
      options: [
        { value: 'taught', label: 'Taught', tuitionMin: 0, tuitionMax: 3000 },
      ],
    },
  ],
};

describe('calculator configuration', () => {
  it('accepts a whole document and returns it normalised', () => {
    const parsed = parseCalculatorConfig(valid);
    expect(parsed?.base.livingMin).toBe(850);
    expect(parsed?.factors).toHaveLength(2);
    expect(parsed?.factors[0].options[0].mult).toBe(0.84);
  });

  it.each([
    ['no document at all', null],
    ['an array', []],
    ['a string', 'calculator'],
    ['no base costs', { factors: valid.factors }],
    ['no factors', { base: valid.base }],
    ['an empty factor list', { ...valid, factors: [] }],
  ])('refuses %s', (_label, input) => {
    expect(parseCalculatorConfig(input)).toBeNull();
  });

  it('refuses a living range that runs backwards', () => {
    expect(
      parseCalculatorConfig({
        ...valid,
        base: { ...valid.base, livingMin: 2000, livingMax: 500 },
      }),
    ).toBeNull();
  });

  it('refuses a tuition band that runs backwards', () => {
    expect(
      parseCalculatorConfig({
        ...valid,
        factors: [
          {
            id: 'programme',
            label: 'Programme',
            options: [
              { value: 'a', label: 'A', tuitionMin: 9000, tuitionMax: 1000 },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it('refuses a multiplier that is a typo rather than a lifestyle', () => {
    for (const mult of [0, 0.01, 50, -1]) {
      expect(
        parseCalculatorConfig({
          ...valid,
          factors: [
            {
              id: 'x',
              label: 'X',
              options: [{ value: 'a', label: 'A', mult }],
            },
          ],
        }),
      ).toBeNull();
    }
  });

  it('refuses duplicate factor ids, because one would silently win', () => {
    expect(
      parseCalculatorConfig({
        ...valid,
        factors: [valid.factors[0], { ...valid.factors[0] }],
      }),
    ).toBeNull();
  });

  it('refuses duplicate option values within a factor', () => {
    expect(
      parseCalculatorConfig({
        ...valid,
        factors: [
          {
            id: 'city',
            label: 'Location',
            options: [
              { value: 'small', label: 'One', mult: 1 },
              { value: 'small', label: 'Two', mult: 1.2 },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it('refuses markup in a label, which is rendered as text', () => {
    expect(
      parseCalculatorConfig({
        ...valid,
        factors: [
          {
            id: 'city',
            label: '<script>alert(1)</script>',
            options: [{ value: 'a', label: 'A', mult: 1 }],
          },
        ],
      }),
    ).toBeNull();
  });

  it('refuses a figure outside anything a student could be quoted', () => {
    expect(
      parseCalculatorConfig({
        ...valid,
        base: { ...valid.base, livingMin: 99_000_000, livingMax: 99_000_001 },
      }),
    ).toBeNull();
  });
});
