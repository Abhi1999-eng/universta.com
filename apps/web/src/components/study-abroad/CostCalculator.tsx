'use client';

import { useMemo, useState } from 'react';
import { useStudyAbroadShell } from './StudyAbroadShell';

/**
 * The budget calculator from the approved design.
 *
 * Every number it works from is configuration, not code: the factors and their
 * effects come from the country's own calculator document, so there is no
 * per-country branch here and adding a destination needs no change to this
 * file. A country without a configuration does not render a calculator at all
 * rather than one filled with plausible-looking defaults.
 *
 * The result is an estimate and says so. It is never stored.
 */

export type CalculatorOption = {
  value: string;
  label: string;
  mult?: number;
  tuitionMin?: number;
  tuitionMax?: number;
  note?: string;
};
export type CalculatorFactor = { id: string; label: string; options: CalculatorOption[] };
export type CalculatorConfig = {
  base: { livingMin: number; livingMax: number; insurance: number; semesterFee: number };
  factors: CalculatorFactor[];
};

function useMoney(symbol: string) {
  return useMemo(
    () =>
      (value: number) => {
        /* Rounded to the nearest hundred: the inputs are ranges and bands, and
           a figure to the pound would imply a precision this cannot have. */
        const rounded = Math.round(value / 100) * 100;
        return `${symbol}${rounded.toLocaleString('en-US')}`;
      },
    [symbol],
  );
}

export function CostCalculator({
  config,
  currencySymbol,
  countryName,
  countrySlug,
  disclaimer,
}: {
  config: CalculatorConfig;
  currencySymbol: string;
  countryName: string;
  countrySlug: string;
  disclaimer?: string | null;
}) {
  const { openAssessment } = useStudyAbroadShell();
  const money = useMoney(currencySymbol);

  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(config.factors.map((factor) => [factor.id, factor.options[0].value])),
  );

  const result = useMemo(() => {
    let livingMult = 1;
    let tuitionMin = 0;
    let tuitionMax = 0;
    for (const factor of config.factors) {
      const chosen = factor.options.find((option) => option.value === choice[factor.id]);
      if (!chosen) continue;
      if (typeof chosen.mult === 'number') livingMult *= chosen.mult;
      if (typeof chosen.tuitionMin === 'number') tuitionMin += chosen.tuitionMin;
      if (typeof chosen.tuitionMax === 'number') tuitionMax += chosen.tuitionMax;
    }
    const { livingMin, livingMax, insurance, semesterFee } = config.base;
    const yearlyLivingMin = (livingMin * 12 + insurance * 12) * livingMult;
    const yearlyLivingMax = (livingMax * 12 + insurance * 12) * livingMult;
    const feesMin = tuitionMin + semesterFee * 2;
    const feesMax = tuitionMax + semesterFee * 2;
    return {
      livingMin: yearlyLivingMin,
      livingMax: yearlyLivingMax,
      feesMin,
      feesMax,
      totalMin: yearlyLivingMin + feesMin,
      totalMax: yearlyLivingMax + feesMax,
    };
  }, [choice, config]);

  return (
    <div className="calc" data-testid="cost-calculator">
      <div className="calc__head">
        <div>
          <div className="calc__title">Estimate your {countryName} budget</div>
        </div>
        <button
          className="linkcta"
          type="button"
          onClick={() => openAssessment({ countrySlug, countryName, intent: 'budget' })}
        >
          Get a costed plan{' '}
          <span className="linkcta__arrow" aria-hidden="true">
            &rarr;
          </span>
        </button>
      </div>

      <div className="calc__body">
        <div className="calc__factors">
          {config.factors.map((factor) => (
            <div className="calc__f" key={factor.id}>
              <label id={`calcf-${factor.id}`}>{factor.label}</label>
              <div
                className="calc__seg"
                role="group"
                aria-labelledby={`calcf-${factor.id}`}
                data-factor={factor.id}
              >
                {factor.options.map((option) => (
                  <button
                    className="calc__opt"
                    type="button"
                    key={option.value}
                    aria-pressed={choice[factor.id] === option.value}
                    onClick={() =>
                      setChoice((current) => ({ ...current, [factor.id]: option.value }))
                    }
                  >
                    {option.label}
                    {option.note ? <small>{option.note}</small> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="calc__out" aria-live="polite">
          <div className="calc__out-l">Estimated annual budget</div>
          <div className="calc__out-v" data-testid="calc-total">
            {money(result.totalMin)} – {money(result.totalMax)}
          </div>
          <div className="calc__split">
            <span>
              Living{' '}
              <b data-testid="calc-living">
                {money(result.livingMin)} – {money(result.livingMax)}
              </b>
            </span>
            <span>
              Fees{' '}
              <b data-testid="calc-tuition">
                {money(result.feesMin)} – {money(result.feesMax)}
              </b>
            </span>
          </div>
        </div>
      </div>

      <div className="calc__foot">
        {disclaimer
          ? disclaimer.replace(/<[^>]+>/g, '')
          : `An estimate for planning, not a quote. Costs vary by university, city and subject — confirm current figures with the university and the relevant official authority before you plan your finances.`}
      </div>
    </div>
  );
}
