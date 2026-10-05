import Link from 'next/link';
import type { ConsultantPresence } from '@/lib/countries';
import { inCountry } from '@/lib/country-article';
import { countryConsultantsHref } from '@/lib/country-consultant-list';
import { cityKey } from '@/lib/university-list';

/**
 * The people a student could ask, at the end of a guide that has so far only
 * offered the assessment.
 *
 * Everything above this is Universta answering. A reader who would rather ask
 * somebody is sent to the destination's own consultants page -- the one the
 * behaviour reference's "View all consultants" opens -- with the city they
 * picked already ticked. It used to send them to the worldwide directory in
 * the older design, where the destination was one filter among many.
 *
 * The cities are counted from the consultants already recorded against this
 * destination rather than curated again here, so the row can never offer a
 * city the list then shows as empty.
 */
export function CountryConsultants({
  countryName,
  countrySlug,
  iso2Code = null,
  presence,
  alt,
  heading,
}: {
  countryName: string;
  countrySlug: string;
  /** For "the United Kingdom" over "United Kingdom" in a sentence; the name
   *  is enough for the common cases without it. */
  iso2Code?: string | null;
  presence: ConsultantPresence | undefined;
  alt: boolean;
  /** The band's question, when the page is about something narrower than
   *  the destination: "Need help applying to the University of Oxford?" */
  heading?: string;
}) {
  if (!presence?.total) return null;
  const all = countryConsultantsHref(countrySlug);
  const where = inCountry(countryName, iso2Code);

  return (
    <section
      className={`sec ${alt ? 'sec--paper' : 'sec--white'} sec--tight`}
      id="consultants"
    >
      <div className="wrap">
        <div className="consultcta">
          <div className="consultcta__copy">
            <p className="eyebrow eyebrow--plain">Consultants</p>
            <h2 className="consultcta__t">
              {heading ?? `Need help applying to ${where}?`}
            </h2>
            <p className="consultcta__d">
              {presence.total === 1
                ? `One consultant on Universta supports students planning to study in ${where}.`
                : `${presence.total} consultants on Universta support students planning to study in ${where}.`}{' '}
              Compare them, then request guidance through Universta.
            </p>
            {presence.cities.length ? (
              <p className="citychips">
                <span className="label">Near you</span>
                {presence.cities.map((entry) => (
                  <Link
                    className="specchip"
                    key={entry.city}
                    href={`${all}?city=${encodeURIComponent(cityKey(entry.city))}#consultants`}
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
              View all consultants{' '}
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
