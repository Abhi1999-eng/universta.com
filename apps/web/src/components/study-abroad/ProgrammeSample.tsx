import Link from 'next/link';
import type { OfferingCardData } from '@/lib/university-courses';
import { CompareTray } from './CourseCompare';
import { OfferingCard } from './OfferingCard';

/**
 * A handful of programmes on a page that is about something wider -- a
 * course guide, a subject, a specialization -- as the reference's subject
 * page shows its courses: the design's course cards, three to a row, each
 * naming the university that teaches it and leading to its page, then the
 * way to all of them in the finder.
 *
 * `rows` are more of the same part, named in a line each: on a course guide
 * a reader asking where the course is taught should be able to find every
 * university that does, not only the first six.
 *
 * The cards carry the compare tick, so the tray that collects them comes
 * with them.
 */
export function ProgrammeSample({
  cards,
  rows = [],
  rowsLabel,
  link,
  guideLinks = true,
}: {
  cards: OfferingCardData[];
  rows?: OfferingCardData[];
  /** What the line-a-programme list is headed with. */
  rowsLabel?: string;
  /** The finder, narrowed to the same part: "View all 136 programmes". */
  link: { href: string; label: string };
  /** Whether each card links its course guide; off on the guide itself. */
  guideLinks?: boolean;
}) {
  if (!cards.length) return null;
  return (
    <>
      <div className="coursegrid coursegrid--3">
        {cards.map((card) => (
          <OfferingCard
            key={card.slug}
            course={card}
            show="university"
            guideLink={guideLinks}
          />
        ))}
      </div>
      {rows.length ? (
        <div className="progsample__rows">
          {rowsLabel ? <p className="path__h">{rowsLabel}</p> : null}
          <div className="courselist">
            {rows.map((row) => (
              <Link className="courselist__row" href={row.href} key={row.slug}>
                <span className="courselist__name">{row.university.name}</span>
                <span className="courselist__meta">
                  {[row.university.location, row.level?.name]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {/* A missing fee is said, not left as a blank cell. */}
                <span
                  className={`courselist__fee${row.tuition ? ' datum' : ' uc-none'}`}
                >
                  {row.tuition ?? 'Fee not listed'}
                </span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <p className="h-more">
        <Link className="linkcta" href={link.href}>
          {link.label}{' '}
          <span className="linkcta__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
      </p>
      <CompareTray />
    </>
  );
}

/** "View all 136 programmes"; one is "View the programme". */
export function allProgrammes(verb: 'View' | 'See', total: number) {
  return total === 1
    ? `${verb} the programme`
    : `${verb} all ${total.toLocaleString('en-GB')} programmes`;
}
