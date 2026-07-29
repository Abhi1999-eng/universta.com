import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApprovedCountryDetail } from '@/components/templates/ApprovedTemplatePages';
import { getCountryPage } from '@/lib/countries';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ countrySlug: string }> };
async function load(slug: string) { try { return await getCountryPage(slug); } catch { return null; } }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const page = await load((await params).countrySlug); if (!page) return { title: 'Country not found | Universta' }; const seo = page.seo; return { title: seo?.seoTitle ?? page.country.pageHeading, description: seo?.metaDescription ?? page.country.shortDescription, alternates: { canonical: seo?.canonicalUrl ?? `/study-in-${page.country.slug}` }, robots: { index: seo?.robotsIndex ?? true, follow: seo?.robotsFollow ?? true }, openGraph: { title: seo?.ogTitle ?? page.country.pageHeading, description: seo?.ogDescription ?? page.country.shortDescription, images: seo?.ogMedia ? [{ url: seo.ogMedia.url, alt: seo.ogMedia.alt ?? page.country.name }] : undefined } }; }
export default async function CountryDetailPage({ params }: Props) { const slug = (await params).countrySlug; const page = await load(slug); if (!page) notFound(); const jsonLd = { '@context': 'https://schema.org', '@type': 'Place', name: page.country.name, description: page.country.shortDescription, url: `/study-in-${page.country.slug}` }; return <><ApprovedCountryDetail page={page} /><script type="application/ld+json">{JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script></>; }
