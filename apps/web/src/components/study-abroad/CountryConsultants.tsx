import Link from 'next/link';
import type { ConsultantPresence } from '@/lib/countries';

/**
 * The people a student could ask, at the end of a guide that has so far only
 * offered the assessment.
 *
 * Everything above this is Universta answering. A reader who would rather ask
 * somebody had nowhere to go but the site-wide directory, where the
 * destination they have just spent ten minutes reading about is one filter
 * among many. This carries the filter with them.
 *
 * The cities are counted from the consultants already recorded against this
 * destination rather than curated again here, so the row can never offer a
 * city the directory then shows as empty.
 */
export function CountryConsultants({
  countryName,
  countrySlug,
  presence,
  alt,
}: {
  countryName: string;
  countrySlug: string;
  presence: ConsultantPresence | undefined;
  alt: boolean;
}) {
  if (!presence?.total) return null;
  const all = `/study-abroad-consultants?country=${encodeURIComponent(countrySlug)}`;

  return (
    <section
      className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight`}
      id="consultants"
    >
      <div className="wrap">
        <div className="consultcta">
          <div className="consultcta__copy">
            <p className="eyebrow eyebrow--plain">Consultants</p>
            <h2 className="consultcta__t">Need help applying to {countryName}?</h2>
            <p className="consultcta__d">
              {presence.total === 1
                ? `One consultant on Universta supports students planning to study in ${countryName}.`
                : `${presence.total} consultants on Universta support students planning to study in ${countryName}.`}{' '}
              Compare them, then request guidance through Universta.
            </p>
            {presence.cities.length ? (
              <p className="citychips">
                <span className="label">Near you</span>
                {presence.cities.map((entry) => (
                  <Link
                    className="specchip"
                    key={entry.city}
                    href={`${all}&city=${encodeURIComponent(entry.city)}`}
                  >
                    {entry.city}
                    <em>{entry.count}</em>
                  </Link>
                ))}
              </p>
            ) : null}
          </div>
          <div className="consultcta__actions">
            <Link className="btn" href={all}>
              Find {countryName} consultants{' '}
              <span className="btn__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
