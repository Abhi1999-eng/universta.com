import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { UniversityClaimForm } from '@/components/universities/UniversityClaimForm';
import { phaseDetail } from '@/lib/phase1';
import { universityHref } from '@/lib/university-links';

/**
 * A university's claim request, in the approved design: the compact hero
 * that names the institution, then the form in the design's form card. The
 * request itself is unchanged -- the same fields, the same spam trap and
 * consent, the same route -- only the page around it moved.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function university(slug: string) {
  try {
    return await phaseDetail<AnyRecord>('universities', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await university(slug);
  /* The route family's template would add the site's name again. */
  if (!row) return { title: { absolute: 'University not found | Universta' }, robots: { index: false } };
  return {
    title: { absolute: `Claim ${String(row.name ?? 'this university')} | Universta` },
    robots: { index: false },
  };
}

export default async function UniversityClaimPage({ params }: Props) {
  const { slug } = await params;
  const row = await university(slug);
  if (!row) notFound();
  const name = String(row.name ?? 'this university');
  const back = universityHref(slug);
  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs
            trail={[
              { label: 'Home', href: '/' },
              { label: 'Universities', href: '/universities' },
              { label: name, href: back },
              { label: 'Claim this listing' },
            ]}
          />
          <p className="hero__eyebrow">University claim request</p>
          <h1 className="hero__h1">Claim {name}</h1>
          <p className="hero__sub">
            If you represent {name}, request that this listing be assigned to you for review. Our
            team verifies every request before any change is made — submitting this form does not
            grant admin access.
          </p>
        </div>
      </section>

      <section className="sec sec--paper sec--tight h-sec" id="claim">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">Your details</p>
            <h2 className="sec-title">Tell us who you are</h2>
          </div>
          <div className="h-formwrap">
            <UniversityClaimForm universitySlug={slug} />
          </div>
          <p className="h-more">
            <Link className="linkcta" href={back}>
              Back to {name} <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
