import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatNumber } from '@/lib/format';
import type {
  CourseFilters,
  CourseScope,
  ProgrammeList,
} from '@/lib/university-courses';
import { CompareTray } from './CourseCompare';
import { ProgrammeResults } from './ProgrammeResults';

/**
 * A field's programmes in one destination, as the design's course listing
 * draws them under its hero: the search, the filter panel, the sort, the
 * programme cards and "Load more", fixed to the country and the field the
 * page is about.
 *
 * The behaviour reference has no such list on these pages; the design does,
 * and the catalogue's level groups stay below it, so the page gains the
 * programmes and loses nothing. Fixed to its part of the catalogue, the
 * block counts its options and its total over that part, and the panel
 * never offers the country or the field the address already names.
 *
 * Where nothing is listed here -- every destination, while the catalogue
 * holds no programmes -- the section is not drawn at all, and the page
 * reads as it did.
 */
export function DestinationProgrammes({
  base,
  scope,
  filters,
  list,
  title,
  where,
  searchHref,
  empty,
  compact = false,
}: {
  /** The page's own address, which the block's links keep to. */
  base: string;
  scope: CourseScope;
  filters: CourseFilters;
  list: ProgrammeList;
  title: string;
  /** "in the United Kingdom", for the empty sentence. */
  where: string;
  /** The finder, narrowed the same way. */
  searchHref: string;
  empty?: ReactNode;
  /** ZIP country-subject layout: the finder follows the hero directly. */
  compact?: boolean;
}) {
  const total = list.summary.programmes;
  const universities = list.summary.universities;
  const content = (
    <>
      {compact ? <h2 className="sr-only">{title}</h2> : (
        <div className="sec-head left row-between">
          <div>
            <span className="eyebrow">Programmes</span>
            <h2 className="sec-title">{title}</h2>
            <p className="sec-lead">
              {`${formatNumber(total)} ${total === 1 ? 'programme' : 'programmes'}${
                universities
                  ? ` at ${formatNumber(universities)} ${universities === 1 ? 'university' : 'universities'}`
                  : ''
              }, each as the university teaches it: its own fees, intakes and entry requirements.`}
            </p>
          </div>
          <Link className="linkcta" href={searchHref}>
            Open in search{' '}
            <span className="linkcta__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
      )}
      <ProgrammeResults
        base={base}
        scope={scope}
        filters={filters}
        facets={list.facets}
        cards={list.cards}
        meta={list.meta}
        catalogueTotal={total}
        where={where}
        empty={empty}
        idPrefix="dest"
      />
      {compact ? (
        <div className="destination-programmes__search">
          <Link className="linkcta" href={searchHref}>
            Open in search <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      ) : null}
      <CompareTray />
    </>
  );
  return compact ? (
    <section className="sec sec--white sec--tight" id="courses">
      <div className="wrap">{content}</div>
    </section>
  ) : (
    <section className="sec sec--tight wrap" id="courses">{content}</section>
  );
}
