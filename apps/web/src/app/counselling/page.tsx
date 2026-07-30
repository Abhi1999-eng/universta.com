import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CounsellingForm,
  type CounsellingContext,
} from '@/components/counselling/CounsellingForm';
import {
  CatalogFooter,
  CatalogHeader,
} from '@/components/templates/ApprovedTemplatePages';
import { getCounsellingOptions } from '@/lib/counselling';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Free study abroad counselling | Universta',
  description:
    'Request personalised study abroad counselling using Universta’s published country, subject and course information.',
  alternates: { canonical: '/counselling' },
};

type Search = Record<string, string | string[] | undefined>;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_-]*$/;
const SOURCES = new Set([
  'general',
  'country',
  'subject',
  'specialization',
  'course',
]);

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function safeSlug(value: string | undefined): string | undefined {
  return value && value.length <= 255 && SLUG.test(value) ? value : undefined;
}

function safeText(value: string | undefined): string | undefined {
  return value && value.length <= 255 && !/[<>]/.test(value)
    ? value
    : undefined;
}

function contextFrom(search: Search): CounsellingContext {
  const source = one(search.source);
  const sourceType = SOURCES.has(source ?? '')
    ? (source as CounsellingContext['sourceType'])
    : 'general';
  const from = one(search.from);
  return {
    sourceType,
    sourceCountrySlug: safeSlug(one(search.country)),
    sourceSubjectSlug: safeSlug(one(search.subject)),
    sourceSpecializationSlug: safeSlug(one(search.specialization)),
    sourceCourseSlug: safeSlug(one(search.course)),
    sourcePagePath:
      from && from.length <= 2048 && SAFE_PATH.test(from) ? from : undefined,
    utmSource: safeText(one(search.utm_source)),
    utmMedium: safeText(one(search.utm_medium)),
    utmCampaign: safeText(one(search.utm_campaign)),
  };
}

export default async function CounsellingPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [options, search] = await Promise.all([
    getCounsellingOptions(),
    searchParams,
  ]);
  return (
    <main className="visual-courses-page visual-counselling-page">
      <CatalogHeader />
      <div className="wrap crumbs">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><Link href="/">Home</Link></li>
            <li className="sep">/</li>
            <li>Counselling</li>
          </ol>
        </nav>
      </div>
      <section className="counselling-hero">
        <div className="wrap counselling-hero-grid">
          <div>
            <span className="hero-pill"><span className="dot" />Free study planning support</span>
            <h1>Turn your study abroad ideas into a <span>clear plan.</span></h1>
            <p className="lede">
              Tell us what you are considering. We’ll use the published
              Universta catalog as a starting point for your counselling
              conversation.
            </p>
            <ul className="counselling-benefits">
              <li>Country and course direction grounded in published data</li>
              <li>A clear conversation about level, intake and next steps</li>
              <li>No account, payment or booking calendar required</li>
            </ul>
          </div>
          <CounsellingForm
            initialOptions={options}
            context={contextFrom(search)}
          />
        </div>
      </section>
      <section className="counselling-trust">
        <div className="wrap">
          <span className="eyebrow">A focused first step</span>
          <h2>Share only what we need to understand your study goals.</h2>
          <p>
            Your request is stored for Universta’s Super Admin team to review.
            It does not create a student account or book an appointment.
          </p>
        </div>
      </section>
      <CatalogFooter />
    </main>
  );
}
