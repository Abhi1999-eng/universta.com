import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PhaseListing } from '@/components/phase1/PhaseOneViews';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { getCountryCities } from '@/lib/locations';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ countrySlug: string }>;
  searchParams: Promise<{ state?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countrySlug } = await params;
  return {
    title: `Cities in ${countrySlug.replaceAll('-', ' ')} | Universta`,
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
  return (
    <PhaseListing
      resource="cities"
      rows={result.data as AnyRecord[]}
      meta={result.meta}
      basePath={`/study-in-${countrySlug}`}
      title="Cities"
      search={false}
    />
  );
}
