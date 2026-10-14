import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { Crumbs } from '@/components/study-abroad/Crumbs';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { SectionHead } from '@/components/study-abroad/SectionHead';
import { getCourses, getSubjects } from '@/lib/catalog';
import { getCountries } from '@/lib/countries';
import { formatNumber } from '@/lib/format';
import { phaseList, phasePage } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

/**
 * About Universta, in the approved design: the zip's hero and prose, then
 * the client-approved mission, why, journey and community sections drawn
 * with the design's cards and steps. The two stat strips carry the real
 * catalogue totals, and a count of zero is left out rather than shown as a
 * claim. An admin still overrides the headings through the managed page.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'about',
    'About Universta',
    'How Universta publishes study abroad information, and what it will not claim.',
    '/about',
  );
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

/** Section keys an admin can override through the managed "about" Page. */
const SECTION_KEYS = new Set(['mission', 'why', 'how', 'community']);

const PROSE = [
  'Planning to study abroad usually means dozens of websites that do not talk to each other. Universta brings them together so each decision leads naturally to the next one.',
  'We keep the student at the centre. Students contact universities, providers and consultants through Universta, and choose what they share.',
  'We would rather show less than show something invented. Where information is not confirmed, we tell you to check the official website.',
];

const WHY = [
  ['Destination discovery', 'Published study destinations with their real cost, work-rights and intake profiles.'],
  ['Course search that filters', 'Every facet in the catalogue is backed by data, so a count of zero means zero.'],
  ['Scholarship finder', 'Published awards, filterable by destination, level and funding type.'],
  ['Compare before you apply', 'Line courses, universities and destinations up side by side on published fields.'],
  ['Consultant directory', 'Published consultants with their destinations, services and contact details — no paid placement.'],
  ['Free counselling', 'Talk your shortlist through with an advisor before you commit to an application.'],
] as const;

const JOURNEY = [
  ['Discover', 'Search destinations, universities and courses.'],
  ['Compare', 'Weigh tuition, duration, intakes and study modes side by side.'],
  ['Shortlist', 'Narrow to the programmes you are actually eligible for.'],
  ['Apply', 'Apply through each university’s own published application route.'],
  ['Arrive', 'Use each destination’s visa, cost and intake guidance to plan the move.'],
] as const;

const COMMUNITY = [
  ['Students', 'Making informed education decisions from published, sourced information.'],
  ['Universities', 'Publishing programmes where international students are already looking.'],
  ['Consultants', 'Listing their destinations and services in a directory with no paid placement.'],
  ['Education partners', 'Supporting the same catalogue with verified, source-referenced data.'],
] as const;

