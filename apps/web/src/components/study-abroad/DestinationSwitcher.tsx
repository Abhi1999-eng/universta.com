'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FlagMark } from './FlagMark';
import { switcherClass } from './switcher';

export type SwitcherCountry = {
  id: string;
  name: string;
  slug: string;
  iso2Code?: string | null;
};

/** How many chips the band opens with. */
export const DESTINATIONS_SHOWN = 6;

/**
 * The destinations a subject or specialization is taught in.
 *
 * Every country that lists it belongs here, and on this catalogue that is
 * two hundred of them -- a wall of chips that buries whatever follows the
 * band. It opens on six and says how many more there are, in the same ghost
 * button the home page uses to reach the full directory, and expands in
 * place rather than sending the reader somewhere else: the ones already on
 * screen stay where they were.
 */
export function DestinationSwitcher({
  countries,
  label,
}: {
  countries: SwitcherCountry[];
  /** What the band is about, for the button and for a screen reader. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const hidden = countries.length - DESTINATIONS_SHOWN;
  const shown = open ? countries : countries.slice(0, DESTINATIONS_SHOWN);

  return (
    <>
      <div className={switcherClass(shown.length)}>
        {shown.map((country) => (
          <Link
            key={country.id}
            className="switcher__item"
            href={`/study-abroad/${country.slug}`}
          >
            <FlagMark iso2Code={country.iso2Code ?? null} bands={null} />
            <span className="cchip__name">{country.name}</span>
            <span className="switcher__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        ))}
      </div>
      {hidden > 0 ? (
        <p className="h-more h-more--center">
          <button
            className="btn btn--ghost"
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <>Show fewer destinations</>
            ) : (
              <>
                Show all {countries.length} destinations for {label}
              </>
            )}{' '}
            <span className="btn__arrow" aria-hidden="true">
              {open ? <>&uarr;</> : <>&darr;</>}
            </span>
          </button>
        </p>
      ) : null}
    </>
  );
}
