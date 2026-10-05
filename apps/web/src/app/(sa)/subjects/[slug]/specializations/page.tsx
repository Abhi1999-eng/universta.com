import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCourseFilterOptions, getCourses, getSubject } from '@/lib/catalog';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { SpecializationsReference } from '@/components/reference/SpecializationsReference';
import { phaseList } from '@/lib/phase1';
import { formatNumber } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load(slug: string) {
  try {
    return await getSubject(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const slug = (await params).slug;
  const subject = await load(slug);
  // Every other public route declares a canonical; this one declared none,
  // leaving its preferred URL ambiguous to search engines.
  const alternates = { canonical: `/subjects/${slug}/specializations` };
  if (!subject) return { title: 'Specialisations not found', alternates };
  return {
    /* This route family's layout appends the site name through its title
       template, so the page states only its own name. */
    title: `${subject.name} specialisations`,
    description: `Explore published ${subject.name} specialisations and course pathways.`,
    alternates,
  };
}

export default async function SubjectSpecializationsPage({ params, searchParams }: Props) {
  const slug = (await params).slug;
  const subject = await load(slug);
  if (!subject) notFound();
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) ?? '';

  const [filterOptions, courses, universities, scholarships] = await Promise.all([
    getCourseFilterOptions({ subject: slug }).catch(() => null),
    getCourses({ subject: slug, pageSize: '6' })
      .then((result) => result.data)
      .catch(() => []),
    /* The band is titled "Universities teaching <subject>", so it reads the
       universities that do: unfiltered, it opened on a demo institute that
       teaches none of it. */
    phaseList<AnyRecord>('universities', { subject: slug, limit: '4' })
      .then((result) => result.data)
      .catch(() => []),
    phaseList<AnyRecord>('scholarships', { subject: slug, limit: '3' })
      .then((result) => result.data)
      .catch(() => []),
  ]);

  // Real per-specialisation course counts, keyed by slug.
  const counts = Object.fromEntries(
    (filterOptions?.subSubjects ?? []).map((entry) => [entry.value, entry.count]),
  );
  /* The twelve destinations with the most programmes in it. The options
     arrive in the catalogue's country order, so cutting them first kept
     Denmark and Finland and dropped the United States. */
  const countries = [...(filterOptions?.countries ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return (
    <SpecializationsReference
      subject={subject}
      counts={counts}
      query={query}
      countries={countries}
      /* The subject's own levels arrive in climbing order; each card's
         levels line follows them. */
      levelOrder={(subject.courseCountsByLevel ?? []).flatMap((row) =>
        row.level.code ? [row.level.code] : [],
      )}
      universities={universities.map((row) => ({
        name: String(row.name),
        slug: String(row.slug),
        country: row.country?.name ? String(row.country.name) : null,
      }))}
      courses={courses}
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
    />
  );
}
