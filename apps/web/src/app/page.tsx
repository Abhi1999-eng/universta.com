import type { Metadata } from 'next';
import Link from 'next/link';
import { getCountries } from '@/lib/countries';
import { getCourses, getSubjects } from '@/lib/catalog';
import { SiteFooter, SiteHeader, SiteIcon } from '@/components/site/SiteChrome';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Universta — Study Abroad Made Simple',
  description: 'Explore published study destinations, subjects and courses, and book free counselling with Universta.',
};

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default async function Home() {
  const [countries, subjects, courseMeta] = await Promise.all([
    safe(getCountries({ limit: '6' }), { data: [], meta: { page: 1, limit: 6, total: 0, totalPages: 1 } }),
    safe(getSubjects({ limit: '6' }), { data: [], meta: { page: 1, limit: 6, total: 0, totalPages: 1 } }),
    safe(getCourses({ limit: '1' }), { data: [], meta: { page: 1, limit: 1, total: 0, totalPages: 1 } }),
  ]);
  const specializationCount = subjects.data.reduce((sum, item) => sum + item.publishedSubSubjectCount, 0);

  return (
    <main className="uv-page">
      <SiteHeader />
      <section className="uv-hero">
        <div className="uv-wrap uv-hero-grid">
          <div>
            <h1>Your Journey. Our Mission.<br />Study Abroad Made <em>Simple</em>.</h1>
            <p className="lede">Explore published study destinations, subjects and courses — and get free counselling to take the right next step.</p>
            <div className="uv-hero-badges">
              <div className="uv-hero-badge"><span className="ic"><SiteIcon name="globe" size={18} /></span><span><strong>Source-aware</strong>Published data only</span></div>
              <div className="uv-hero-badge"><span className="ic"><SiteIcon name="book" size={18} /></span><span><strong>{courseMeta.meta.total}</strong>Published courses</span></div>
              <div className="uv-hero-badge"><span className="ic"><SiteIcon name="cap" size={18} /></span><span><strong>Free</strong>Counselling</span></div>
            </div>
          </div>
          <div className="uv-hero-visual" aria-hidden="true"><SiteIcon name="globe" size={64} /></div>
        </div>
        <div className="uv-wrap">
          <div className="uv-search-hub">
            <div className="uv-search-tabs">
              <span className="uv-search-tab" aria-selected="true"><SiteIcon name="globe" size={16} />Find a destination</span>
            </div>
            <form className="uv-search-body" action="/countries" method="get">
              <div className="uv-search-field">
                <label htmlFor="home-country-q">Where do you want to study?</label>
                <input id="home-country-q" name="q" placeholder="Search published countries..." />
              </div>
              <div className="uv-search-field">
                <label htmlFor="home-subject-link">Which subject are you interested in?</label>
                <select id="home-subject-link" name="subject" defaultValue="">
                  <option value="">All subjects</option>
                  {subjects.data.map((subject) => <option value={subject.slug} key={subject.id}>{subject.name}</option>)}
                </select>
              </div>
              <button type="submit" className="uv-btn uv-btn-primary">Search <SiteIcon name="search" size={16} /></button>
            </form>
          </div>
        </div>
        <div className="uv-wrap uv-stat-grid">
          <div className="uv-stat"><div className="num">{countries.meta.total}</div><div className="lbl">Published countries</div></div>
          <div className="uv-stat"><div className="num">{subjects.meta.total}</div><div className="lbl">Published subjects</div></div>
          <div className="uv-stat"><div className="num">{specializationCount}</div><div className="lbl">Specializations</div></div>
          <div className="uv-stat"><div className="num">{courseMeta.meta.total}</div><div className="lbl">Published courses</div></div>
        </div>
      </section>

      <section className="uv-section uv-wrap" id="explore">
        <div className="uv-section-head"><h2>Explore the possibilities</h2><p>Start from a destination, a subject, or talk to us directly.</p></div>
        <div className="uv-explore-grid">
          <Link href="/countries" className="uv-explore-card">
            <span className="uv-explore-ic" style={{ background: 'var(--uv-blue)' }}><SiteIcon name="globe" size={22} /></span>
            <h3>Countries</h3><span className="num">{countries.meta.total}</span><span className="lbl">Published destinations</span>
          </Link>
          <Link href="/subjects" className="uv-explore-card">
            <span className="uv-explore-ic" style={{ background: 'var(--uv-green)' }}><SiteIcon name="book" size={22} /></span>
            <h3>Subjects</h3><span className="num">{subjects.meta.total}</span><span className="lbl">Published subjects</span>
          </Link>
          <Link href="/courses" className="uv-explore-card">
            <span className="uv-explore-ic" style={{ background: 'var(--uv-purple)' }}><SiteIcon name="book" size={22} /></span>
            <h3>Courses</h3><span className="num">{courseMeta.meta.total}</span><span className="lbl">Published programs</span>
          </Link>
          <Link href="/counselling" className="uv-explore-card">
            <span className="uv-explore-ic" style={{ background: 'var(--uv-orange)' }}><SiteIcon name="cap" size={22} /></span>
            <h3>Free Counselling</h3><span className="num">Book now</span><span className="lbl">Talk to our team</span>
          </Link>
        </div>
      </section>

      {countries.data.length ? (
        <section className="uv-section uv-wrap" id="popular-countries">
          <div className="uv-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div><h2>Popular study destinations</h2><p>Published countries you can explore right now.</p></div>
            <Link href="/countries" className="uv-btn uv-btn-outline uv-btn-sm">All countries <SiteIcon name="arrow" size={14} /></Link>
          </div>
          <div className="uv-grid uv-g3" style={{ marginTop: 20 }}>
            {countries.data.map((country) => (
              <Link href={`/countries/${country.slug}`} key={country.id} className="uv-card uv-dest-card">
                <div className="uv-dest-media">{country.flag ? <img src={country.flag.url} alt={country.flag.alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <SiteIcon name="globe" size={32} />}{country.featured ? <span className="uv-dest-badge">Featured</span> : null}</div>
                <div className="uv-dest-body">
                  <h3>{country.name}</h3>
                  <p className="meta">{country.continent.name}</p>
                  <span className="go">Explore <SiteIcon name="arrow" size={14} /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {subjects.data.length ? (
        <section className="uv-section uv-wrap" id="popular-subjects" style={{ background: '#fff', borderRadius: 'var(--uv-r-xl)', border: '1px solid var(--uv-line)' }}>
          <div className="uv-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
            <div><h2>Popular subjects</h2><p>Published subjects with real course and specialization counts.</p></div>
            <Link href="/subjects" className="uv-btn uv-btn-outline uv-btn-sm">All subjects <SiteIcon name="arrow" size={14} /></Link>
          </div>
          <div className="uv-grid uv-g3" style={{ marginTop: 20 }}>
            {subjects.data.map((subject) => (
              <Link href={`/subjects/${subject.slug}`} key={subject.id} className="uv-card uv-subj-card">
                <span className="uv-subj-ic"><SiteIcon name="book" size={20} /></span>
                <h3>{subject.name}</h3>
                <span className="cnt"><SiteIcon name="arrow" size={13} />{subject.publishedCourseCount} courses · {subject.publishedSubSubjectCount} specializations</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="uv-section uv-wrap" id="why">
        <div className="uv-section-head"><h2>Why students use Universta</h2></div>
        <div className="uv-why-grid">
          <div className="uv-why-card"><span className="uv-why-ic"><SiteIcon name="globe" size={18} /></span><div><h4>Published, source-aware data</h4><p>We only show published catalog records — no invented rankings, reviews or success rates.</p></div></div>
          <div className="uv-why-card"><span className="uv-why-ic"><SiteIcon name="book" size={18} /></span><div><h4>Real subjects &amp; courses</h4><p>Browse subjects, specializations and courses backed by structured, maintained catalog data.</p></div></div>
          <div className="uv-why-card"><span className="uv-why-ic"><SiteIcon name="cap" size={18} /></span><div><h4>Free counselling</h4><p>Talk to our team about your destination, subject and course options — no cost, no obligation.</p></div></div>
        </div>
      </section>

      <section className="uv-wrap" style={{ paddingBottom: 40 }}>
        <div className="uv-final-banner">
          <div><h2>Your Global Future Starts Here</h2><p>Explore, compare and book free counselling — start your study abroad journey with confidence.</p></div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/countries" className="uv-btn uv-btn-outline" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>Explore countries</Link>
            <Link href="/counselling" className="uv-btn uv-btn-orange">Book Free Counselling</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
