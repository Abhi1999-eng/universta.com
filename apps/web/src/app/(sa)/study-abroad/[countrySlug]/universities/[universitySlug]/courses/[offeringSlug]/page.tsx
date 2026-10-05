import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { OfferingGuide } from '@/components/study-abroad/OfferingGuide';
import { jsonLdString } from '@/lib/json-ld';
import { offeringJsonLd, toOfferingDetail } from '@/lib/offering-detail';
import { phaseList, phaseResolveRedirect } from '@/lib/phase1';
import { toScholarshipCards } from '@/lib/scholarship-card';
import { resolvedMetadata } from '@/lib/seo-management';
import { siteOrigin } from '@/lib/site-origin';
import { offeringCanonical } from '@/lib/university-courses';
import { loadOffering } from '@/lib/university-courses-server';
import { offeringHref } from '@/lib/university-links';

/**
 * One course at one university, under its country:
 * /study-abroad/<country>/universities/<university>/courses/<course>.
 *
 * The behaviour reference addresses a course by its short name --
 * .../courses/msc-computer-science -- where this catalogue's slugs carry the
 * university as well. The short form is tried as "<university>-<course>"
 * and redirected to the full one, so both reach the same page; so is a
 * wrong country.
 */
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{
    countrySlug: string;
    universitySlug: string;
    offeringSlug: string;
  }>;
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
  const seo = detail.seo;
  /* The catalogue's own default title is the bare course name, which does
     not say where it is taught, and its default description is the site's.
     What an editor wrote, one by one or in bulk, is kept as written. */
  const written = (source: string | undefined) =>
    source === 'manual' || source === 'bulk';
  const ownTitle = written(seo?.source?.title) && seo?.seoTitle;
  const title =
    ownTitle ||
    `${detail.card.name} at ${detail.university.name} | Fees, Eligibility & Intakes`;
  const description =
    (written(seo?.source?.description) && seo?.metaDescription) ||
    detail.shortDescription ||
    `${detail.card.name} at ${detail.university.name}, ${detail.university.country.name}: duration, tuition, intakes and entry requirements.`;
  const meta = resolvedMetadata(
    seo
      ? {
          ...seo,
          seoTitle: title,
          metaDescription: description,
          canonicalUrl: offeringCanonical(seo.canonicalUrl, detail.card.href),
          ...(ownTitle ? {} : { ogTitle: title, twitterTitle: title }),
          ...(written(seo.source?.description)
            ? {}
            : { ogDescription: description, twitterDescription: description }),
        }
      : null,
    title,
    description,
    detail.card.href,
  );
  /* `resolvedMetadata` finishes the title with the site name, and this
     route family's layout would add it again through its template. */
  return typeof meta.title === 'string'
    ? { ...meta, title: { absolute: meta.title } }
    : meta;
}

export default async function Page({ params }: Props) {
  const { countrySlug, universitySlug, offeringSlug } = await params;
  const detail = toOfferingDetail(await find(universitySlug, offeringSlug));
  if (!detail) {
    const moved = await phaseResolveRedirect(
      offeringHref(countrySlug, universitySlug, offeringSlug),
    );
    if (moved) permanentRedirect(moved.targetPath);
    notFound();
  }
  if (
    detail.university.country.slug !== countrySlug ||
    detail.university.slug !== universitySlug ||
    detail.card.slug !== offeringSlug
  )
    permanentRedirect(detail.card.href);

  /* Awards recorded against this course; failing those, the university's
     own. Funding is a cross-link here, so a failure costs the section. */
  const forCourse = await phaseList<AnyRecord>('scholarships', {
    offering: detail.card.slug,
    limit: '4',
  })
    .then((list) => toScholarshipCards(list.data))
    .catch(() => []);
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
      />
      <script type="application/ld+json">
        {jsonLdString(offeringJsonLd(detail, siteOrigin))}
      </script>
    </>
  );
}
