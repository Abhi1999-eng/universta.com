import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCoursesByLevel, getSpecialization } from '@/lib/catalog';
import { LEVEL_ROWS_FETCHED } from '@/lib/course-levels';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { SpecializationGuide } from '@/components/study-abroad/SpecializationGuide';
import { RecordVisit } from '@/components/study-abroad/ContinueJourney';
import { jsonLdString } from '@/lib/json-ld';
import { phaseList } from '@/lib/phase1';
import { toScholarshipCards } from '@/lib/scholarship-card';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string; specializationSlug: string }>;
};

/* A specialization slug is unique within its subject, not across the table, so
   both halves of the path are part of the lookup. */
async function load(subjectSlug: string, slug: string) {
  try {
    return await getSpecialization(subjectSlug, slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, specializationSlug } = await params;
  const canonical = `/subjects/${slug}/${specializationSlug}`;
  const specialization = await load(slug, specializationSlug);
  if (!specialization)
    return {
      title: 'Specialisation not found',
      alternates: { canonical },
    };
  return {
    title: `Study ${specialization.name} abroad`,
    description:
      specialization.shortDescription ??
      `${specialization.name} is a specialisation within ${specialization.subject.name}. See where you can study it.`,
    alternates: { canonical },
  };
}

export default async function SpecializationDetailPage({ params }: Props) {
  const { slug, specializationSlug } = await params;
  const specialization = await load(slug, specializationSlug);
  if (!specialization) notFound();

  const [levels, scholarships] = await Promise.all([
    /* Its courses under their levels. Both halves of the pair go with the
       request: the specialization's slug alone would also match the branch
       of the same name under another subject. */
    getCoursesByLevel({
      subject: specialization.subject.slug,
      subSubject: specialization.slug,
      perLevel: LEVEL_ROWS_FETCHED,
    }).catch(() => null),
    /* Awards are recorded against subjects, so the specialization shows its
       subject's, as the subject page does. A failure drops the section, not
       the page. */
    phaseList<AnyRecord>('scholarships', {
      subject: specialization.subject.slug,
      limit: '6',
    })
      .then((result) => toScholarshipCards(result.data))
      .catch(() => []),
  ]);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
      { '@type': 'ListItem', position: 2, name: 'Subjects', item: '/subjects' },
      {
        '@type': 'ListItem',
        position: 3,
        name: specialization.subject.name,
        item: `/subjects/${specialization.subject.slug}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: specialization.name,
        item: `/subjects/${specialization.subject.slug}/${specialization.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumb) }}
      />
      <RecordVisit
        kind="specialization"
        href={`/subjects/${specialization.subject.slug}/${specialization.slug}`}
        title={specialization.name}
      />
      <SpecializationGuide
        specialization={specialization}
        levels={levels}
        scholarships={scholarships}
      />
    </>
  );
}
