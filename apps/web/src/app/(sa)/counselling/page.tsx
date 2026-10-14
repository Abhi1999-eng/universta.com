import type { Metadata } from 'next';
import Link from 'next/link';
import { CounsellingForm, type CounsellingContext } from '@/components/counselling/CounsellingForm';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { ConnectBand } from '@/components/study-abroad/DiscoveryBands';
import { SectionHead } from '@/components/study-abroad/SectionHead';
import { getCounsellingOptions } from '@/lib/counselling';
import { staticPageMetadata } from '@/lib/static-page-seo';

/**
 * Free counselling, in the approved design: the compact hero with what the
 * session is, the request form in the design's form card, what the reader
 * gets from it, and the destinations to read in the meantime. The request
 * itself -- its fields, its context from the page that sent the reader, the
 * consent the API requires -- is as before.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'counselling',
    'Free study abroad counselling',
    'Request personalised study abroad counselling using Universta’s published country, subject and course information.',
    '/counselling',
  );
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

type Search = Record<string, string | string[] | undefined>;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_-]*$/;
const SOURCES = new Set(['general', 'country', 'subject', 'specialization', 'course']);

const BENEFITS = [
  'Destination and course direction grounded in published data',
  'A clear conversation about level, intake and next steps',
  'No account, payment or booking calendar required',
  'Your request goes to the Universta team, not to a third party',
];

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function safeSlug(value: string | undefined): string | undefined {
  return value && value.length <= 255 && SLUG.test(value) ? value : undefined;
}

function safeText(value: string | undefined): string | undefined {
  return value && value.length <= 255 && !/[<>]/.test(value) ? value : undefined;
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
    sourcePagePath: from && from.length <= 2048 && SAFE_PATH.test(from) ? from : undefined,
    utmSource: safeText(one(search.utm_source)),
    utmMedium: safeText(one(search.utm_medium)),
    utmCampaign: safeText(one(search.utm_campaign)),
  };
}

export default async function CounsellingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [options, search] = await Promise.all([getCounsellingOptions(), searchParams]);
  return (
    <>
      <section className="hero hero--compact h-hero">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'Book free counselling' }]} />
          <div className="hero__lead">
            <p className="hero__eyebrow">Free study planning support</p>
            <h1 className="hero__h1">Book your free study abroad counselling session</h1>
            <p className="hero__sub">
              Get personalised guidance from the Universta team. Tell us what you are considering and
              we will use the published catalogue as a clear starting point for the conversation.
            </p>
            <ul className="ticklist" style={{ marginTop: 20 }}>
              {BENEFITS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="btn-row" style={{ marginTop: 22 }}>
              <a className="btn btn--lg" href="#book">
                Book your free session{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec--paper sec--tight h-sec" id="book">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">Your study goals</p>
            <h2 className="sec-title">Tell us where you want to go.</h2>
            <p className="sec-lead">Takes under two minutes. A counsellor reviews every request.</p>
          </div>
          <div className="h-formwrap">
            <CounsellingForm initialOptions={options} context={contextFrom(search)} />
          </div>
        </div>
      </section>

      <section className="sec sec--white" id="session">
        <div className="wrap">
          <SectionHead
            eyebrow="A focused first step"
            title="What you will get from your session"
            lead="A practical conversation about destination, course level, intake and next steps. Your request is stored for the Universta team to review and does not create a student account."
          />
          {options?.countries.length ? (
            <>
              <p className="path__h">Explore popular study destinations</p>
              <div className="citychips">
                {options.countries.slice(0, 12).map((country) => (
                  <Link className="specchip specchip--live" href={`/study-abroad/${country.slug}`} key={country.slug}>
                    {country.name}
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <ConnectBand
        actions={[
          { href: '/study-abroad', label: 'Compare destinations' },
          { href: '/universities', label: 'Browse universities', ghost: true },
          { href: '/courses', label: 'Explore courses', ghost: true },
          { href: '/scholarships', label: 'Find scholarships', ghost: true },
        ]}
      />
    </>
  );
}
