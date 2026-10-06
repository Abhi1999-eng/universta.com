import type { Metadata } from 'next';
import { CourseComparePage } from '@/components/study-abroad/CourseComparePage';
import {
  readCompareSlugs,
  toCompareColumn,
  toCompareOptions,
  type CompareColumn,
} from '@/lib/course-compare';
import { phaseCompare, phaseComparisonOptions } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

/**
 * /compare/courses: up to four programmes side by side, in the design's
 * comparison and inside the Study Abroad header and footer. It used to be
 * the phase-1 page outside the route family; the address is the same, and
 * so are its `items` and its noindex rule, which the Admin's static-page
 * SEO still controls.
 */
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type Comparison = { items: Array<{ slug: string }>; invalid: string[] };

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'compare-courses',
    'Compare university courses',
    'Compare programmes side by side: university, degree, duration, tuition, language, intake, deadline and entry requirements.',
    '/compare/courses',
    false,
  );
  /* The helper writes the site's suffix itself; the route family's title
     template would add it a second time. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

/**
 * The comparison of these programmes. An API that keeps fewer than it is
 * asked for -- the first one kept three -- leaves the rest unanswered, so
 * those are asked for again on their own, and four can be compared either
 * way.
 */
async function compare(slugs: string[]): Promise<Comparison> {
  const first = await phaseCompare<Comparison>('courses', slugs);
  const answered = new Set([
    ...first.items.map((row) => row.slug),
    ...first.invalid,
  ]);
  const rest = slugs.filter((slug) => !answered.has(slug));
  if (!rest.length) return first;
  const more = await phaseCompare<Comparison>('courses', rest);
  return {
    items: [...first.items, ...more.items],
    invalid: [...first.invalid, ...more.invalid],
  };
}

export default async function CompareCoursesPage({ searchParams }: Props) {
  const requested = readCompareSlugs(await searchParams);
  const [comparison, options] = await Promise.all([
    requested.length
      ? compare(requested).catch(() => null)
      : Promise.resolve<Comparison>({ items: [], invalid: [] }),
    phaseComparisonOptions<unknown>('courses').catch(() => []),
  ]);

  /* In the address's order, whichever answer each came back in. */
  const today = new Date();
  const bySlug = new Map(
    (comparison?.items ?? []).flatMap((row) => {
      const column = toCompareColumn(row, today);
      return column ? [[column.slug, column] as const] : [];
    }),
  );
  const columns = requested.flatMap((slug): CompareColumn[] => {
    const column = bySlug.get(slug);
    return column ? [column] : [];
  });
  const invalid = comparison
    ? requested.filter((slug) => !bySlug.has(slug))
    : [];

  return (
    <CourseComparePage
      requested={requested}
      columns={columns}
      invalid={invalid}
      options={toCompareOptions(options)}
      unavailable={comparison === null}
    />
  );
}
