import type { Metadata } from 'next';
import { UniversityCompareReference } from '@/components/reference/UniversityCompareReference';
import { phaseCompare, phaseComparisonOptions } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';
import { readUniversityCompareSlugs, toCompareUniversity, type CompareUniversity } from '@/lib/university-compare';
import './university-comparison.css';

/** The same shareable address and SEO record, now inside the approved design's frame. */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'compare-universities',
    'Compare universities',
    'Compare published university tuition, campuses and course offerings side by side.',
    '/compare/universities',
    false,
  );
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

type Comparison = { items: Array<{ slug: string }>; invalid: string[] };

/** Older deployed APIs answered only three. Read any unanswered columns during a rolling deployment. */
async function compare(slugs: string[]): Promise<Comparison> {
  const first = await phaseCompare<Comparison>('universities', slugs);
  const answered = new Set([...first.items.map((row) => row.slug), ...first.invalid]);
  const rest = slugs.filter((slug) => !answered.has(slug));
  if (!rest.length) return first;
  const more = await phaseCompare<Comparison>('universities', rest);
  return { items: [...first.items, ...more.items], invalid: [...first.invalid, ...more.invalid] };
}

export default async function CompareUniversities({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = readUniversityCompareSlugs(await searchParams);
  const [result, options] = await Promise.all([
    requested.length ? compare(requested).catch(() => null) : Promise.resolve<Comparison>({ items: [], invalid: [] }),
    phaseComparisonOptions<{ slug: string; name: string }>('universities').catch(() => []),
  ]);
  const mapped = new Map((result?.items ?? []).flatMap((record) => {
    const item = toCompareUniversity(record);
    return item ? [[item.slug, item] as const] : [];
  }));
  const items = requested.flatMap((slug): CompareUniversity[] => mapped.has(slug) ? [mapped.get(slug)!] : []);
  return (
    <UniversityCompareReference
      items={items}
      invalid={result ? requested.filter((slug) => !mapped.has(slug)) : []}
      options={options}
      selected={requested}
      unavailable={result === null}
    />
  );
}
