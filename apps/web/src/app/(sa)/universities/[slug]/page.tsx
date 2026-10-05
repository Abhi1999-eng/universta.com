import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { phaseDetail, phaseList, phaseResolveRedirect } from '@/lib/phase1';
import { toScholarshipCards } from '@/lib/scholarship-card';
import type { ResolvedSeo } from '@/lib/seo-management';
import { inCountry } from '@/lib/country-article';
import { durationLabel } from '@/lib/course-levels';
import { getStudyAbroadCountry } from '@/lib/study-abroad';
import { toDestination, toRecord, whole } from '@/lib/university-record';
import { orderOfferings, popularSubjects } from '@/lib/university-profile';
import {
  universityDescription,
  universityPageMetadata,
  universityTitle,
} from '@/lib/university-seo';
import {
  countryUniversitiesHref,
  offeringHref,
  universityCoursesHref,
  universityHref,
} from '@/lib/university-links';
import {
  UniversityGuide,
  programmeName,
  type UniversityOffering,
} from '@/components/study-abroad/UniversityGuide';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import {
  ConnectBand,
  MatchBand,
  type RelatedGroup,
} from '@/components/study-abroad/DiscoveryBands';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

/** How many scholarships the page shows before "View all": the behaviour
 * reference shows four. */
const SCHOLARSHIPS_SHOWN = 4;

async function university(slug: string) {
  try {
    return await phaseDetail<AnyRecord>('universities', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await university(slug);
  if (!row)
    return {
      title: { absolute: 'University not found | Universta' },
      robots: { index: false },
    };
  const record = toRecord(row);
  const seo = (row as { seo?: ResolvedSeo | null }).seo ?? null;
  /* The catalogue's defaults are the bare name and the site's description;
     the page's own title names what it covers, as the behaviour reference's
     does, and its description is the university's own. */
  return universityPageMetadata({
    seo,
    title: universityTitle(record.name),
    description: universityDescription({
      ...record,
      courses: record.offerings.length,
    }),
    canonical: seo?.canonicalUrl ?? universityHref(record.slug),
    names: [record.name],
  });
}

export default async function UniversityPage({ params }: Props) {
  const { slug } = await params;
  const row = await university(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/universities/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  const record = toRecord(row);
  const { country } = record;

  /* Funding and the destination's guide are cross-links, not the point of
     the page: a failure reaching either drops what it feeds rather than the
     route. */
  const [funding, guide] = await Promise.all([
    phaseList<AnyRecord>('scholarships', {
      university: record.slug,
      limit: String(SCHOLARSHIPS_SHOWN),
    })
      .then((result) => ({
        cards: toScholarshipCards(result.data),
        total: whole((result.meta as { total?: unknown } | null)?.total),
      }))
      .catch(() => ({ cards: [], total: null })),
    country ? getStudyAbroadCountry(country.slug) : Promise.resolve(null),
  ]);

  const where = country ? inCountry(country.name, country.iso2Code) : null;
  const self = universityHref(record.slug);
  const nameOf = (offering: UniversityOffering) =>
    programmeName(offering.name, record.name);
  const ordered = orderOfferings(record.offerings, nameOf);
  const others = record.otherUniversities ?? [];

  const groups: RelatedGroup[] = [
    {
      title: `Courses at ${record.name}`,
      total: record.offerings.length,
      items: ordered.slice(0, 6).map((offering) => ({
        id: offering.id,
        name: nameOf(offering),
        href: country
          ? offeringHref(country.slug, record.slug, offering.slug)
          : `/universities/${record.slug}/courses/${offering.slug}`,
        note:
          [offering.courseLevel?.name, durationLabel(offering)]
            .filter(Boolean)
            .join(' · ') || null,
      })),
    },
    ...(country
      ? [
          {
            title: 'Subjects taught here',
            items: popularSubjects(record.offerings).map((subject) => ({
              id: subject.slug,
              name: subject.name,
              href: `/study-abroad/${country.slug}/${subject.slug}`,
              note: `${subject.count} ${subject.count === 1 ? 'course' : 'courses'} here`,
            })),
          },
          {
            title: `Other universities in ${where}`,
            total: record.otherUniversityTotal || others.length,
            items: others.map((other) => ({
              id: other.id,
              name: other.name,
              href: universityHref(other.slug),
              note: other.city,
            })),
          },
          {
            title: 'Destination',
            items: [
              {
                id: 'guide',
                name: `Study in ${where}`,
                href: `/study-abroad/${country.slug}`,
                note: 'Costs, intakes, visas',
              },
              {
                id: 'universities',
                name: `Universities in ${where}`,
                href: countryUniversitiesHref(country.slug),
                note: null,
              },
              {
                id: 'consultants',
                name: `Consultants for ${where}`,
                href: `/study-abroad-consultants?country=${country.slug}`,
                note: 'Independent providers',
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <>
      <UniversityGuide
        university={record}
        scholarships={funding.cards}
        scholarshipTotal={funding.total ?? funding.cards.length}
        destination={toDestination(guide)}
      />

      <MatchBand
        heading={`Interested in ${record.name}?`}
        href={
          country
            ? `/courses?country=${country.slug}`
            : '/courses'
        }
        talkHref={
          country
            ? `/counselling?source=country&country=${country.slug}&from=${self}`
            : `/counselling?from=${self}`
        }
      />

      <PlanBand
        heading="Not sure this is the right institution?"
        body="Tell us about your academic profile, goals and budget. We'll help you understand your options across every destination we cover."
        countrySlug={country?.slug}
        countryName={country?.name}
        secondary={
          country
            ? {
                href: countryUniversitiesHref(country.slug),
                label: `Browse all universities in ${where}`,
              }
            : { href: '/universities', label: 'Browse all universities' }
        }
      />

      <ConnectBand
        actions={[
          ...(record.offerings.length
            ? [
                {
                  href: country
                    ? universityCoursesHref(country.slug, record.slug)
                    : `/universities/${record.slug}/courses`,
                  label: 'View courses',
                },
              ]
            : []),
          {
            href: `/compare/universities?items=${record.slug}`,
            label: 'Compare',
            ghost: true,
          },
          {
            href: `/scholarships?university=${record.slug}`,
            label: 'Find scholarships',
            ghost: true,
          },
          {
            href: country ? countryUniversitiesHref(country.slug) : '/universities',
            label: country ? `All universities in ${where}` : 'All universities',
            ghost: true,
          },
          { href: '/courses', label: 'Explore courses', ghost: true },
          { href: '/subjects', label: 'Browse subjects', ghost: true },
        ]}
        groups={groups}
      />
    </>
  );
}
