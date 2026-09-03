import { parseApplicationFee, parseVisaFee } from './country-bulk';

/**
 * Two client columns each carry two stored values. Both used to be read with
 * `Number(...)`, so a range or a currency-qualified amount parsed as NaN and
 * was dropped without a word. These pin down what each cell accepts, what it
 * rejects, and that a rejection is always reported rather than swallowed.
 */
describe('country bulk fee columns', () => {
  const collect = () => [] as string[];

  describe('application_fee', () => {
    it('reads a single amount as both bounds', () => {
      const errors = collect();
      expect(parseApplicationFee('60', errors)).toEqual({
        min: '60',
        max: '60',
      });
      expect(errors).toEqual([]);
    });

    it('reads a range as its two bounds', () => {
      const errors = collect();
      expect(parseApplicationFee('60-120', errors)).toEqual({
        min: '60',
        max: '120',
      });
      expect(errors).toEqual([]);
    });

    it('tolerates spaces around the dash', () => {
      const errors = collect();
      expect(parseApplicationFee('  60 - 120 ', errors)).toEqual({
        min: '60',
        max: '120',
      });
      expect(errors).toEqual([]);
    });

    it('reads decimals', () => {
      const errors = collect();
      expect(parseApplicationFee('60.50-120.75', errors)).toEqual({
        min: '60.50',
        max: '120.75',
      });
      expect(errors).toEqual([]);
    });

    it('leaves an absent cell alone and clears on the clear token', () => {
      const errors = collect();
      expect(parseApplicationFee(undefined, errors)).toEqual({});
      expect(parseApplicationFee('', errors)).toEqual({});
      expect(parseApplicationFee('__CLEAR__', errors)).toEqual({
        min: null,
        max: null,
      });
      expect(errors).toEqual([]);
    });

    it.each([
      ['abc', 'not a number'],
      ['60-', 'missing upper bound'],
      ['-120', 'missing lower bound'],
      ['60-120-150', 'three parts'],
      ['60 120', 'no separator'],
    ])('reports "%s" (%s) rather than dropping it', (input) => {
      const errors = collect();
      expect(parseApplicationFee(input, errors)).toEqual({});
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('application_fee');
    });

    it('reports a minimum above its maximum', () => {
      const errors = collect();
      expect(parseApplicationFee('120-60', errors)).toEqual({});
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('greater than its maximum');
    });
  });

  describe('visa_fee', () => {
    it('reads a bare amount and leaves the stored currency untouched', () => {
      const errors = collect();
      const parsed = parseVisaFee('185', errors);
      expect(parsed.fee).toBe('185');
      // Undefined, not null: an update must not blank a currency it was not given.
      expect(parsed.currency).toBeUndefined();
      expect(errors).toEqual([]);
    });

    it('reads a currency-qualified amount as both values', () => {
      const errors = collect();
      expect(parseVisaFee('USD 185', errors)).toEqual({
        fee: '185',
        currency: 'USD',
      });
      expect(parseVisaFee('gbp 490', errors)).toEqual({
        fee: '490',
        currency: 'GBP',
      });
      expect(parseVisaFee('EUR 75.50', errors)).toEqual({
        fee: '75.50',
        currency: 'EUR',
      });
      expect(errors).toEqual([]);
    });

    it('leaves an absent cell alone and clears both on the clear token', () => {
      const errors = collect();
      expect(parseVisaFee(undefined, errors)).toEqual({});
      expect(parseVisaFee('__CLEAR__', errors)).toEqual({
        fee: null,
        currency: null,
      });
      expect(errors).toEqual([]);
    });

    it.each(['USD', 'USD abc', 'US 185', 'USD 185 EUR', 'abc'])(
      'reports "%s" rather than losing the amount or currency',
      (input) => {
        const errors = collect();
        expect(parseVisaFee(input, errors)).toEqual({});
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('visa_fee');
      },
    );
  });
});
