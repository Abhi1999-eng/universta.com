import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PhaseDetail } from '@/components/phase1/PhaseOneViews';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { getCityDetail } from '@/lib/locations';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ countrySlug: string; citySlug: string }> };

async function load(countrySlug: string, citySlug: string) {
  try {
    return await getCityDetail(countrySlug, citySlug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countrySlug, citySlug } = await params;
  const city = await load(countrySlug, citySlug);
  if (!city) return { title: 'City not found | Universta' };
  const seo = (city as { seo?: Record<string, unknown> | null }).seo;
  return {
    title:
      (seo?.seoTitle as string | undefined) ??
      `${city.name}, ${city.country.name} | Universta`,
    description:
      (seo?.metaDescription as string | undefined) ?? city.shortDescription ?? undefined,
    alternates: {
      canonical:
        (seo?.canonicalUrl as string | undefined) ??
        `/study-in-${countrySlug}/${city.slug}`,
    },
    robots:
      seo?.robotsIndex === false || seo?.robotsFollow === false
        ? {
            index: seo?.robotsIndex !== false,
            follow: seo?.robotsFollow !== false,
          }
        : undefined,
    openGraph:
      seo?.ogTitle || seo?.ogDescription
        ? {
            title: (seo?.ogTitle as string | undefined) ?? undefined,
            description: (seo?.ogDescription as string | undefined) ?? undefined,
          }
        : undefined,
  };
}

export default async function CityDetailPage({ params }: Props) {
  const { countrySlug, citySlug } = await params;
  const city = await load(countrySlug, citySlug);
  if (!city) notFound();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: city.name,
    description: city.shortDescription ?? undefined,
    url: `/study-in-${countrySlug}/${city.slug}`,
    containedInPlace: { '@type': 'Country', name: city.country.name },
  };
  return (
    <>
      <PhaseDetail
        resource="cities"
        row={city as AnyRecord}
        basePath={`/study-in-${countrySlug}/cities`}
      />
      <script type="application/ld+json">
        {JSON.stringify(jsonLd).replace(/</g, '\\u003c')}
      </script>
    </>
  );
}
