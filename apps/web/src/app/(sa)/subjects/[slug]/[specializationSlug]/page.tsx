import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCourseLevels, getCoursesByLevel, getSpecialization } from '@/lib/catalog';
import { SubjectLevelPage, subjectLevelMetadata } from '@/components/study-abroad/SubjectLevelPage';
import { findSubjectLevel } from '@/lib/subject-levels';
import { everyLevel, LEVEL_ROWS_FETCHED, specializationOfferedLevels } from '@/lib/course-levels';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { SpecializationGuide } from '@/components/study-abroad/SpecializationGuide';
import { RecordVisit } from '@/components/study-abroad/ContinueJourney';
import { countryFaqJsonLd } from '@/lib/country-faq';
import { jsonLdString } from '@/lib/json-ld';
import { phaseList } from '@/lib/phase1';
import { programmeSample } from '@/lib/programme-sample';
import { levelPageIntros } from '@/lib/level-page-intros';
import { toScholarshipCards } from '@/lib/scholarship-card';
import { resolvedMetadata, templatedTitle } from '@/lib/seo-management';
import { specializationHasOwnWords } from '@/lib/specialization-written';
import { breadcrumbJsonLd } from '@/lib/university-json-ld';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string; specializationSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/* The place after the subject holds either a specialization or a study
   level: /subjects/computing/artificial-intelligence or
   /subjects/computing/masters. A specialization is looked up first; only a
   path that names no specialization is read as a level. The API keeps
   specialization slugs off the level slugs, so the two never meet. A level
   segment renders only where the subject is offered at that level (or,
   offered at none, at one of the six named levels); any other is a 404,
   decided by the level page itself. */
async function isLevel(segment: string) {
  const levels = await getCourseLevels().catch(() => null);
  return Boolean(levels && findSubjectLevel(levels, segment));
}

/* A specialization slug is unique within its subject, not across the table, so
   both halves of the path are part of the lookup. */
async function load(subjectSlug: string, slug: string) {
  try {
    return await getSpecialization(subjectSlug, slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, specializationSlug } = await params;
  const canonical = `/subjects/${slug}/${specializationSlug}`;
  const specialization = await load(slug, specializationSlug);
  if (!specialization && (await isLevel(specializationSlug)))
    return subjectLevelMetadata(Promise.resolve({ slug, levelSlug: specializationSlug }), searchParams);
  if (!specialization)
    return {
      title: 'Specialization not found',
      alternates: { canonical },
    };
  /* The record's own SEO first, then the bulk template, then what the page
     can say for itself: the same order as a subject's page. */
  const resolved = resolvedMetadata(
    specialization.seo,
    `Study ${specialization.name} abroad`,
    specialization.shortDescription ??
      `${specialization.name} is a specialization within ${specialization.subject.name}. See where you can study it.`,
    canonical,
  );
  /* A specialization can be published with nothing written about it, and
     a page with nothing of its own is not worth sending crawlers to. The
     sitemap asks the same question of the same helper. */
  const written = specializationHasOwnWords(specialization);
  return {
    ...resolved,
    /* `resolvedMetadata` appends the site name, and this route family's
       layout appends it again through its title template. Hand the template
       the bare title and let it do that once. */
    title: templatedTitle(specialization.seo?.seoTitle ?? `Study ${specialization.name} abroad`),
    ...(written ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function SpecializationDetailPage({ params, searchParams }: Props) {
  const { slug, specializationSlug } = await params;
  const specialization = await load(slug, specializationSlug);
  /* Called, not returned as an element: a level the subject is not
     offered at then throws its 404 inside this route's own render, before
     anything streams, so the response is a real 404 -- as on the
     specialization's own level route, which is the component itself. */
  if (!specialization && (await isLevel(specializationSlug)))
    return SubjectLevelPage({ params: Promise.resolve({ slug, levelSlug: specializationSlug }), searchParams });
  if (!specialization) notFound();

  const [levels, scholarships, allLevels, programmes, levelIntros] = await Promise.all([
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
    /* Every study level, so the six the page always shows are there even
       where nothing is listed at them yet. */
    getCourseLevels().catch(() => null),
    /* The first few of the universities' programmes in it, and how many
       in all; the pair again, for the same reason. None, or a failed
       read, leaves the section out. */
    programmeSample({
      subject: [specialization.subject.slug],
      specialization: [specialization.slug],
    }),
    /* What editors wrote on its level pages, for a line about each level
       in its levels section. None, or a failed read, says less there. */
    levelPageIntros({
      subject: specialization.subject.slug,
      specialization: specialization.slug,
    }),
  ]);

  const selfPath = `/subjects/${specialization.subject.slug}/${specialization.slug}`;
  /* The crumbs the hero draws, with absolute addresses, as the level pages
     and a university's pages give theirs: a relative `item` is not a URL
     to a crawler. */
  const breadcrumb = breadcrumbJsonLd(
    [
      { label: 'Home', href: '/' },
      { label: 'Subjects', href: '/subjects' },
      { label: specialization.subject.name, href: `/subjects/${specialization.subject.slug}` },
      { label: specialization.name },
    ],
    selfPath,
  );
  /* The questions the page answers, as structured data, as a country's
     and a university's pages give theirs. */
  const faqData = countryFaqJsonLd(specialization.faqs ?? []);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumb) }}
      />
      {faqData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(faqData) }}
        />
      ) : null}
      <RecordVisit
        kind="specialization"
        href={selfPath}
        title={specialization.name}
      />
      <SpecializationGuide
        specialization={specialization}
        levels={everyLevel(levels, allLevels, specializationOfferedLevels(specialization))}
        catalogue={allLevels}
        scholarships={scholarships}
        programmes={programmes}
        levelIntros={levelIntros}
      />
    </>
  );
}
