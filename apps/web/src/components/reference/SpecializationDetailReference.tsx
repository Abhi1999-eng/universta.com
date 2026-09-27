import Link from 'next/link';
import type { SpecializationDetail } from '@/lib/catalog';
import { RichText } from '@/components/phase1/RichText';

/**
 * A specialization's own page, at /subjects/<subject>/<specialization>.
 *
 * It is addressed inside its subject because that is what makes it unique:
 * "Animal Science" is taught under Agriculture, under Science and under
 * Biological & Life Sciences, and those are three different pages. Every link
 * out of here keeps the pair together for the same reason.
 *
 * Sections stand down rather than render empty. A specialization with no
 * destinations recorded yet is a normal state -- 927 of these arrived at once
 * and the editorial work behind them lands over time -- so the page has to
 * read as finished at every stage of that, not as a set of blank panels.
 */
export function SpecializationDetailReference({
  specialization,
}: {
  specialization: SpecializationDetail;
}) {
  const { subject, siblings, countries } = specialization;
  const subjectPath = `/subjects/${subject.slug}`;
  const overview = specialization.overview?.trim();

  const nav = [
    ['about', `About ${specialization.name}`],
    countries.length && ['destinations', 'Where you can study it'],
    siblings.length && ['related', 'Related specialisations'],
    ['plan', 'Plan your application'],
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <div className="cref cref-subj">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <Link href="/subjects">Subjects</Link> ›{' '}
          <Link href={subjectPath}>{subject.name}</Link> ›{' '}
          <span aria-current="page">{specialization.name}</span>
        </nav>
      </div>

      <section className="wrap" style={{ paddingTop: 8 }}>
        <div className="hero-banner">
          <span className="hero-parent">
            <Link href={subjectPath}>{subject.name}</Link>
          </span>
          <h1>{specialization.name}</h1>
          {specialization.shortDescription ? (
            <p className="lede">{specialization.shortDescription}</p>
          ) : null}
          <div className="hero-metrics">
            <div className="hm">
              <div className="v">{countries.length || '—'}</div>
              <div className="k">
                {countries.length === 1 ? 'Destination' : 'Destinations'}
              </div>
            </div>
            <div className="hm">
              <div className="v">{siblings.length + 1}</div>
              <div className="k">In this subject</div>
            </div>
          </div>
          <div className="hero-cta">
            <Link
              href={`/courses?subject=${subject.slug}#discovery`}
              className="btn btn-white btn-lg"
            >
              Explore {subject.name} courses
            </Link>
            <Link
              href={`${subjectPath}/specializations`}
              className="btn btn-glass btn-lg"
            >
              All {subject.name} specialisations
            </Link>
          </div>
        </div>
      </section>

      <div className="wrap layout" style={{ paddingTop: 32 }}>
        <main className="main">
          <section className="block" id="about" style={{ paddingTop: 28 }}>
            <div className="block-head">
              <span className="eyebrow">Overview</span>
              <h2>About {specialization.name}</h2>
            </div>
            {overview ? (
              <div className="prose">
                <RichText value={overview} />
              </div>
            ) : (
              <p className="prose">
                {specialization.name} is a specialisation within{' '}
                <Link href={subjectPath}>{subject.name}</Link>
                {subject.shortDescription
                  ? `. ${subject.shortDescription}`
                  : '.'}
              </p>
            )}
          </section>

          {countries.length ? (
            <section className="block" id="destinations">
              <div className="block-head">
                <span className="eyebrow">Destinations</span>
                <h2>Where you can study {specialization.name}</h2>
              </div>
              <div className="chip-row">
                {countries.map((country) => (
                  <Link
                    key={country.id}
                    href={`/study-abroad/${country.slug}`}
                    className="chip"
                  >
                    {country.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {siblings.length ? (
            <section className="block" id="related">
              <div className="block-head">
                <span className="eyebrow">Related</span>
                <h2>Other {subject.name} specialisations</h2>
              </div>
              <div className="chip-row">
                {siblings.map((sibling) => (
                  <Link
                    key={sibling.id}
                    href={`${subjectPath}/${sibling.slug}`}
                    className="chip"
                  >
                    {sibling.name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section className="block" id="plan">
            <div className="block-head">
              <span className="eyebrow">Next step</span>
              <h2>Plan your application</h2>
            </div>
            <p className="prose">
              Entry requirements, tuition and intakes are set by the university
              rather than by the specialisation, so the destination guide is
              where those numbers live.
            </p>
            <div className="hero-cta">
              <Link href="/study-abroad" className="btn btn-primary btn-lg">
                Compare destinations
              </Link>
              <Link href="/contact" className="btn btn-outline btn-lg">
                Talk to a consultant
              </Link>
            </div>
          </section>
        </main>

        <aside className="side" aria-label="On this page">
          <nav className="toc">
            <p className="toc-title">On this page</p>
            <ul>
              {nav.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </div>
  );
}
