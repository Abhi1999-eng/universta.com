'use client';

import {
  COURSE_SORTS,
  UNIVERSITY_COURSE_GROUPS,
  type CourseFacets,
  type CourseFilters,
  type OfferingCardData,
} from '@/lib/university-courses';
import { ProgrammeResults } from './ProgrammeResults';

/**
 * A university's courses: the programme results block fixed to one
 * university.
 *
 * The block is the one the course finder and the destination pages draw;
 * here it is pinned to the university, so its own filter never shows, and
 * it keeps what this list has always had -- its six filters, its five
 * orders (all of its fees are in one country's currency, so "Lowest
 * tuition" stays), cards that name the subject rather than repeat the
 * university, and its own route for "Load more".
 */

export type CourseResultsProps = {
  /** The list's own address, without a query. */
  base: string;
  universitySlug: string;
  universityName: string;
  filters: CourseFilters;
  facets: CourseFacets;
  cards: OfferingCardData[];
  /** `page` is how many pages of eighteen `cards` holds, from the first. */
  meta: { page: number; limit: number; total: number; totalPages: number };
  /** Every course the university publishes, filtered or not. */
  catalogueTotal: number;
};

export function UniversityCourseResults(props: CourseResultsProps) {
  return (
    <ProgrammeResults
      base={props.base}
      scope={{ university: [props.universitySlug] }}
      filters={props.filters}
      facets={props.facets}
      cards={props.cards}
      meta={props.meta}
      catalogueTotal={props.catalogueTotal}
      groups={UNIVERSITY_COURSE_GROUPS}
      sorts={COURSE_SORTS}
      endpoint="/api/university-courses"
      oneCurrency
      cardShows="subject"
      noun={{ one: 'course', many: 'courses' }}
      where={`at ${props.universityName}`}
      placeholder="Search by course, subject or level"
    />
  );
}
