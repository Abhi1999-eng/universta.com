import Link from 'next/link';
import type { ScholarshipCard } from '@/lib/scholarship-card';

/**
 * The funding card the reference build specified.
 *
 * Its stylesheet was ported with everything else -- `fundbadge`, `flagchip`,
 * `schcard__name`, `__provider`, `__where`, `__facts`, `__foot` -- and then
 * nothing used it. The guides each wrote a title and a link into a `schcard`
 * and invented `schcard__t`, a class the stylesheet has never defined, so
 * the heading rendered unstyled as well as uninformative.
 *
 * This is that card, rendering what a scholarship actually records: what it
 * is worth, who publishes it, where it applies, when it closes and who it is
 * open to. A line the record does not hold is left out rather than filled
 * with a dash.
 */
export function ScholarshipCards({
  scholarships,
  columns = 3,
  /** Where the surrounding page already states the destination, repeating it
   *  on every card is noise rather than information. */
  showCountries = true,
}: {
  scholarships: ScholarshipCard[];
  columns?: 2 | 3;
  showCountries?: boolean;
}) {
  if (!scholarships.length) return null;
  return (
    <div className={`schgrid${columns === 3 ? ' schgrid--3' : ''}`}>
      {scholarships.map((scholarship) => {
        const countries = showCountries ? scholarship.countries : [];
        const facts = [
          scholarship.award ? { label: 'Award', value: scholarship.award } : null,
          scholarship.deadline
            ? { label: 'Deadline', value: scholarship.deadline }
            : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>;
        return (
          <article className="schcard" key={scholarship.id}>
            <div className="schcard__top">
              {scholarship.benefit ? (
                <span className="fundbadge">{scholarship.benefit}</span>
              ) : (
                <span className="badge badge--neutral">Scholarship</span>
              )}
            </div>
            <h3 className="schcard__name">
              <Link href={`/scholarships/${scholarship.slug}`}>
                {scholarship.title}
              </Link>
            </h3>
            {scholarship.provider ? (
              <p className="schcard__provider">
                <span className="label">Offered by</span>
                {scholarship.provider}
              </p>
            ) : null}
            {scholarship.summary ? (
              <p className="schcard__note">{scholarship.summary}</p>
            ) : null}
            {countries.length ? (
              <div className="schcard__where">
                {countries.slice(0, 4).map((country) => (
                  <span className="flagchip" key={country.slug || country.name}>
                    {country.iso2 ? (
                      <span className="flagchip__code">{country.iso2}</span>
                    ) : null}
                    {country.name}
                  </span>
                ))}
                {countries.length > 4 ? (
                  <span className="flagchip">
                    +{countries.length - 4} more
                  </span>
                ) : null}
              </div>
            ) : null}
            {facts.length ? (
              <dl className="schcard__facts">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {scholarship.eligibility ? (
              <p className="schcard__note">
                <span className="label">Eligibility</span>{' '}
                {scholarship.eligibility}
              </p>
            ) : null}
            <div className="schcard__foot">
              <Link
                className="linkcta"
                href={`/scholarships/${scholarship.slug}`}
              >
                View award{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/**
 * The line under a funding heading that says what the list is and is not.
 *
 * An award a student matches on paper is still an award a provider chooses,
 * and the home page already says so. Every funding section repeats it,
 * because a reader arriving straight at a country or a course has not seen
 * the home page.
 */
export const FUNDING_CAVEAT =
  'Eligibility is shown as the provider published it. Meeting it is not a guarantee of an award.';
