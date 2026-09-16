import { permanentRedirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ countrySlug: string }> };
export default async function LegacyCountryDetailPage({ params }: Props) {
  permanentRedirect(`/study-abroad/${(await params).countrySlug}`);
}
