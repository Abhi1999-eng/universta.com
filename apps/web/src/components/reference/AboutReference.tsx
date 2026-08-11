import Link from 'next/link';
import { formatNumber } from '@/lib/format';

/** The client-approved About page.
 *
 * The template's mission stats and trust strip ("500K+ students supported",
 * "35,000+ universities", "12,000+ verified partners") are prototype copy.
 * Universta can count its own published catalogue, so the strips carry those
 * real totals and any figure the catalogue cannot support is left out rather
 * than invented — which is also what the page's own claim of transparency
 * requires.
 *
 * Hero, mission, vision, why, journey timeline, community and the closing CTA
 * all keep the approved layout; an admin can override the headings and copy
 * through the managed "about" Page. */

export type AboutReferenceProps = {
  heading: string;
  lede: string;
  /** Real catalogue totals; an entry with no count is not rendered. */
  totals: Array<{ value: number; label: string }>;
  sections: Record<string, { heading?: string; subheading?: string } | undefined>;
};

const WHY = [
  {
    h: 'Destination discovery',
    p: 'Published study destinations with their real cost, work-rights and intake profiles.',
  },
  {
    h: 'Course search that filters',
    p: 'Every facet in the catalogue is backed by data, so a count of zero means zero.',
  },
  { h: 'Scholarship finder', p: 'Published awards, filterable by destination, level and subject.' },
  {
    h: 'Compare before you apply',
    p: 'Line courses, universities and destinations up side by side on published fields.',
  },
  {
    h: 'Consultant directory',
    p: 'Published consultants with their destinations, services and contact details — no paid placement.',
  },
  {
    h: 'Free counselling',
    p: 'Talk your shortlist through with an advisor before you commit to an application.',
  },
];

const JOURNEY = [
  { h: 'Discover', p: 'Search destinations, universities and courses.' },
  { h: 'Compare', p: 'Weigh tuition, duration, intakes and study modes side by side.' },
  { h: 'Shortlist', p: 'Narrow to the programmes you are actually eligible for.' },
  { h: 'Apply', p: 'Apply through each university’s own published application route.' },
  { h: 'Arrive', p: 'Use each destination’s visa, cost and intake guidance to plan the move.' },
];

const COMMUNITY = [
  { h: 'Students', p: 'Making informed education decisions from published, sourced information.' },
  { h: 'Universities', p: 'Publishing programmes where international students are already looking.' },
  { h: 'Consultants', p: 'Listing their destinations and services in a directory with no paid placement.' },
  { h: 'Education partners', p: 'Supporting the same catalogue with verified, source-referenced data.' },
];

