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
  within,
}: {
  countries: SwitcherCountry[];
  /** What the band is about, for the button and for a screen reader. */
  label: string;
  /**
   * The subject, or `subject/specialization`, this band is on the page of.
   *
   * A reader on the Engineering page who picks the United Kingdom has asked
   * about Engineering in the United Kingdom, and there is a page for exactly
   * that. The chip used to open the country's general guide instead, where
   * the subject they came from was one card among thirty. A path rather
   * than a function, because this is a client component and a function does
   * not cross that boundary.
   */
  within?: string;
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
            href={
              within
                ? `/study-abroad/${country.slug}/${within}`
                : `/study-abroad/${country.slug}`
            }
            /* The chip shows the country alone; what it opens is the
               subject there, and a name on its own no longer says so. */
            aria-label={within ? `${label} in ${country.name}` : undefined}
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
