import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * One search across the catalogue, answered while somebody types.
 *
 * The design's box says it searches "countries, courses, universities,
 * scholarships, exams" and it was wired to the course listing, because that
 * was the only listing a query could be handed to. So a student who typed
 * "Denmark" -- the most obvious thing to type on a study-abroad site -- was
 * shown the courses called Denmark, of which there are none.
 *
 * Results come back grouped by what they are rather than mixed by score.
 * "Computer Science" is a subject, a course and part of a hundred course
 * names, and a single ranked list buries the subject somewhere in the middle;
 * a reader scanning headed blocks finds it at once. The groups keep the order
 * below whatever the query is, so the same word always lands in the same
 * place on the page.
 */

export type SearchGroupType =
  'country' | 'subject' | 'course' | 'programme' | 'university' | 'scholarship';

export type SearchItem = {
  id: string;
  label: string;
  href: string;
  meta: string | null;
  iso2Code?: string | null;
};

export type SearchGroup = {
  type: SearchGroupType;
  label: string;
  items: SearchItem[];
  /** Everything of this kind, for a query with more than one page of them. */
  href: string;
};

export type SearchResults = {
  query: string;
  total: number;
  groups: SearchGroup[];
};

/* Two letters match half the catalogue and say nothing about what the reader
   wants; the dropdown stays shut until the third. */
const MIN_QUERY = 3;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, limit?: number): Promise<SearchResults> {
    const q = (query ?? '').trim();
    const take = Math.min(
      Math.max(Number(limit) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    if (q.length < MIN_QUERY) return { query: q, total: 0, groups: [] };

    const published = { status: 'PUBLISHED', deletedAt: null };
    /* Ask for more than a group shows: the rows that open with the query are
       the ones a reader means, and they are picked out below rather than in
       SQL, which cannot order by "starts with" portably. */
    const pool = take * 4;

    const now = new Date();
    const live = {
      ...published,
      AND: [
        { OR: [{ publishStartsAt: null }, { publishStartsAt: { lte: now } }] },
        { OR: [{ publishEndsAt: null }, { publishEndsAt: { gt: now } }] },
      ],
    };

    const [
      countries,
      subjects,
      courses,
      programmes,
      universities,
      scholarships,
    ] = await Promise.all([
      this.prisma.country.findMany({
        where: { ...published, name: { contains: q } },
        select: {
          id: true,
          name: true,
          slug: true,
          iso2Code: true,
          continent: { select: { name: true } },
        },
        orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
        take: pool,
      }),
      this.prisma.subject.findMany({
        where: { ...published, name: { contains: q } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
        take: pool,
      }),
      this.prisma.course.findMany({
        where: { ...published, name: { contains: q } },
        select: {
          id: true,
          name: true,
          slug: true,
          subject: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
        take: pool,
      }),
      /* A programme is a course as one university teaches it, and it is
           what the course finder lists: "Warwick" or "Computer Science at
           Warwick" means one of these. Live only at a live university in a
           published destination, the rule every programme list keeps, so
           no suggestion opens a page that answers 404. */
      this.prisma.universityCourseOffering.findMany({
        where: {
          ...live,
          name: { contains: q },
          university: {
            ...live,
            country: { status: 'PUBLISHED', deletedAt: null },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          university: {
            select: {
              name: true,
              slug: true,
              country: { select: { slug: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
        take: pool,
      }),
      this.prisma.university.findMany({
        where: { ...published, name: { contains: q } },
        select: {
          id: true,
          name: true,
          slug: true,
          country: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
        take: pool,
      }),
      this.prisma.scholarship.findMany({
        where: { ...published, title: { contains: q } },
        select: { id: true, title: true, slug: true },
        orderBy: { title: 'asc' },
        take: pool,
      }),
    ]);

    const groups: SearchGroup[] = [
      {
        type: 'country',
        label: 'Countries',
        href: '/study-abroad',
        items: countries.map((row) => ({
          id: row.id,
          label: row.name,
          /* A country's guide is the study-abroad page, not /countries. */
          href: `/study-abroad/${row.slug}`,
          meta: row.continent?.name ?? null,
          iso2Code: row.iso2Code,
        })),
      },
      {
        type: 'subject',
        label: 'Subjects',
        href: '/subjects',
        items: subjects.map((row) => ({
          id: row.id,
          label: row.name,
          href: `/subjects/${row.slug}`,
          meta: null,
        })),
      },
      {
        type: 'course',
        label: 'Courses',
        /* The course guides, searched for the same word: the bare list
           dropped what the reader typed. */
        href: `/courses?${new URLSearchParams({ view: 'guides', q })}`,
        items: courses.map((row) => ({
          id: row.id,
          label: row.name,
          href: `/courses/${row.slug}`,
          meta: row.subject?.name ?? null,
        })),
      },
      {
        type: 'programme',
        label: 'Programmes',
        href: `/courses?${new URLSearchParams({ q })}`,
        items: programmes.map((row) => ({
          id: row.id,
          label: row.name,
          href: `/study-abroad/${row.university.country.slug}/universities/${row.university.slug}/courses/${row.slug}`,
          meta: row.university.name,
        })),
      },
      {
        type: 'university',
        label: 'Universities',
        href: '/universities',
        items: universities.map((row) => ({
          id: row.id,
          label: row.name,
          href: `/universities/${row.slug}`,
          meta: row.country?.name ?? null,
        })),
      },
      {
        type: 'scholarship',
        label: 'Scholarships',
        href: '/scholarships',
        items: scholarships.map((row) => ({
          id: row.id,
          label: row.title,
          href: `/scholarships/${row.slug}`,
          meta: null,
        })),
      },
    ];

    const ranked = groups
      .map((group) => ({ ...group, items: rank(group.items, q, take) }))
      .filter((group) => group.items.length > 0);

    return {
      query: q,
      total: ranked.reduce((sum, group) => sum + group.items.length, 0),
      groups: ranked,
    };
  }
}

/**
 * "Denmark" before "New Zealand and Denmark".
 *
 * A row that opens with what was typed is what the reader meant; one that
 * merely contains it somewhere is a maybe. Within each of those two the
 * database's own order is kept, so a popular destination still leads.
 */
function rank(items: SearchItem[], q: string, take: number): SearchItem[] {
  const needle = q.toLowerCase();
  const opens: SearchItem[] = [];
  const contains: SearchItem[] = [];
  for (const item of items)
    (item.label.toLowerCase().startsWith(needle) ? opens : contains).push(item);
  return [...opens, ...contains].slice(0, take);
}

export const SEARCH_MIN_QUERY = MIN_QUERY;
