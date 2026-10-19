import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { type AnyRecord } from '@/components/phase1/PhaseOneViews';
import { ConsultantGuide } from '@/components/study-abroad/ConsultantGuide';
import { consultantVerification } from '@/lib/consultant-profile';
import { liveLocationLinks, nameKey } from '@/lib/country-consultant-list';
import { phaseDetail, phaseResolveRedirect } from '@/lib/phase1';
import { phaseOneMetadata } from '@/lib/phase1-metadata';
import { getDestinations } from '@/lib/study-abroad';
import { resolveContentVariables } from '../../../../../../../packages/content-variables';
import '../../consultants-zip.css';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function consultant(slug: string) {
  try {
    return await phaseDetail<AnyRecord>('consultants', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await consultant(slug);
  if (!row) return { title: { absolute: 'Consultant not found | Universta' }, robots: { index: false } };
  const metadata = phaseOneMetadata(row, `/study-abroad-consultants/${row.slug ?? slug}`, 'Study abroad consultant');
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

export default async function ConsultantPage({ params }: Props) {
  const { slug } = await params;
  const row = await consultant(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/study-abroad-consultants/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  const directory = await getDestinations().catch(() => null);
  const guides = new Set((directory?.available ?? []).flatMap((entry) => (entry.slug ? [entry.slug] : [])));
  const record = row as unknown as Record<string, unknown>;
  const list = (value: unknown, key: 'country' | 'location' | null) =>
    Array.isArray(value)
      ? value.map((entry) => {
          const item = entry as Record<string, unknown>;
          const nested = key ? (item[key] as Record<string, unknown> | undefined) : item;
          return { item, nested };
        })
      : [];
  /* Each service or language once, by the name the reader sees: a record
     the admin saved twice can hold "English" under two codes. */
  const names = (value: unknown) =>
    list(value, null)
      .map(({ nested }) => (typeof nested?.name === 'string' ? nested.name.trim() : ''))
      .filter((name, index, all) => name && all.findIndex((other) => nameKey(other) === nameKey(name)) === index);

  return (
    <ConsultantGuide
      consultant={{
        name: String(record.name),
        slug: String(record.slug),
        shortDescription: typeof record.shortDescription === 'string' ? record.shortDescription : null,
        description:
          typeof record.description === 'string'
            ? resolveContentVariables('consultant', record.description, record)
            : null,
        email: typeof record.email === 'string' ? record.email : null,
        phone: typeof record.phone === 'string' ? record.phone : null,
        websiteUrl: typeof record.websiteUrl === 'string' ? record.websiteUrl : null,
        ...consultantVerification(record.verificationStatus, record.verifiedAt),
        sourceReference: typeof record.sourceReference === 'string' ? record.sourceReference : null,
      }}
      countries={list(record.countries, 'country')
        .filter(({ nested }) => nested?.slug)
        .map(({ nested }) => ({ name: String(nested!.name), slug: String(nested!.slug) }))}
      services={names(record.services)}
      languages={names(record.languages)}
      locations={list(liveLocationLinks(record.locations), 'location')
        .filter(({ nested }) => nested?.slug)
        .map(({ item, nested }) => {
          const country = nested!.country as Record<string, unknown> | undefined;
          return {
            name: String(nested!.name),
            slug: String(nested!.slug),
            city: nested!.city ? String(nested!.city) : null,
            state: nested!.state ? String(nested!.state) : null,
            country: country?.name ? String(country.name) : null,
            address: typeof item.address === 'string' ? item.address : null,
          };
        })}
      guides={guides}
    />
  );
}