export default async function AboutPage() {
  let page: AnyRecord | null = null;
  try {
    const anonymousId = (await headers()).get('x-anon-id') ?? undefined;
    page = await phasePage<AnyRecord>('about', anonymousId);
  } catch {
    // The page keeps its built-in copy when the managed record is absent.
  }
  const sections: Record<string, { heading?: string; subheading?: string }> = {};
  for (const section of page?.sections ?? []) {
    const key = section.sectionKey;
    if (!key || !SECTION_KEYS.has(key)) continue;
    sections[key] = {
      heading: section.heading ?? undefined,
      subheading: section.eyebrow ?? section.subheading ?? undefined,
    };
  }
  const copy = (key: string, field: 'heading' | 'subheading', fallback: string) =>
    sections[key]?.[field] ?? fallback;

  /* Real catalogue totals for the stat strip. Each falls back to zero, and a
     zero is dropped rather than shown as a claim. */
  const total = (promise: Promise<unknown>) =>
    promise
      .then((result) => Number((result as { meta?: { total?: unknown } })?.meta?.total ?? 0) || 0)
      .catch(() => 0);
  const counts = await Promise.all([
    total(getCountries({ limit: '1' })).then((value) => ({ value, label: 'Destinations' })),
    total(phaseList<AnyRecord>('universities', { limit: '1' })).then((value) => ({ value, label: 'Universities' })),
    total(getCourses({ pageSize: '1' })).then((value) => ({ value, label: 'Courses' })),
    total(phaseList<AnyRecord>('scholarships', { limit: '1' })).then((value) => ({ value, label: 'Scholarships' })),
    total(getSubjects({ limit: '1' })).then((value) => ({ value, label: 'Subjects' })),
    total(phaseList<AnyRecord>('consultants', { limit: '1' })).then((value) => ({ value, label: 'Consultants' })),
  ]);
  const totals = counts.filter((entry) => entry.value > 0);

  const heading =
    (typeof page?.title === 'string' && page.title !== 'About Universta' ? page.title : null) ??
    'Helping students build their future through global education';
  const lede =
    (typeof page?.shortDescription === 'string' ? page.shortDescription : null) ??
    'Universta publishes study abroad information you can trace back to a source: destinations, universities, courses, scholarships and consultants, with search and comparison tools that never show a figure the catalogue cannot support.';

  return (
    <>
      <section className="hero hero--compact h-hero">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'About' }]} />
          <div className="hero__lead">
            <p className="hero__eyebrow">About Universta</p>
            <h1 className="hero__h1">{heading}</h1>
            <p className="hero__sub">{lede}</p>
            <div className="btn-row" style={{ marginTop: 22 }}>
              <Link className="btn btn--lg" href="/universities">
                Explore universities{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
              <Link className="btn btn--lg btn--ghost" href="/counselling">
                Book free counselling
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec--white sec--tight h-sec" id="mission">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">{copy('mission', 'subheading', 'What drives us')}</p>
            <h2 className="sec-title">{copy('mission', 'heading', 'Our mission and vision')}</h2>
          </div>
          <div className="h-prose">
            {PROSE.map((paragraph) => (
              <p key={paragraph.slice(0, 24)}>{paragraph}</p>
            ))}
          </div>
          <div className="h-grid h-grid--wide" style={{ marginTop: 26 }}>
            <div className="h-card">
              <strong className="h-card__t">Our mission</strong>
              <span className="h-card__d">
                To make international education legible: published, source-referenced information
                about destinations, universities, courses and funding, with search and comparison
                tools that only ever show what the catalogue can actually support.
              </span>
            </div>
            <div className="h-card">
              <strong className="h-card__t">Our vision</strong>
              <span className="h-card__d">
                A platform students can trust because nothing on it is estimated for effect — every
                figure traces back to a published record, and anything we do not know is left out
                rather than filled in.
              </span>
            </div>
          </div>
          {totals.length ? (
            <div className={`statstrip statstrip--${Math.min(totals.length, 6)}`} style={{ marginTop: 26 }}>
              {totals.map((entry) => (
                <div key={entry.label}>
                  <b className="datum">{formatNumber(entry.value)}</b>
                  <span>{entry.label}</span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="h-more">
            <Link className="linkcta" href="/contact">
              Contact us <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <Link className="linkcta" href="/faq">
              Read the FAQ <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </p>
        </div>
      </section>

      <section className="sec sec--paper" id="why">
        <div className="wrap">
          <SectionHead
            eyebrow={copy('why', 'subheading', 'Why Universta')}
            title={copy('why', 'heading', 'What makes Universta different')}
            lead="One platform for the whole journey — built to be accurate before it is impressive."
          />
          <div className="h-grid">
            {WHY.map(([title, body]) => (
              <div className="h-card" key={title}>
                <strong className="h-card__t">{title}</strong>
                <span className="h-card__d">{body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec sec--white" id="how">
        <div className="wrap">
          <SectionHead
            eyebrow={copy('how', 'subheading', 'The journey')}
            title={copy('how', 'heading', 'How Universta helps students')}
            lead="From first search to arrival."
          />
          <ol className="choosegrid">
            {JOURNEY.map(([title, body], index) => (
              <li className="choosegrid__item" key={title}>
                <span className="choosegrid__n">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="choosegrid__t">{title}</h3>
                <p className="choosegrid__d">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec sec--paper" id="community">
        <div className="wrap">
          <SectionHead
            eyebrow={copy('community', 'subheading', 'The ecosystem')}
            title={copy('community', 'heading', 'Our global community')}
            lead="Four groups around one shared goal — better global education."
          />
          <div className="h-grid h-grid--4">
            {COMMUNITY.map(([title, body]) => (
              <div className="h-card" key={title}>
                <strong className="h-card__t">{title}</strong>
                <span className="h-card__d">{body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PlanBand
        heading="Start your global education journey"
        body="Browse destinations, shortlist courses and talk it through with a counsellor — all from one published catalogue."
        secondary={{ href: '/study-abroad', label: 'Browse destinations' }}
      />
    </>
  );
}