export function AboutReference(props: AboutReferenceProps) {
  const { sections } = props;
  const copy = (key: string, field: 'heading' | 'subheading', fallback: string) =>
    sections[key]?.[field] ?? fallback;

  const totals = props.totals.filter((entry) => entry.value > 0);

  return (
    <div className="cref">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/about" aria-current="page">
            About
          </Link>
        </nav>
      </div>

      <section className="wrap about-hero">
        <div>
          <h1>{props.heading}</h1>
          <p className="lede">{props.lede}</p>
          <div className="hero-cta">
            <Link href="/universities" className="btn btn-primary btn-lg">
              Explore universities
            </Link>
            <Link href="/counselling" className="btn btn-outline btn-lg">
              Book free counselling
            </Link>
          </div>
        </div>
        <div className="about-illo" aria-hidden="true">
          <svg viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse
              cx="250"
              cy="200"
              rx="180"
              ry="120"
              stroke="#c7d9ff"
              strokeWidth="2"
              strokeDasharray="4 8"
            />
            <circle cx="250" cy="200" r="96" fill="url(#aboutGlobe)" />
            <ellipse
              cx="250"
              cy="200"
              rx="40"
              ry="96"
              stroke="#fff"
              strokeOpacity=".25"
              strokeWidth="2"
            />
            <path d="M154 200h192" stroke="#fff" strokeOpacity=".25" strokeWidth="2" />
            <path d="M168 160h164M168 240h164" stroke="#fff" strokeOpacity=".18" strokeWidth="2" />
            <circle cx="96" cy="96" r="20" fill="#fff" stroke="#dce7ff" strokeWidth="2" />
            <circle cx="404" cy="120" r="20" fill="#fff" stroke="#dce7ff" strokeWidth="2" />
            <circle cx="404" cy="290" r="20" fill="#fff" stroke="#dce7ff" strokeWidth="2" />
            <circle cx="96" cy="290" r="20" fill="#fff" stroke="#dce7ff" strokeWidth="2" />
            <defs>
              <linearGradient id="aboutGlobe" x1="154" y1="104" x2="346" y2="296">
                <stop stopColor="#2563eb" />
                <stop offset="1" stopColor="#132345" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </section>

      <main className="wrap">
        {/* MISSION & VISION */}
        <section className="sec" id="mission">
          <div className="sec-head">
            <span className="eyebrow">{copy('mission', 'subheading', 'What drives us')}</span>
            <h2>{copy('mission', 'heading', 'Our mission and vision')}</h2>
          </div>
          <div className="mv-grid">
            <div className="mv-card">
              <h3>Our mission</h3>
              <p>
                To make international education legible: published, source-referenced information
                about destinations, universities, courses and funding, with search and comparison
                tools that only ever show what the catalogue can actually support.
              </p>
            </div>
            <div className="mv-card vision">
              <h3>Our vision</h3>
              <p>
                A platform students can trust because nothing on it is estimated for effect —
                every figure traces back to a published record, and anything we do not know is
                left out rather than filled in.
              </p>
            </div>
          </div>
          {totals.length ? (
            <div className="statgrid" style={{ marginTop: 22 }}>
              {totals.map((entry) => (
                <div className="stat" key={entry.label}>
                  <b>{formatNumber(entry.value)}</b>
                  <span>{entry.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* WHY */}
        <section className="sec" id="why">
          <div className="sec-head">
            <span className="eyebrow">{copy('why', 'subheading', 'Why Universta')}</span>
            <h2>{copy('why', 'heading', 'What makes Universta different')}</h2>
            <p>One platform for the whole journey — built to be accurate before it is impressive.</p>
          </div>
          <div className="why">
            {WHY.map((item) => (
              <article className="wcard" key={item.h}>
                <h3>{item.h}</h3>
                <p>{item.p}</p>
              </article>
            ))}
          </div>
        </section>

        {/* JOURNEY */}
        <section className="sec" id="how">
          <div className="panel">
            <div className="sec-head">
              <span className="eyebrow">{copy('how', 'subheading', 'The journey')}</span>
              <h2>{copy('how', 'heading', 'How Universta helps students')}</h2>
              <p>From first search to arrival.</p>
            </div>
            <div className="timeline">
              {JOURNEY.map((step, index) => (
                <div className="tstep" key={step.h}>
                  <span className="n">{index + 1}</span>
                  <h3>{step.h}</h3>
                  <p>{step.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMMUNITY */}
        <section className="sec" id="community">
          <div className="sec-head">
            <span className="eyebrow">{copy('community', 'subheading', 'The ecosystem')}</span>
            <h2>{copy('community', 'heading', 'Our global community')}</h2>
            <p>Four groups around one shared goal — better global education.</p>
          </div>
          <div className="comm-grid">
            {COMMUNITY.map((item) => (
              <article className="card" key={item.h}>
                <h3 style={{ fontSize: 17 }}>{item.h}</h3>
                <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>{item.p}</p>
              </article>
            ))}
          </div>
          {totals.length ? (
            <div className="trust-strip">
              {totals.map((entry) => (
                <div className="ts" key={entry.label}>
                  <div className="v">{formatNumber(entry.value)}</div>
                  <div className="k">{entry.label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </main>

      <section className="sec wrap">
        <div className="final-cta">
          <h2>Start your global education journey</h2>
          <p>
            Browse destinations, shortlist courses and talk it through with a counsellor — all from
            one published catalogue.
          </p>
          <div className="hero-ctas">
            <Link href="/countries" className="btn btn-secondary btn-lg">
              Browse destinations
            </Link>
            <Link href="/counselling" className="btn btn-outline btn-lg">
              Book free counselling
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
