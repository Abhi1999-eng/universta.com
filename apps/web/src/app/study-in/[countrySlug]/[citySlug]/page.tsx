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
  return {
    title: `${city.name}, ${city.country.name} | Universta`,
    description: city.shortDescription ?? undefined,
    alternates: { canonical: `/study-in-${countrySlug}/${city.slug}` },
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
