import { CountryForm } from '@/features/catalog/CountryForm';

export default async function EditCountryRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CountryForm countryId={id} />;
}
