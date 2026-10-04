import Link from 'next/link';
import type { GuideLink } from '@/lib/study-abroad-view';

/**
 * "Plan your studies in the United Kingdom" -- the way from a page about one
 * subject back into the country it is being studied in.
 *
 * A reader choosing Energy in the United Kingdom is choosing the United
 * Kingdom as well: what it costs, when the intakes are, what the visa
 * allows. This page does not know those things and should not repeat them.
 * The destination's guide does, and until now the only way to it from here
 * was a single button to its top.
 *
 * Each link opens the part of the guide it names. The list comes from
 * `guideLinks`, which offers a part only when the guide actually has it.
 */
export function CountryGuideLinks({
  countrySlug,
  where,
  links,
}: {
  countrySlug: string;
  /** "the United Kingdom", "Germany". */
  where: string;
  links: GuideLink[];
}) {
  if (!links.length) return null;
  return (
    <section className="sec wrap" id="country-guide">
      <div className="sec-head left row-between">
        <div>
          <span className="eyebrow">The destination</span>
          <h2 className="sec-title">Plan your studies in {where}</h2>
          <p className="sec-lead">
            Costs, intakes and what the visa allows are the same whichever
            subject you choose. They are in the guide to {where}.
          </p>
        </div>
        <Link className="linkcta" href={`/study-abroad/${countrySlug}`}>
          Study in {where}{' '}
          <span className="linkcta__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
      </div>
      <div className="guidelinks">
        {links.map((link) => (
          <Link className="pill" href={link.href} key={link.key}>
            {link.label}
            <span className="pill__go" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
