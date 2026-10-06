import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { OfferingGuide } from '@/components/study-abroad/OfferingGuide';
import { getCourse } from '@/lib/catalog';
import { jsonLdString } from '@/lib/json-ld';
import { offeringJsonLd, toOfferingDetail } from '@/lib/offering-detail';
import { phaseList, phaseResolveRedirect } from '@/lib/phase1';
import { toScholarshipCards } from '@/lib/scholarship-card';
import { siteOrigin } from '@/lib/site-origin';
import { getStudyAbroadCountry } from '@/lib/study-abroad';
import { offeringCanonical, withQuery } from '@/lib/university-courses';
import { loadOffering } from '@/lib/university-courses-server';
import { offeringHref } from '@/lib/university-links';
import { toDestination } from '@/lib/university-record';
import { offeringTitle, universityPageMetadata } from '@/lib/university-seo';

/**
 * One course at one university, under its country:
 * /study-abroad/<country>/universities/<university>/courses/<course>.
 *
 * The behaviour reference addresses a course by its short name --
 * .../courses/msc-computer-science -- where this catalogue's slugs carry the
 * university as well. The short form is tried as "<university>-<course>"
 * and redirected to the full one, so both reach the same page; so is a
 * wrong country. Each redirect keeps the query the link arrived with.
 */
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{
    countrySlug: string;
    universitySlug: string;
    offeringSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function find(universitySlug: string, offeringSlug: string) {
  const exact = await loadOffering(universitySlug, offeringSlug);
  if (exact) return exact;
  if (offeringSlug.startsWith(`${universitySlug}-`)) return null;
  return loadOffering(universitySlug, `${universitySlug}-${offeringSlug}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { universitySlug, offeringSlug } = await params;
  const detail = toOfferingDetail(await find(universitySlug, offeringSlug));
  if (!detail)
    return {
      title: { absolute: 'University course not found | Universta' },
      robots: { index: false },
    };
  /* The catalogue's own default title is the bare course name, which does
     not say where it is taught, and its default description is the site's.
     What an editor wrote, one by one or in bulk, is kept as written; a
     stored title that is only the course's name is the default saved back
     from the admin's form, and gives way like one. */
  return universityPageMetadata({
    seo: detail.seo,
    title: offeringTitle(detail.card.name, detail.university.name),
    description:
      detail.shortDescription ??
      `${detail.card.name} at ${detail.university.name}, ${detail.university.country.name}: duration, tuition, intakes and entry requirements.`,
    canonical: offeringCanonical(detail.seo?.canonicalUrl, detail.card.href),
    names: [detail.card.name, detail.fullName],
  });
}

export default async function Page({ params, searchParams }: Props) {
  const { countrySlug, universitySlug, offeringSlug } = await params;
  const query = await searchParams;
  const detail = toOfferingDetail(await find(universitySlug, offeringSlug));
  if (!detail) {
    const moved = await phaseResolveRedirect(
      offeringHref(countrySlug, universitySlug, offeringSlug),
    );
    if (moved) permanentRedirect(withQuery(moved.targetPath, query));
    notFound();
  }
  if (
    detail.university.country.slug !== countrySlug ||
    detail.university.slug !== universitySlug ||
    detail.card.slug !== offeringSlug
  )
    permanentRedirect(withQuery(detail.card.href, query));

  /* Awards recorded against this course; failing those, the university's
     own. The destination's guide decides where the visa and living-cost
     links land and who the student can ask; the generic course holds the
     questions editors wrote about it. Each is a cross-link here, so a
     failure costs what it feeds rather than the page. */
  const [forCourse, guide, course] = await Promise.all([
    phaseList<AnyRecord>('scholarships', {
      offering: detail.card.slug,
      limit: '4',
    })
      .then((list) => toScholarshipCards(list.data))
      .catch(() => []),
    getStudyAbroadCountry(detail.university.country.slug),
    detail.courseSlug
      ? getCourse(detail.courseSlug).catch(() => null)
      : Promise.resolve(null),
  ]);
  const forUniversity = forCourse.length
    ? []
    : await phaseList<AnyRecord>('scholarships', {
        university: detail.university.slug,
        limit: '4',
      })
        .then((list) => toScholarshipCards(list.data))
        .catch(() => []);

  return (
    <>
      <OfferingGuide
        detail={detail}
        scholarships={forCourse.length ? forCourse : forUniversity}
        scholarshipScope={forCourse.length ? 'course' : 'university'}
        destination={toDestination(guide)}
        faqs={course?.faqs ?? []}
      />
      <script type="application/ld+json">
        {jsonLdString(offeringJsonLd(detail, siteOrigin))}
      </script>
    </>
  );
}
