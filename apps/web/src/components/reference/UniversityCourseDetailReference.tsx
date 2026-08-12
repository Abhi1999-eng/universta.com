import Link from 'next/link';
import { counsellingHref } from '@/lib/counselling-link';
import { formatDate } from '@/lib/format';

/** The client-approved university course detail page.
 *
 * The template carries curriculum modules, learning objectives, faculty
 * profiles, graduate performance charts, hiring employers, industry
 * partnerships, campus experience and student paths. An offering record holds
 * its course, level, study mode, campus, duration, tuition, intakes and entry
 * requirements — so those blocks render and the rest are dropped rather than
 * invented. The jump nav is assembled from the blocks that rendered. */

export type CourseDetailProps = {
  university: { name: string; slug: string; country: string | null };
  offering: {
    name: string;
    slug: string;
    courseCode: string | null;
    shortDescription: string | null;
    overview: string | null;
    level: string | null;
    subject: { name: string; slug: string } | null;
    /** Generic course slug, so counselling booked here keeps its provenance. */
    courseSlug: string | null;
    subSubject: string | null;
    studyMode: string | null;
    campus: { name: string; city: string | null } | null;
    duration: string | null;
    tuition: string | null;
    tuitionPeriod: string | null;
    applicationUrl: string | null;
    sourceReference: string | null;
    verifiedAt: string | null;
  };
  intakes: Array<{ label: string; deadline: string | null; notes: string | null }>;
  requirements: Array<{
    category: string;
    title: string;
    description: string | null;
    minimumScore: string | null;
  }>;
  related: Array<{ name: string; slug: string; level: string | null; tuition: string | null }>;
};

const SKIP_WORDS = new Set(['of', 'in', 'and', 'the', 'for', 'a', 'an', '&']);

