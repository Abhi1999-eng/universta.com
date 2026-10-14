import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { ManagedSections, managedFaqItems } from '@/components/study-abroad/ManagedSections';
import { jsonLdString } from '@/lib/json-ld';
import { phasePage } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

/**
 * The FAQ, in the approved design: the zip's hero with how many answers
 * there are, then the managed page's sections -- its answers as the zip's
 * FAQ list -- and, until an admin writes any, where to get an answer now.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'faq',
    'Frequently asked questions',
    "Find published answers about using Universta's study abroad information.",
    '/faq',
  );
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

export default async function FaqPage() {
  let page: AnyRecord | null = null;
  try {
    const anonymousId = (await headers()).get('x-anon-id') ?? undefined;
    page = await phasePage<AnyRecord>('faq', anonymousId);
  } catch {}
  const sections = (Array.isArray(page?.sections) ? page.sections : []) as AnyRecord[];
  const answers = managedFaqItems(sections);
  const title = (typeof page?.title === 'string' && page.title) || 'Frequently asked questions';
  const description =
    (typeof page?.shortDescription === 'string' && page.shortDescription) ||
    "Find published answers about using Universta's study abroad information.";
  const jsonLd = answers.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: answers.map((item) => ({
          '@type': 'Question',
          name: item.label,
          acceptedAnswer: { '@type': 'Answer', text: item.value },
        })),
      }
    : null;

  return (
    <>
      <section className="hero hero--compact h-hero">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'FAQ' }]} />
          <div className="hero__lead">
            <p className="hero__eyebrow">
              {answers.length ? `${answers.length} ${answers.length === 1 ? 'answer' : 'answers'}` : 'Answers'}
            </p>
            <h1 className="hero__h1">{title}</h1>
            <p className="hero__sub">{description}</p>
          </div>
        </div>
      </section>

      <section className="sec sec--white sec--tight h-sec" id="answers">
        <div className="wrap">
          {sections.length ? (
            <ManagedSections sections={sections} pageTitle={title} />
          ) : (
            <div className="h-empty h-empty--box">
              <h3>Nothing published here yet</h3>
              <p>Book a free counselling session and the Universta team will answer your questions directly.</p>
              <Link className="btn" href="/counselling">
                Book free counselling
              </Link>
            </div>
          )}
          <p className="h-more">
            <Link className="linkcta" href="/contact">
              Contact Universta <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <Link className="linkcta" href="/counselling">
              Book free counselling <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </p>
        </div>
      </section>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} /> : null}
    </>
  );
}
