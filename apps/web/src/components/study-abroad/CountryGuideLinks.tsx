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
  /* The sentence under the heading names what the guide holds, so it is
     built from the same list as the links below it. Written as a fixed line
     it promised costs, intakes and the visa on a destination whose guide
     had none of the three. */
  const has = (key: string) => links.some((link) => link.key === key);
  const named = [
    has('cost') ? 'costs' : null,
    has('intakes') ? 'intakes' : null,
    has('work-visa') ? 'what the visa allows' : null,
  ].filter((part): part is string => Boolean(part));
  const list =
    named.length > 1
      ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
      : (named[0] ?? '');
  const lead = named.length
    ? `${list[0].toUpperCase()}${list.slice(1)} ${named.length === 1 && named[0] === 'what the visa allows' ? 'is' : 'are'} the same whichever subject you choose. ${named.length === 1 && named[0] === 'what the visa allows' ? 'It is' : 'They are'} in the guide to ${where}.`
    : `What does not change with the subject is in the guide to ${where}.`;
  return (
    <section className="sec wrap" id="country-guide">
      <div className="sec-head left row-between">
        <div>
          <span className="eyebrow">The destination</span>
          <h2 className="sec-title">Plan your studies in {where}</h2>
          <p className="sec-lead">{lead}</p>
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
