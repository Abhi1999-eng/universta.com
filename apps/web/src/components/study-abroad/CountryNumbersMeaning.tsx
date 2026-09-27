'use client';

import { useId, useState } from 'react';
import type { CountryFigure } from './CountryLinkSections';
import { SectionHead } from './SectionHead';

/**
 * What the figures on the band above actually mean.
 *
 * The band states a country's numbers and then leaves a reader to work out
 * what to do with them. "48" is the work-hour limit, "2" is the number of
 * intakes -- neither says which shortlist it rules out or which deadline it
 * sets. This section opens each one and says where it comes from and, as
 * often as not, what it does not say.
 *
 * Every line is derived from the same published data as the figure itself,
 * so a country an editor has just filled in gets the same explanations as
 * one curated by hand, and none of them can drift out of date separately
 * from the number they explain.
 */
export function CountryNumbersMeaning({
  figures,
  countryName,
  n = null,
  alt,
}: {
  figures: CountryFigure[];
  countryName: string;
  n?: string | null;
  alt: boolean;
}) {
  const base = useId().replace(/:/g, '');
  const [open, setOpen] = useState<string | null>(null);
  if (figures.length < 2) return null;

  return (
    <section className={`sec ${alt ? 'sec--paper' : 'sec--white'}`} id="numbers-meaning">
      <div className="wrap">
        <SectionHead
          n={n}
          eyebrow="Interpretation"
          title="What these figures mean for you"
          lead={`A number on its own decides nothing. Open any figure to see how it changes your shortlist, your budget or your timeline in ${countryName}.`}
        />
        <div className="meanings">
          {figures.map((figure) => {
            const expanded = open === figure.label;
            return (
              <div className="meaning" key={figure.label}>
                <button
                  className="meaning__btn"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`${base}-${figure.label.replace(/\W+/g, '')}`}
                  onClick={() => setOpen(expanded ? null : figure.label)}
                >
                  <span className="meaning__v datum">{figure.value}</span>
                  <span>
                    <span className="meaning__l">{figure.label}</span>
                    <span className="meaning__q">What does this mean?</span>
                  </span>
                  <span className="meaning__plus" aria-hidden="true">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
                {/* The design shows a body by data-open on the body itself. */}
                <div
                  className="meaning__body"
                  id={`${base}-${figure.label.replace(/\W+/g, '')}`}
                  role="region"
                  data-open={String(expanded)}
                  hidden={!expanded}
                >
                  <p>{figure.meaning}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
