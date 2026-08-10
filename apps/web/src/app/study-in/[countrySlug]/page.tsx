import { permanentRedirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ countrySlug: string }> };
export default async function LegacyCountryDetailPage({ params }: Props) {
  permanentRedirect(`/countries/${(await params).countrySlug}`);
}
