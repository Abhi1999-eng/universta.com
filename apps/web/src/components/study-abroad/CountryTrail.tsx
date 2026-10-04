import Link from 'next/link';
import { FlagMark } from './FlagMark';

/**
 * The line under a heading that says what the page is made of, as links:
 *
 *     [flag] United Kingdom · Energy, Oil & Gas
 *
 * A page about a subject in a country is the meeting of two things, and a
 * reader who arrived through one of them should be able to leave through
 * the other. The breadcrumb above the heading is the way *up*; this is the
 * way *across* -- the country's own guide, the subject's own page -- and it
 * is set large and dark enough to be read as part of the heading rather
 * than as a caption to it.
 *
 * It used to be a 14px grey eyebrow whose links looked like the text around
 * them. Nobody found them.
 *
 * The last part is a link when it leads somewhere other than the page being
 * read, and plain text when it is that page.
 */
export type TrailPart = {
  label: string;
  /** Omitted for the page being read. */
  href?: string;
};

export function CountryTrail({
  country,
  parts = [],
  /** False on the country's own pages, where its name is where you are. */
  linkCountry = true,
}: {
  country: { name: string; slug: string; iso2Code?: string | null };
  parts?: TrailPart[];
  linkCountry?: boolean;
}) {
  const flag = <FlagMark iso2Code={country.iso2Code ?? null} bands={null} />;
  /* The dot belongs to the part before it. On a narrow screen the line
     wraps, and a dot that opens the next line reads as a bullet for a list
     that is not one. */
  const dot = (
    <span className="trail__dot" aria-hidden="true">
      ·
    </span>
  );
  return (
    <p className="trail">
      <span className="trail__step">
        {linkCountry ? (
          <Link
            className="trail__part trail__part--country"
            href={`/study-abroad/${country.slug}`}
          >
            {flag}
            <span>{country.name}</span>
          </Link>
        ) : (
          <span className="trail__part trail__part--country">
            {flag}
            <span>{country.name}</span>
          </span>
        )}
        {parts.length ? dot : null}
      </span>
      {parts.map((part, index) => (
        <span className="trail__step" key={`${part.label}-${part.href ?? ''}`}>
          {part.href ? (
            <Link className="trail__part" href={part.href}>
              {part.label}
            </Link>
          ) : (
            <span className="trail__part" aria-current="page">
              {part.label}
            </span>
          )}
          {index < parts.length - 1 ? dot : null}
        </span>
      ))}
    </p>
  );
}
