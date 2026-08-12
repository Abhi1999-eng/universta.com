import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCourseFilterOptions, getSubject, getSubjects } from '@/lib/catalog';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { SubjectDetailReference } from '@/components/reference/SubjectDetailReference';
import { phaseList } from '@/lib/phase1';
import { formatNumber } from '@/lib/format';
import { jsonLdString } from '@/lib/json-ld';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  try {
    return await getSubject(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const subject = await load((await params).slug);
  if (!subject) return { title: 'Subject not found | Universta' };
  return {
    title: subject.seo?.seoTitle ?? `${subject.name} | Universta`,
    description:
      subject.seo?.metaDescription ??
      subject.shortDescription ??
      `Explore ${subject.name} courses.`,
    alternates: { canonical: subject.seo?.canonicalUrl ?? `/subjects/${subject.slug}` },
    robots: { index: subject.seo?.robotsIndex ?? true, follow: subject.seo?.robotsFollow ?? true },
    openGraph: {
      title: subject.seo?.ogTitle ?? subject.name,
      description: subject.seo?.ogDescription ?? subject.shortDescription ?? undefined,
      images: subject.seo?.ogMedia
        ? [{ url: subject.seo.ogMedia.url, alt: subject.seo.ogMedia.alt ?? subject.name }]
        : undefined,
    },
  };
}

export default async function SubjectDetailPage({ params }: Props) {
  const slug = (await params).slug;
  const subject = await load(slug);
  if (!subject) notFound();

  // Cross-links around the subject. Each falls back to an omitted section
  // rather than failing the route.
  const [filterOptions, universities, scholarships, allSubjects] = await Promise.all([
    getCourseFilterOptions({ subject: slug }).catch(() => null),
    phaseList<AnyRecord>('universities', { limit: '4' })
      .then((result) => result.data)
      .catch(() => []),
    phaseList<AnyRecord>('scholarships', { subject: slug, limit: '3' })
      .then((result) => result.data)
      .catch(() => []),
    getSubjects({ limit: '100' })
      .then((result) => result.data)
      .catch(() => []),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    name: subject.name,
    description: subject.shortDescription ?? undefined,
    url: `/subjects/${subject.slug}`,
  };

  return (
    <>
      <SubjectDetailReference
        subject={subject}
        countries={filterOptions?.countries.slice(0, 12) ?? []}
        universities={universities.map((row) => ({
          name: String(row.name),
          slug: String(row.slug),
          country: row.country?.name ? String(row.country.name) : null,
        }))}
        scholarships={scholarships.map((row) => {
          const extra = row as Record<string, unknown>;
          const amount = extra.amount;
          return {
            title: String(row.title ?? row.name),
            slug: String(row.slug),
            amount:
              typeof amount === 'string' && amount
                ? `${typeof row.currencyCode === 'string' ? `${row.currencyCode} ` : ''}${formatNumber(amount)}`
                : null,
            type:
              typeof row.benefitType === 'string'
                ? row.benefitType.toLowerCase().replace(/_/g, ' ')
                : null,
          };
        })}
        relatedSubjects={allSubjects
          .filter((item) => item.slug !== subject.slug)
          .slice(0, 3)
          .map((item) => ({
            name: item.name,
            slug: item.slug,
            courses: item.publishedCourseCount,
          }))}
      />
      <script type="application/ld+json">{jsonLdString(jsonLd)}</script>
    </>
  );
}