function initials(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word && !SKIP_WORDS.has(word.toLowerCase()));
  if (words.length === 0) return value.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function humanise(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function UniversityCourseDetailReference(props: CourseDetailProps) {
  const { university, offering, intakes, requirements, related } = props;

  const counselling = counsellingHref({
    source: offering.courseSlug ? 'course' : 'general',
    course: offering.courseSlug ?? undefined,
    from: `/universities/${university.slug}/courses/${offering.slug}`,
  });

  const facts = [
    offering.level && ['Level', offering.level],
    offering.duration && ['Duration', offering.duration],
    offering.tuition && ['Tuition', offering.tuition],
    offering.studyMode && ['Study mode', offering.studyMode],
    offering.campus?.name && ['Campus', offering.campus.name],
    offering.courseCode && ['Course code', offering.courseCode],
  ].filter(Boolean) as Array<[string, string]>;

  const nav = [
    offering.overview && ['overview', 'Overview'],
    facts.length && ['highlights', 'Key facts'],
    intakes.length && ['intakes', 'Intakes'],
    requirements.length && ['admission', 'Entry requirements'],
    offering.tuition && ['cost', 'Cost'],
    related.length && ['other', 'Other programmes'],
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <div className="cref cref-subj">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <Link href="/universities">Universities</Link> ›{' '}
          <Link href={`/universities/${university.slug}`}>{university.name}</Link> ›{' '}
          <Link href={`/universities/${university.slug}/courses`}>Courses</Link> ›{' '}
          <span aria-current="page">{offering.name}</span>
        </nav>
      </div>

      {/* HERO */}
      <section className="wrap" style={{ paddingTop: 8 }}>
        <div className="hero-banner">
          <span className="hero-parent">
            {university.name}
            {university.country ? ` · ${university.country}` : ''}
          </span>
          <h1>{offering.name}</h1>
          {offering.shortDescription ? <p className="lede">{offering.shortDescription}</p> : null}
          <div className="hero-metrics">
            {facts.slice(0, 5).map(([label, value]) => (
              <div className="hm" key={label}>
                <div className="v">{value}</div>
                <div className="k">{label}</div>
              </div>
            ))}
          </div>
          <div className="hero-cta">
            {offering.applicationUrl ? (
              <a
                className="btn btn-white btn-lg"
                href={offering.applicationUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Apply on the university site
              </a>
            ) : null}
            <Link href={counselling} className="btn btn-glass btn-lg">
              Book free counselling
            </Link>
          </div>
        </div>
      </section>

      <div className="wrap layout" style={{ paddingTop: 32 }}>
        <main className="main">
          {/* OVERVIEW */}
          {offering.overview ? (
            <section className="block" id="overview" style={{ paddingTop: 28 }}>
              <div className="block-head">
                <span className="eyebrow">Overview</span>
                <h2>About this programme</h2>
              </div>
              <div className="prose">
                {offering.overview.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : null}

          {/* KEY FACTS */}
          {facts.length ? (
            <section className="block" id="highlights">
              <div className="block-head">
                <span className="eyebrow">Snapshot</span>
                <h2>Key facts</h2>
              </div>
              <div className="kpi-grid">
                {facts.map(([label, value]) => (
                  <div className="kpi" key={label}>
                    <div className="kk">{label}</div>
                    <div className="kv">{value}</div>
                  </div>
                ))}
              </div>
              {offering.subject ? (
                <p style={{ marginTop: 18 }}>
                  {/* Entity names of any length land here, so this one wraps
                      instead of pushing the page sideways on a phone. */}
                  <Link className="link-more wrap" href={`/subjects/${offering.subject.slug}`}>
                    Explore {offering.subject.name}
                    {offering.subSubject ? ` · ${offering.subSubject}` : ''} →
                  </Link>
                </p>
              ) : null}
            </section>
          ) : null}

          {/* INTAKES */}
          {intakes.length ? (
            <section className="block" id="intakes">
              <div className="block-head">
                <span className="eyebrow">Timeline</span>
                <h2>Intakes and deadlines</h2>
                <p className="sub">Application windows recorded against this programme.</p>
              </div>
              <div className="grid g3">
                {intakes.map((intake) => (
                  <article className="card" key={`${intake.label}-${intake.deadline ?? ''}`}>
                    <h3 style={{ fontSize: 18 }}>{intake.label}</h3>
                    <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>
                      {intake.deadline
                        ? `Apply by ${formatDate(intake.deadline)}`
                        : 'Deadline not published'}
                    </p>
                    {intake.notes ? (
                      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 8 }}>
                        {intake.notes}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* REQUIREMENTS */}
          {requirements.length ? (
            <section className="block" id="admission">
              <div className="block-head">
                <span className="eyebrow">Getting in</span>
                <h2>Entry requirements</h2>
                <p className="sub">Published requirements for this specific programme.</p>
              </div>
              <div className="grid g2">
                {requirements.map((requirement) => (
                  <article className="card spec-card" key={requirement.title}>
                    <span className="spec-ic" aria-hidden="true">
                      {initials(humanise(requirement.category))}
                    </span>
                    <div>
                      <div className="sn">{requirement.title}</div>
                      <div className="sd">
                        {humanise(requirement.category)}
                        {requirement.minimumScore ? ` · minimum ${requirement.minimumScore}` : ''}
                      </div>
                      {requirement.description ? (
                        <div className="sd" style={{ marginTop: 4 }}>
                          {requirement.description}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* COST */}
          {offering.tuition ? (
            <section className="block" id="cost">
              <div className="block-head">
                <span className="eyebrow">Budget</span>
                <h2>Cost</h2>
              </div>
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="kk">Tuition</div>
                  <div className="kv">{offering.tuition}</div>
                </div>
                {offering.tuitionPeriod ? (
                  <div className="kpi">
                    <div className="kk">Charged</div>
                    <div className="kv">{humanise(offering.tuitionPeriod)}</div>
                  </div>
                ) : null}
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 14 }}>
                Published figure
                {offering.verifiedAt ? `, verified ${formatDate(offering.verifiedAt)}` : ''}. Confirm
                the exact fee with {university.name} before you apply.
              </p>
            </section>
          ) : null}

          {/* OTHER PROGRAMMES */}
          {related.length ? (
            <section className="block" id="other">
              <div className="block-head row-between">
                <div>
                  <span className="eyebrow">Also at this university</span>
                  <h2>Other programmes</h2>
                </div>
                <Link className="link-more" href={`/universities/${university.slug}/courses`}>
                  All programmes →
                </Link>
              </div>
              <div className="grid g2">
                {related.map((item) => (
                  <Link
                    key={item.slug}
                    className="card course-chip"
                    href={`/universities/${university.slug}/courses/${item.slug}`}
                  >
                    <span className="cc-ic" aria-hidden="true">
                      {initials(item.level ?? item.name)}
                    </span>
                    <div>
                      <div className="cn">{item.name}</div>
                      <div className="cs">
                        {[item.level, item.tuition].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span className="go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* CTA */}
          <section className="block">
            <div className="final-cta">
              <h2>Ready to apply?</h2>
              <p>
                Check the intake deadline and entry requirements above, then talk it through with a
                counsellor before you submit.
              </p>
              <div className="hero-ctas">
                {offering.applicationUrl ? (
                  <a
                    className="btn btn-secondary btn-lg"
                    href={offering.applicationUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Apply on the university site
                  </a>
                ) : null}
                <Link href={counselling} className="btn btn-outline btn-lg">
                  Book free counselling
                </Link>
              </div>
            </div>
          </section>
        </main>

        <aside className="side">
          <div className="side-card">
            <h3>Talk it through</h3>
            <p>A counsellor can check your profile against this programme’s requirements.</p>
            <Link className="btn btn-primary btn-block" href={counselling}>
              Book free counselling
            </Link>
          </div>
          {nav.length ? (
            <div className="side-card">
              <h3>On this page</h3>
              <div className="side-links">
                {nav.map(([id, label]) => (
                  <a key={id} href={`#${id}`}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          {offering.sourceReference ? (
            <div className="side-card">
              <h3>Source</h3>
              <p style={{ marginBottom: 0, wordBreak: 'break-word' }}>
                Published from{' '}
                <a
                  href={offering.sourceReference}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ color: 'var(--blue)' }}
                >
                  the university’s own listing
                </a>
                {offering.verifiedAt ? `, verified ${formatDate(offering.verifiedAt)}` : ''}.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
