import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PhaseListing } from '@/components/phase1/PhaseOneViews';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { getCountryCities } from '@/lib/locations';
import { labelFromSlug } from '@/lib/slug-label';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<{ state?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countrySlug } = await params;
  // The country-scoped city list names the country it was scoped to, so the
  // title can use the country's real display name rather than the raw slug.
  let name = labelFromSlug(countrySlug);
  try {
    const { meta } = await getCountryCities(countrySlug, { limit: '1' });
    if (meta.country?.name) name = meta.country.name;
  } catch {
    // Keep the slug-derived fallback; a title is not worth failing the page.
  }
  return {
    title: `Cities in ${name} | Universta`,
    alternates: { canonical: `/study-in-${countrySlug}/cities` },
  };
}

export default async function CityListingPage({ params, searchParams }: Props) {
  const { countrySlug } = await params;
  const { state, page } = await searchParams;
  let result: Awaited<ReturnType<typeof getCountryCities>> | null = null;
  try {
    result = await getCountryCities(countrySlug, {
      ...(state ? { state } : {}),
      ...(page ? { page } : {}),
    });
  } catch {
    result = null;
  }
  if (!result) notFound();
  // Naming the country in the heading matters here: this page is reachable
  // from the global /cities index and from search, where a bare "Cities"
  // gives a visitor no idea which country they are looking at.
  const heading = `Cities in ${result.meta.country?.name ?? labelFromSlug(countrySlug)}`;
  return (
    <PhaseListing
      resource="cities"
      rows={result.data as AnyRecord[]}
      meta={result.meta}
      basePath={`/study-in-${countrySlug}`}
      title={heading}
      search={false}
    />
  );
}
