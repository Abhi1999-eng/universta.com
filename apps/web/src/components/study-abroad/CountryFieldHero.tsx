import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import type { Media } from '@/lib/catalog';
import type { Figure } from '@/lib/country-subject';
import { FlagMark } from './FlagMark';

/**
 * The head of a field's page in one destination -- a subject in the United
 * Kingdom, or one of its specializations there -- drawn the way the design
 * draws it: the field's tile beside the heading, the destination's flag in
 * the eyebrow with what kind of page this is, then a strip of figures and
 * the specializations taught there.
 *
 * The pages had the heading alone, so a subject in a country looked like a
 * plain listing rather than the subject page it is narrowed from.
 */
export function CountryFieldHero({
  country,
  icon,
  kind,
  detail,
  fallbackIconPath,
  children,
}: {
  country: { iso2Code?: string | null };
  /** The field's own icon. Without one the tile carries the generic mark
   *  the subject and specialization pages use. */
  icon: Media | null;
  kind: 'Subject' | 'Specialization';
  /** A matching design glyph when no catalogue image has been uploaded. */
  fallbackIconPath?: string;
  /** After the dot: "12 specializations", "within Computer Science". */
  detail?: ReactNode;
  /** The heading, the trail and whatever follows them in the column. */
  children: ReactNode;
}) {
  return (
    <div className="subjhero fieldhero">
      <span className="subjhero__icon" aria-hidden="true">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon.url} alt="" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d={fallbackIconPath ?? "M4 5h16v14H4z M4 9h16"} />
          </svg>
        )}
      </span>
      <div>
        <p className="hero__eyebrow fieldhero__eyebrow">
          <FlagMark iso2Code={country.iso2Code ?? null} bands={null} />
          {kind}
          {detail ? (
            <>
              <b>·</b>
              {detail}
            </>
          ) : null}
        </p>
        {children}
      </div>
    </div>
  );
}

/** The design's figures strip. Only the figures this destination has: a
 *  strip of zeros says less than a shorter strip does. */
export function FiguresStrip({ figures }: { figures: Figure[] }) {
  if (!figures.length) return null;
  return (
    <div className={`statstrip statstrip--field statstrip--n${figures.length}`}>
      {figures.map((figure) => (
        <div key={figure.label}>
          <b className={/^[\d,]+$/.test(figure.value) ? 'datum' : undefined}>
            {figure.value}
          </b>
          <span>{figure.label}</span>
        </div>
      ))}
    </div>
  );
}

/** How many universities the "nothing listed" callout names before "and N more". */
const NAMED_IN_CALLOUT = 3;

/**
 * What a field's page in one destination says where the catalogue lists
 * nothing there: the design's callout, then the ways on.
 *
 * The courses band used to vanish, and a reader could not tell "none
 * listed" from "not loaded". The sentence is about Universta's catalogue,
 * not about the country's universities, because that is all the page knows.
 *
 * Except where the page does know of universities here that teach it: the
 * course list counts what has been filed under the destination, and a
 * university's own programmes can be published before that is done. The
 * callout said "no Law course in the United Kingdom is listed" above three
 * UK universities whose pages list Law degrees, so then it names them.
 */
export function NothingListedHere({
  field,
  where,
  links,
  teaching,
}: {
  field: string;
  where: string;
  links: Array<{ href: string; label: string }>;
  /** The universities here with a published programme in the field. */
  teaching?: { total: number; items: Array<{ id: string; name: string; href: string }> };
}) {
  const named = teaching?.total ? teaching.items.slice(0, NAMED_IN_CALLOUT) : [];
  const unnamed = named.length ? Math.max(teaching!.total - named.length, 0) : 0;
  return (
    <>
      <div className="callout fieldnone">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M11 12h1v4h1" />
        </svg>
        {named.length ? (
          <span>
            {`No ${field} course in ${where} is in the course search yet, but ${teaching!.total.toLocaleString('en-GB')} ${teaching!.total === 1 ? 'university here teaches' : 'universities here teach'} it: `}
            {named.map((item, index) => (
              <Fragment key={item.id}>
                {index ? (index === named.length - 1 && !unnamed ? ' and ' : ', ') : null}
                <Link className="textlink" href={item.href}>
                  {item.name}
                </Link>
              </Fragment>
            ))}
            {unnamed ? `, and ${unnamed.toLocaleString('en-GB')} more` : null}
            {`. ${named.length === 1 && !unnamed ? 'Its page lists' : 'Each one’s page lists'} what it teaches.`}
          </span>
        ) : (
          <span>
            No {field} course in {where} is listed on Universta yet. That
            reflects our catalogue, not what {where} offers.
          </span>
        )}
      </div>
      {links.length ? (
        <div className="btn-row fieldnone__links">
          {links.map((link) => (
            <Link className="linkcta" href={link.href} key={link.href}>
              {link.label}{' '}
              <span className="linkcta__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** The specializations taught here, each with this destination's count and
 *  each opening on itself in this destination. */
export function SpecializationChips({
  chips,
  label = 'Specializations taught here',
}: {
  chips: Array<{ id: string; name: string; href: string; count?: number }>;
  label?: string;
}) {
  if (!chips.length) return null;
  return (
    <div className="specchips">
      <span className="label">{label}</span>
      <div className="specchips__row">
        {chips.map((chip) => (
          <Link className={chip.count ? 'specchip specchip--live' : 'specchip'} href={chip.href} key={chip.id}>
            {chip.name}
            {chip.count !== undefined ? <em>{chip.count.toLocaleString('en-GB')}</em> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
