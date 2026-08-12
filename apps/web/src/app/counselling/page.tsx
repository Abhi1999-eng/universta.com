import Link from 'next/link';
import {
  CounsellingForm,
  type CounsellingContext,
} from '@/components/counselling/CounsellingForm';
import { getCounsellingOptions } from '@/lib/counselling';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return staticPageMetadata(
    'counselling',
    'Free study abroad counselling',
    'Request personalised study abroad counselling using Universta’s published country, subject and course information.',
    '/counselling',
  );
}

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
    <div className="cref">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/counselling" aria-current="page">
            Book free counselling
          </Link>
        </nav>
      </div>

      <section className="wrap about-hero">
        <div>
          <span className="hero-pill">
            <span className="dot" aria-hidden="true" /> Free study planning support
          </span>
          <h1 style={{ marginTop: 16 }}>
            Book your free study abroad <span className="b">counselling session</span>
          </h1>
          <p className="lede">
            Get personalised guidance from the Universta team. Tell us what you are considering and
            we will use the published catalogue as a clear starting point for the conversation.
          </p>
          <ul className="benefit-list">
            <li>Destination and course direction grounded in published data</li>
            <li>A clear conversation about level, intake and next steps</li>
            <li>No account, payment or booking calendar required</li>
            <li>Your request goes to the Universta team, not to a third party</li>
          </ul>
        </div>

        <div className="form-card">
          <div className="sec-head left" style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 24 }}>Book your free session</h2>
            <p>Takes under two minutes. A counsellor reviews every request.</p>
          </div>
          <CounsellingForm initialOptions={options} context={contextFrom(search)} />
        </div>
      </section>

      <section className="sec wrap">
        <div className="panel">
          <div className="sec-head left">
            <span className="eyebrow">A focused first step</span>
            <h2>What you will get from your session</h2>
            <p>
              A practical conversation about destination, course level, intake and next steps. Your
              request is stored for the Universta team to review and does not create a student
              account.
            </p>
          </div>
          {options?.countries.length ? (
            <>
              <h3 style={{ fontSize: 17, marginBottom: 12 }}>
                Explore popular study destinations
              </h3>
              <div className="dest-flags">
                {options.countries!.slice(0, 12).map((country) => (
                  <Link key={country.slug} className="dest-flag" href={`/countries/${country.slug}`}>
                    {country.name}
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
