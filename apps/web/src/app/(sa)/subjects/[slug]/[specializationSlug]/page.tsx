import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSpecialization } from '@/lib/catalog';
import { SpecializationGuide } from '@/components/study-abroad/SpecializationGuide';
import { jsonLdString } from '@/lib/json-ld';

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
      <SpecializationGuide specialization={specialization} />
    </>
  );
}
