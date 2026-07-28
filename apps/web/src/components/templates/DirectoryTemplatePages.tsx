import Link from 'next/link';
import { CatalogFooter, CatalogHeader, Icon } from './ApprovedTemplatePages';
import { counsellingHref } from '@/lib/counselling-link';
import { CompareCheckbox, CompareTray } from '@/components/compare/CompareWidgets';
import type { Country } from '@/lib/countries';

// The phase1 API returns loosely-shaped JSON per resource; these types
// describe only the fields the templates below actually render.
type Named = { name?: string; slug?: string; city?: string; state?: string };
export type Offering = {
  id: string;
  name?: string;
  slug?: string;
  courseCode?: string;
  shortDescription?: string;
  overview?: string;
  studyMode?: string;
  durationMin?: string | number;
  durationMax?: string | number;
  durationUnit?: string;
  tuitionMin?: string | number;
  tuitionMax?: string | number;
  currencyCode?: string;
  tuitionPeriod?: string;
  applicationUrl?: string;
  sourceReference?: string;
  verifiedAt?: string | null;
  university?: Named & { country?: Named };
  campus?: Named;
  genericCourse?: { name?: string; subject?: Named; subSubject?: Named; courseLevel?: Named };
  intakes?: Array<{ intake?: Named; deadline?: string | null; notes?: string | null }>;
  requirements?: Array<{ id: string; category?: string; title?: string; description?: string; minimumScore?: string | number }>;
};
export type University = {
  id: string;
  name: string;
  slug: string;
  institutionType?: string;
  shortDescription?: string;
  overview?: string;
  sourceReference?: string;
  verifiedAt?: string | null;
  isFeatured?: boolean;
  country?: Named;
  campuses?: Array<{ id: string; name?: string; city?: string; state?: string; address?: string; overview?: string }>;
  accreditations?: Array<{ id: string; name?: string; accreditor?: string; referenceUrl?: string }>;
  offerings?: Offering[];
  _count?: { offerings?: number };
};
export type Scholarship = {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  description?: string;
  benefitType?: string;
  amount?: string | number;
  currencyCode?: string;
  eligibility?: string;
  deadline?: string | null;
  applicationUrl?: string;
  sourceReference?: string;
  verifiedAt?: string | null;
  isFeatured?: boolean;
  provider?: { name?: string; slug?: string; websiteUrl?: string };
  countries?: Array<{ country?: Named }>;
  universities?: Array<{ university?: Named }>;
  offerings?: Array<{ offering?: Offering }>;
};
export type Consultant = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  verificationStatus?: string;
  sourceReference?: string;
  verifiedAt?: string | null;
  isFeatured?: boolean;
  locations?: Array<{ location?: Named & { country?: Named } }>;
  countries?: Array<{ country?: Named }>;
  services?: Array<{ id: string; name?: string }>;
  languages?: Array<{ id: string; name?: string }>;
};
export type ConsultantLocationRow = {
  id: string;
  name: string;
  slug: string;
  city?: string;
  state?: string;
  overview?: string;
  country?: Named;
  consultants?: Array<{ consultant?: Consultant }>;
};
export type PageMeta = { page: number; total: number; totalPages: number };

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'U';
}
function money(value: string | number | undefined | null, currency: string | undefined | null) {
  if (value === undefined || value === null || !currency) return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value));
  } catch {
    return `${currency} ${value}`;
  }
}
function dateFmt(value: string | Date | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}
function duration(offering: Offering) {
  if (!offering.durationMin) return null;
  const unit = (offering.durationUnit ?? '').toLowerCase();
  return offering.durationMax && offering.durationMax !== offering.durationMin
    ? `${offering.durationMin}–${offering.durationMax} ${unit}`
    : `${offering.durationMin} ${unit}`;
}

/* ---------- shared sidebar widgets ---------- */

function CounsellingCard({ from, heading }: { from: string; heading: React.ReactNode }) {
  return (
    <div className="dir-cta-card">
      <span className="hero-pill" style={{ marginBottom: 0 }}>
        <span className="dot" />Free guidance
      </span>
      <h3>{heading}</h3>
      <ul className="dir-cta-benefits">
        <li><Icon name="check" size={15} />Personalised guidance</li>
        <li><Icon name="check" size={15} />Application support</li>
        <li><Icon name="check" size={15} />100% free of cost</li>
      </ul>
      <Link href={counsellingHref({ source: 'general', from })} className="btn btn-primary btn-block" style={{ width: '100%', justifyContent: 'center' }}>
        <Icon name="calendar" size={16} />Book free counselling
      </Link>
      <div className="dir-cta-avatars">
        <div className="dir-avatar-stack">
          <span>A</span><span>R</span><span>S</span><span>D</span>
        </div>
        <small>10K+ students counselled</small>
      </div>
    </div>
  );
}

function FactsCard({ title, rows }: { title: string; rows: Array<[string, string | null | undefined]> }) {
  const shown = rows.filter((row): row is [string, string] => Boolean(row[1]));
  if (!shown.length) return null;
  return (
    <div className="dir-facts-card">
      <h4>{title}</h4>
      {shown.map(([label, value]) => (
        <div className="dir-fact-row" key={label}><span>{label}</span><strong>{value}</strong></div>
      ))}
    </div>
  );
}

function Tabs({ items, active }: { items: Array<[string, string]>; active?: string }) {
  return (
    <nav className="dir-tabs" aria-label="Section navigation">
      <div className="wrap dir-tabs-inner">
        {items.map(([label, href]) => (
          <a href={href} className={`dir-tab${active === href ? ' active' : ''}`} key={href}>{label}</a>
        ))}
      </div>
    </nav>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="template-empty">
      <h3>{label}</h3>
      <p>Published information will appear here when it is available.</p>
    </div>
  );
}

/* ================= University ================= */

export function UniversityListing({
  universities,
  meta,
  countries,
  filters,
}: {
  universities: University[];
  meta: PageMeta;
  countries: Country[];
  filters: Record<string, string>;
}) {
  return (
    <main className="visual-courses-page visual-directory-page">
      <CatalogHeader active="universities" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li>Universities</li></ol></nav></div>
      <section className="hero dir-hero">
        <div className="wrap">
          <div className="dir-hero-media">
            <div className="dir-hero-panel">
              <span className="hero-pill"><span className="dot" /><b>{meta.total}</b> published universities</span>
              <h1>Find the Right <span>University</span></h1>
              <p className="lede">Explore published universities and compare real campuses, courses and intakes.</p>
              <form className="search-shell" action="/universities">
                <div className="search-box"><Icon name="search" /><input name="q" defaultValue={filters.q ?? ''} placeholder="Search by university name" aria-label="Search universities" /><button className="btn btn-primary" type="submit">Search</button></div>
              </form>
            </div>
            <div className="dir-hero-img" />
          </div>
        </div>
      </section>
      <div className="wrap discovery" style={{ marginTop: 28 }}>
        <aside className="dir-facts-card" style={{ alignSelf: 'start' }}>
          <h4>Filters</h4>
          <form action="/universities" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate)' }}>
              Country
              <select name="country" defaultValue={filters.country ?? ''} className="select" style={{ width: '100%', marginTop: 6 }}>
                <option value="">All countries</option>
                {countries.map((country) => <option value={country.slug} key={country.slug}>{country.name}</option>)}
              </select>
            </label>
            <button type="submit" className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>Apply</button>
            {Object.keys(filters).length ? <Link href="/universities" style={{ fontSize: 13, color: 'var(--blue)', textAlign: 'center', fontWeight: 600 }}>Clear all</Link> : null}
          </form>
        </aside>
        <div>
          <div className="results-bar"><span className="results-count"><b>{meta.total}</b> published universities</span></div>
          {universities.length ? (
            <div className="course-list">
              {universities.map((university) => (
                <article className="card dir-card" key={university.id}>
                  <div className="dir-card-logo">{initials(university.name)}</div>
                  <div className="dir-card-body">
                    <h3>
                      <Link href={`/universities/${university.slug}`}>{university.name}</Link>
                      {university.verifiedAt ? <Icon name="check" size={16} /> : null}
                    </h3>
                    <div className="dir-loc">{university.country?.name ? <><Icon name="globe" size={13} />{university.country.name}</> : null}</div>
                    <div className="dir-tags">
                      {university.isFeatured ? <span className="dir-tag featured">Featured</span> : null}
                      {university.institutionType ? <span className="dir-tag">{university.institutionType}</span> : null}
                    </div>
                    <p className="dir-desc">{university.shortDescription ?? 'Published university profile.'}</p>
                    <div className="dir-stats-row">
                      <div className="dir-stat-mini"><b>{university.campuses?.length ?? 0}</b>Campuses</div>
                      <div className="dir-stat-mini"><b>{university._count?.offerings ?? 0}</b>Courses</div>
                    </div>
                  </div>
                  <div className="dir-card-actions">
                    <Link href={`/universities/${university.slug}`} className="btn btn-secondary btn-sm">View details</Link>
                    <CompareCheckbox type="universities" slug={university.slug} label={university.name} />
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState label="No universities are currently published" />}
          {meta.totalPages > 1 ? (
            <nav className="pagination" aria-label="Pages" style={{ marginTop: 20, textAlign: 'center', color: 'var(--muted)' }}>
              Page {meta.page} of {meta.totalPages}
            </nav>
          ) : null}
        </div>
      </div>
      <CatalogFooter />
      <CompareTray type="universities" />
    </main>
  );
}

export function UniversityDetail({ university }: { university: University }) {
  const offerings = university.offerings ?? [];
  const campuses = university.campuses ?? [];
  const accreditations = university.accreditations ?? [];
  const tabs: Array<[string, string]> = [
    ['Overview', '#overview'],
    ...(offerings.length ? [['Courses', '#courses'] as [string, string]] : []),
    ...(campuses.length ? [['Campuses', '#campuses'] as [string, string]] : []),
    ...(accreditations.length ? [['Accreditations', '#accreditations'] as [string, string]] : []),
  ];
  return (
    <main className="visual-courses-page visual-directory-page">
      <CatalogHeader active="universities" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li><Link href="/universities">Universities</Link></li><li className="sep">/</li><li aria-current="page">{university.name}</li></ol></nav></div>
      <div className="wrap">
        <div className="dir-detail-top">
          <div>
            <div className="dir-detail-heading">
              <div className="dir-logo-lg">{initials(university.name)}</div>
              <div>
                <h1>{university.name}{university.verifiedAt ? <Icon name="check" /> : null}</h1>
                <div className="dir-loc">{university.country?.name ? <><Icon name="globe" size={14} />{university.country.name}</> : null}</div>
                <div className="dir-tags">
                  {university.isFeatured ? <span className="dir-tag featured">Featured</span> : null}
                  {university.institutionType ? <span className="dir-tag">{university.institutionType}</span> : null}
                </div>
              </div>
            </div>
            <div className="dir-detail-actions">
              <CompareCheckbox type="universities" slug={university.slug} label={university.name} />
              {university.sourceReference ? <a href={university.sourceReference} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">View source</a> : null}
            </div>
          </div>
          <div className="dir-detail-media" />
        </div>
      </div>
      <Tabs items={tabs} />
      <div className="wrap dir-layout">
        <div className="dir-main">
          <section className="dir-block" id="overview">
            <div className="dir-block-head"><span className="eyebrow">Overview</span><h2>About {university.name}</h2></div>
            <div className="dir-stats">
              <div className="dir-stat"><div className="dir-stat-ic"><Icon name="home" /></div><div><div className="dir-stat-v">{campuses.length}</div><div className="dir-stat-k">Campuses</div></div></div>
              <div className="dir-stat"><div className="dir-stat-ic"><Icon name="book" /></div><div><div className="dir-stat-v">{university._count?.offerings ?? offerings.length}</div><div className="dir-stat-k">Published courses</div></div></div>
              <div className="dir-stat"><div className="dir-stat-ic"><Icon name="shield" /></div><div><div className="dir-stat-v">{accreditations.length}</div><div className="dir-stat-k">Accreditations</div></div></div>
            </div>
            <p style={{ color: 'var(--slate)', fontSize: 15, marginTop: 16 }}>{university.overview ?? university.shortDescription ?? 'No further overview is published for this university yet.'}</p>
          </section>
          {offerings.length ? (
            <section className="dir-block" id="courses">
              <div className="dir-block-head row-between"><div><span className="eyebrow">Published programs</span><h2>Courses at {university.name}</h2></div><Link href={`/universities/${university.slug}/courses`} className="link-more">All courses <Icon name="arrow" size={16} /></Link></div>
              <div className="course-list">
                {offerings.slice(0, 5).map((offering) => (
                  <article className="course" key={offering.id}>
                    <div className="course-top">
                      <div className="uni-logo">{initials(offering.genericCourse?.subject?.name ?? offering.name ?? 'C')}</div>
                      <div className="course-head">
                        <div className="course-badges">{offering.genericCourse?.courseLevel?.name ? <span className="badge badge-lvl">{offering.genericCourse.courseLevel.name}</span> : null}</div>
                        <h3><Link href={`/universities/${university.slug}/courses/${offering.slug}`}>{offering.name}</Link></h3>
                        <div className="uni">{offering.genericCourse?.subject?.name}{offering.campus?.name ? ` · ${offering.campus.name}` : ''}</div>
                      </div>
                    </div>
                    <div className="course-facts">
                      <div className="fact"><div className="k"><Icon name="clock" size={13} />Duration</div><div className="v">{duration(offering) ?? 'Not published'}</div></div>
                      <div className="fact"><div className="k"><Icon name="money" size={13} />Tuition</div><div className="v">{money(offering.tuitionMin, offering.currencyCode) ?? 'Not published'}</div></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {campuses.length ? (
            <section className="dir-block" id="campuses">
              <div className="dir-block-head"><span className="eyebrow">Locations</span><h2>Campuses</h2></div>
              <div className="grid g2">
                {campuses.map((campus) => (
                  <div className="card" key={campus.id}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{campus.name}</h3>
                    <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6 }}>{[campus.city, campus.state].filter(Boolean).join(', ') || 'Location not published'}</p>
                    {campus.overview ? <p style={{ color: 'var(--slate)', fontSize: 13.5, marginTop: 8 }}>{campus.overview}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {accreditations.length ? (
            <section className="dir-block" id="accreditations">
              <div className="dir-block-head"><span className="eyebrow">Verification</span><h2>Accreditations</h2></div>
              <ul className="dir-benefits">
                {accreditations.map((item) => (
                  <li key={item.id}><Icon name="shield" size={18} /><span><strong>{item.name}</strong>{item.accreditor ? ` — ${item.accreditor}` : ''}</span></li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <aside className="dir-side">
          <CounsellingCard from={`/universities/${university.slug}`} heading={<>Ready to take the next step? Get <span>free</span> counselling</>} />
          <FactsCard title="At a glance" rows={[
            ['Location', university.country?.name],
            ['Type', university.institutionType],
            ['Campuses', String(campuses.length)],
            ['Published courses', String(university._count?.offerings ?? offerings.length)],
          ]} />
        </aside>
      </div>
      <CatalogFooter />
      <CompareTray type="universities" />
    </main>
  );
}

export function UniversityCoursesListing({
  university,
  offerings,
  meta,
}: {
  university: { name: string; slug: string };
  offerings: Offering[];
  meta: PageMeta;
}) {
  return (
    <main className="visual-courses-page visual-directory-page">
      <CatalogHeader active="universities" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li><Link href="/universities">Universities</Link></li><li className="sep">/</li><li><Link href={`/universities/${university.slug}`}>{university.name}</Link></li><li className="sep">/</li><li aria-current="page">Courses</li></ol></nav></div>
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <span className="eyebrow">{university.name}</span>
          <h1 style={{ fontSize: 'clamp(26px,3.6vw,38px)', fontWeight: 800, marginTop: 8 }}>Courses at {university.name}</h1>
          <p style={{ color: 'var(--muted)', marginTop: 10 }}>{meta.total} published course{meta.total === 1 ? '' : 's'}.</p>
        </div>
      </section>
      <div className="wrap">
        {offerings.length ? (
          <div className="course-list">
            {offerings.map((offering) => (
              <article className="course" key={offering.id}>
                <div className="course-top">
                  <div className="uni-logo">{initials(offering.genericCourse?.subject?.name ?? offering.name ?? 'C')}</div>
                  <div className="course-head">
                    <div className="course-badges">{offering.genericCourse?.courseLevel?.name ? <span className="badge badge-lvl">{offering.genericCourse.courseLevel.name}</span> : null}</div>
                    <h3><Link href={`/universities/${university.slug}/courses/${offering.slug}`}>{offering.name}</Link></h3>
                    <div className="uni">{offering.genericCourse?.subject?.name}{offering.campus?.name ? ` · ${offering.campus.name}` : ''}</div>
                  </div>
                </div>
                <div className="course-facts">
                  <div className="fact"><div className="k"><Icon name="clock" size={13} />Duration</div><div className="v">{duration(offering) ?? 'Not published'}</div></div>
                  <div className="fact"><div className="k"><Icon name="money" size={13} />Tuition</div><div className="v">{money(offering.tuitionMin, offering.currencyCode) ?? 'Not published'}</div></div>
                  <div className="fact"><div className="k"><Icon name="home" size={13} />Study mode</div><div className="v">{offering.studyMode ?? 'Not published'}</div></div>
                </div>
                <div className="course-foot"><div className="spacer" /><Link href={`/universities/${university.slug}/courses/${offering.slug}`} className="btn btn-primary btn-sm">View course <Icon name="arrow" size={15} /></Link></div>
              </article>
            ))}
          </div>
        ) : <EmptyState label="No courses are currently published for this university" />}
      </div>
      <CatalogFooter />
    </main>
  );
}

export function UniversityCourseDetail({ offering }: { offering: Offering }) {
  const requirements = offering.requirements ?? [];
  const intakes = offering.intakes ?? [];
  return (
    <main className="visual-courses-page visual-directory-page">
      <CatalogHeader active="universities" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li><Link href="/universities">Universities</Link></li><li className="sep">/</li><li><Link href={`/universities/${offering.university?.slug}`}>{offering.university?.name}</Link></li><li className="sep">/</li><li aria-current="page">{offering.name}</li></ol></nav></div>
      <div className="wrap">
        <div className="dir-detail-heading" style={{ marginTop: 20 }}>
          <div className="dir-logo-lg">{initials(offering.university?.name ?? offering.name ?? 'C')}</div>
          <div>
            <h1>{offering.name}</h1>
            <div className="dir-loc">{offering.university?.name}{offering.campus?.name ? <><span className="sep">·</span>{offering.campus.name}</> : null}</div>
            <div className="dir-tags">
              {offering.genericCourse?.courseLevel?.name ? <span className="dir-tag featured">{offering.genericCourse.courseLevel.name}</span> : null}
              {offering.genericCourse?.subject?.name ? <span className="dir-tag">{offering.genericCourse.subject.name}</span> : null}
            </div>
          </div>
        </div>
        <div className="dir-detail-actions">
          {offering.applicationUrl ? <a href={offering.applicationUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Apply now</a> : null}
          <Link href={counsellingHref({ source: 'general', from: `/universities/${offering.university?.slug}/courses/${offering.slug}` })} className="btn btn-outline">Talk to a counsellor</Link>
        </div>
      </div>
      <div className="wrap dir-layout" style={{ marginTop: 28 }}>
        <div className="dir-main">
          <section className="dir-block">
            <div className="dir-block-head"><span className="eyebrow">Overview</span><h2>About this course</h2></div>
            <div className="dir-stats">
              <div className="dir-stat"><div className="dir-stat-ic"><Icon name="clock" /></div><div><div className="dir-stat-v">{duration(offering) ?? 'Not published'}</div><div className="dir-stat-k">Duration</div></div></div>
              <div className="dir-stat"><div className="dir-stat-ic"><Icon name="money" /></div><div><div className="dir-stat-v">{money(offering.tuitionMin, offering.currencyCode) ?? 'Not published'}</div><div className="dir-stat-k">Tuition</div></div></div>
              <div className="dir-stat"><div className="dir-stat-ic"><Icon name="home" /></div><div><div className="dir-stat-v">{offering.studyMode ?? 'Not published'}</div><div className="dir-stat-k">Study mode</div></div></div>
            </div>
            <p style={{ color: 'var(--slate)', fontSize: 15, marginTop: 16 }}>{offering.overview ?? offering.shortDescription ?? 'No further overview is published for this course yet.'}</p>
          </section>
          {requirements.length ? (
            <section className="dir-block">
              <div className="dir-block-head"><span className="eyebrow">Admissions</span><h2>Entry requirements</h2></div>
              <ul className="dir-benefits">
                {requirements.map((item) => (
                  <li key={item.id}><Icon name="check" size={18} /><span><strong>{item.title}</strong>{item.description ? ` — ${item.description}` : ''}</span></li>
                ))}
              </ul>
            </section>
          ) : null}
          {intakes.length ? (
            <section className="dir-block">
              <div className="dir-block-head"><span className="eyebrow">Availability</span><h2>Intakes</h2></div>
              <div className="grid g3">
                {intakes.map((item, index) => (
                  <div className="card" key={index}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{item.intake?.name ?? item.intake?.slug ?? 'Intake'}</h3>
                    <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6 }}>{dateFmt(item.deadline) ?? item.notes ?? 'Deadline not published'}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <aside className="dir-side">
          <CounsellingCard from={`/universities/${offering.university?.slug}/courses/${offering.slug}`} heading={<>Not sure which course is right for you? Get <span>free</span> counselling</>} />
          <FactsCard title="At a glance" rows={[
            ['University', offering.university?.name],
            ['Campus', offering.campus?.name],
            ['Course level', offering.genericCourse?.courseLevel?.name],
            ['Subject', offering.genericCourse?.subject?.name],
          ]} />
        </aside>
      </div>
      <CatalogFooter />
    </main>
  );
}

/* ================= Scholarship ================= */

export function ScholarshipListing({ scholarships, meta, filters }: { scholarships: Scholarship[]; meta: PageMeta; filters: Record<string, string> }) {
  return (
    <main className="visual-courses-page visual-directory-page">
      <CatalogHeader active="scholarships" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li>Scholarships</li></ol></nav></div>
      <section className="hero dir-hero">
        <div className="wrap hero-inner">
          <span className="hero-pill"><span className="dot" /><b>{meta.total}</b> published scholarships</span>
          <h1>Find Scholarships to Fund Your <span>Future</span></h1>
          <p className="lede">Explore published scholarships and compare award amounts, deadlines and eligibility.</p>
          <form className="search-shell" action="/scholarships">
            <div className="search-box"><Icon name="search" /><input name="q" defaultValue={filters.q ?? ''} placeholder="Search scholarships by name" aria-label="Search scholarships" /><button className="btn btn-primary" type="submit">Search</button></div>
          </form>
        </div>
      </section>
      <div className="wrap" style={{ marginTop: 28 }}>
        <div className="results-bar"><span className="results-count"><b>{meta.total}</b> published scholarships</span></div>
        {scholarships.length ? (
          <div className="course-list">
            {scholarships.map((scholarship) => (
              <article className="card dir-card" key={scholarship.id}>
                <div className="dir-card-logo"><Icon name="cap" size={24} /></div>
                <div className="dir-card-body">
                  <h3><Link href={`/scholarships/${scholarship.slug}`}>{scholarship.title}</Link></h3>
                  <div className="dir-loc">{scholarship.provider?.name ?? 'Provider not published'}</div>
                  <div className="dir-tags">
                    {scholarship.isFeatured ? <span className="dir-tag featured">Featured</span> : null}
                    {scholarship.benefitType ? <span className="dir-tag">{scholarship.benefitType.replaceAll('_', ' ')}</span> : null}
                  </div>
                  <p className="dir-desc">{scholarship.summary ?? 'Published scholarship record.'}</p>
                </div>
                <div className="dir-side-facts">
                  <div className="dir-amount">{money(scholarship.amount, scholarship.currencyCode) ?? 'Amount not published'}</div>
                  <div className="dir-deadline">{scholarship.deadline ? `Deadline ${dateFmt(scholarship.deadline)}` : 'Deadline not published'}</div>
                  <Link href={`/scholarships/${scholarship.slug}`} className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}>View details</Link>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState label="No scholarships are currently published" />}
        {meta.totalPages > 1 ? <nav className="pagination" aria-label="Pages" style={{ marginTop: 20, textAlign: 'center', color: 'var(--muted)' }}>Page {meta.page} of {meta.totalPages}</nav> : null}
      </div>
      <CatalogFooter />
    </main>
  );
}

export function ScholarshipDetail({ scholarship }: { scholarship: Scholarship }) {
  const countries = scholarship.countries ?? [];
  const universities = scholarship.universities ?? [];
  return (
    <main className="visual-courses-page visual-directory-page">
      <CatalogHeader active="scholarships" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li><Link href="/scholarships">Scholarships</Link></li><li className="sep">/</li><li aria-current="page">{scholarship.title}</li></ol></nav></div>
      <div className="wrap">
        <div className="dir-detail-heading" style={{ marginTop: 20 }}>
          <div className="dir-logo-lg"><Icon name="cap" size={32} /></div>
          <div>
            <h1>{scholarship.title}</h1>
            <div className="dir-loc">{scholarship.provider?.name ?? 'Provider not published'}</div>
            <div className="dir-tags">
              {scholarship.isFeatured ? <span className="dir-tag featured">Featured</span> : null}
              {scholarship.benefitType ? <span className="dir-tag">{scholarship.benefitType.replaceAll('_', ' ')}</span> : null}
            </div>
          </div>
        </div>
        <div className="dir-detail-actions">
          {scholarship.applicationUrl ? <a href={scholarship.applicationUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Apply now</a> : null}
          <Link href={counsellingHref({ source: 'general', from: `/scholarships/${scholarship.slug}` })} className="btn btn-outline">Talk to a counsellor</Link>
        </div>
      </div>
      <div className="wrap dir-layout" style={{ marginTop: 28 }}>
        <div className="dir-main">
          <section className="dir-block">
            <div className="dir-block-head"><span className="eyebrow">Overview</span><h2>About this scholarship</h2></div>
            <div className="dir-stats">
              <div className="dir-stat"><div className="dir-stat-ic"><Icon name="money" /></div><div><div className="dir-stat-v">{money(scholarship.amount, scholarship.currencyCode) ?? 'Not published'}</div><div className="dir-stat-k">Award amount</div></div></div>
              <div className="dir-stat"><div className="dir-stat-ic"><Icon name="calendar" /></div><div><div className="dir-stat-v">{dateFmt(scholarship.deadline) ?? 'Not published'}</div><div className="dir-stat-k">Deadline</div></div></div>
              <div className="dir-stat"><div className="dir-stat-ic"><Icon name="globe" /></div><div><div className="dir-stat-v">{countries.length || 'All'}</div><div className="dir-stat-k">Eligible countries</div></div></div>
            </div>
            <p style={{ color: 'var(--slate)', fontSize: 15, marginTop: 16 }}>{scholarship.description ?? scholarship.summary ?? 'No further overview is published for this scholarship yet.'}</p>
          </section>
          {scholarship.eligibility ? (
            <section className="dir-block">
              <div className="dir-block-head"><span className="eyebrow">Eligibility</span><h2>Who can apply</h2></div>
              <p style={{ color: 'var(--slate)', fontSize: 15 }}>{scholarship.eligibility}</p>
            </section>
          ) : null}
          {universities.length ? (
            <section className="dir-block">
              <div className="dir-block-head"><span className="eyebrow">Where to apply</span><h2>Eligible universities</h2></div>
              <div className="grid g3">
                {universities.map((item, index) => item.university ? (
                  <Link href={`/universities/${item.university.slug}`} className="card" key={index}>
                    <h3 style={{ fontSize: 15.5, fontWeight: 700 }}>{item.university.name}</h3>
                  </Link>
                ) : null)}
              </div>
            </section>
          ) : null}
        </div>
        <aside className="dir-side">
          <CounsellingCard from={`/scholarships/${scholarship.slug}`} heading={<>Need help finding scholarships? Get <span>free</span> counselling</>} />
          <FactsCard title="At a glance" rows={[
            ['Provider', scholarship.provider?.name],
            ['Scholarship type', scholarship.benefitType?.replaceAll('_', ' ')],
            ['Study in', countries.map((item) => item.country?.name).filter(Boolean).join(', ') || undefined],
            ['Deadline', dateFmt(scholarship.deadline) ?? undefined],
          ]} />
          {scholarship.applicationUrl ? (
            <div className="dir-facts-card">
              <h4>Apply</h4>
              <a href={scholarship.applicationUrl} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>Visit official website<Icon name="arrow" size={15} /></a>
            </div>
          ) : null}
        </aside>
      </div>
      <CatalogFooter />
    </main>
  );
}

/* ================= Consultants ================= */

export function ConsultantListing({ consultants, meta, filters }: { consultants: Consultant[]; meta: PageMeta; filters: Record<string, string> }) {
  return (
    <main className="visual-courses-page visual-directory-page">
      <CatalogHeader active="consultants" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li>Study abroad consultants</li></ol></nav></div>
      <section className="hero dir-hero">
        <div className="wrap hero-inner">
          <span className="hero-pill"><span className="dot" /><b>{meta.total}</b> published consultants</span>
          <h1>Find a Study Abroad <span>Consultant</span></h1>
          <p className="lede">Explore published consultant profiles and the services and destinations they support.</p>
          <form className="search-shell" action="/study-abroad-consultants">
            <div className="search-box"><Icon name="search" /><input name="q" defaultValue={filters.q ?? ''} placeholder="Search consultants by name" aria-label="Search consultants" /><button className="btn btn-primary" type="submit">Search</button></div>
          </form>
        </div>
      </section>
      <div className="wrap" style={{ marginTop: 28 }}>
        <div className="results-bar"><span className="results-count"><b>{meta.total}</b> published consultants</span></div>
        {consultants.length ? (
          <div className="course-list">
            {consultants.map((consultant) => (
              <article className="card dir-card" key={consultant.id}>
                <div className="dir-card-logo">{initials(consultant.name)}</div>
                <div className="dir-card-body">
                  <h3>
                    <Link href={`/study-abroad-consultants/${consultant.slug}`}>{consultant.name}</Link>
                    {consultant.verificationStatus === 'VERIFIED' ? <Icon name="check" size={16} /> : null}
                  </h3>
                  <div className="dir-loc">{consultant.locations?.[0]?.location?.name ?? (consultant.verificationStatus ? consultant.verificationStatus.replaceAll('_', ' ') : null)}</div>
                  <div className="dir-tags">
                    {consultant.isFeatured ? <span className="dir-tag featured">Featured</span> : null}
                    {consultant.services?.slice(0, 3).map((service) => <span className="dir-tag" key={service.id}>{service.name}</span>)}
                  </div>
                  <p className="dir-desc">{consultant.shortDescription ?? 'Published consultant profile.'}</p>
                </div>
                <div className="dir-card-actions">
                  <Link href={`/study-abroad-consultants/${consultant.slug}`} className="btn btn-secondary btn-sm">View details</Link>
                  <CompareCheckbox type="consultants" slug={consultant.slug} label={consultant.name} />
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState label="No study abroad consultants are currently published" />}
        {meta.totalPages > 1 ? <nav className="pagination" aria-label="Pages" style={{ marginTop: 20, textAlign: 'center', color: 'var(--muted)' }}>Page {meta.page} of {meta.totalPages}</nav> : null}
      </div>
      <CatalogFooter />
      <CompareTray type="consultants" />
    </main>
  );
}

export function ConsultantDetail({ consultant }: { consultant: Consultant }) {
  const locations = consultant.locations ?? [];
  const countries = consultant.countries ?? [];
  const services = consultant.services ?? [];
  const languages = consultant.languages ?? [];
  return (
    <main className="visual-courses-page visual-directory-page">
      <CatalogHeader active="consultants" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li><Link href="/study-abroad-consultants">Consultants</Link></li><li className="sep">/</li><li aria-current="page">{consultant.name}</li></ol></nav></div>
      <div className="wrap">
        <div className="dir-detail-heading" style={{ marginTop: 20 }}>
          <div className="dir-logo-lg">{initials(consultant.name)}</div>
          <div>
            <h1>{consultant.name}{consultant.verificationStatus === 'VERIFIED' ? <Icon name="check" /> : null}</h1>
            <div className="dir-loc">{locations.map((item) => item.location?.name).filter(Boolean).join(', ') || 'Location not published'}</div>
            <div className="dir-tags">
              {consultant.isFeatured ? <span className="dir-tag featured">Featured</span> : null}
              <span className="dir-tag">{(consultant.verificationStatus ?? 'UNVERIFIED').replaceAll('_', ' ')}</span>
            </div>
          </div>
        </div>
        <div className="dir-detail-actions">
          <CompareCheckbox type="consultants" slug={consultant.slug} label={consultant.name} />
          {consultant.websiteUrl ? <a href={consultant.websiteUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Visit website</a> : null}
        </div>
      </div>
      <div className="wrap dir-layout" style={{ marginTop: 28 }}>
        <div className="dir-main">
          <section className="dir-block">
            <div className="dir-block-head"><span className="eyebrow">Overview</span><h2>About {consultant.name}</h2></div>
            <p style={{ color: 'var(--slate)', fontSize: 15 }}>{consultant.description ?? consultant.shortDescription ?? 'No further overview is published for this consultant yet.'}</p>
          </section>
          {services.length ? (
            <section className="dir-block">
              <div className="dir-block-head"><span className="eyebrow">Support offered</span><h2>Services</h2></div>
              <div className="dir-tags">{services.map((service) => <span className="dir-tag" key={service.id}>{service.name}</span>)}</div>
            </section>
          ) : null}
          {locations.length ? (
            <section className="dir-block">
              <div className="dir-block-head"><span className="eyebrow">Where to meet</span><h2>Locations</h2></div>
              <div className="grid g2">
                {locations.map((item, index) => item.location ? (
                  <Link href={`/study-abroad-consultants/locations/${item.location.slug}`} className="card" key={index}>
                    <h3 style={{ fontSize: 16, fontWeight: 700 }}>{item.location.name}</h3>
                    <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6 }}>{[item.location.city, item.location.state].filter(Boolean).join(', ')}</p>
                  </Link>
                ) : null)}
              </div>
            </section>
          ) : null}
        </div>
        <aside className="dir-side">
          <CounsellingCard from={`/study-abroad-consultants/${consultant.slug}`} heading={<>Want personalised guidance? Get <span>free</span> counselling</>} />
          <FactsCard title="At a glance" rows={[
            ['Verification', consultant.verificationStatus?.replaceAll('_', ' ')],
            ['Countries', countries.map((item) => item.country?.name).filter(Boolean).join(', ') || undefined],
            ['Languages', languages.map((item) => item.name).filter(Boolean).join(', ') || undefined],
            ['Email', consultant.email],
            ['Phone', consultant.phone],
          ]} />
        </aside>
      </div>
      <CatalogFooter />
      <CompareTray type="consultants" />
    </main>
  );
}

export function ConsultantLocationDetail({ location }: { location: ConsultantLocationRow }) {
  const consultants = (location.consultants ?? []).map((item) => item.consultant).filter((item): item is Consultant => Boolean(item));
  return (
    <main className="visual-courses-page visual-directory-page">
      <CatalogHeader active="consultants" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li><Link href="/study-abroad-consultants">Consultants</Link></li><li className="sep">/</li><li aria-current="page">{location.name}</li></ol></nav></div>
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <span className="eyebrow">Consultant location</span>
          <h1 style={{ fontSize: 'clamp(26px,3.6vw,38px)', fontWeight: 800, marginTop: 8 }}>{location.name}</h1>
          <p style={{ color: 'var(--muted)', marginTop: 10 }}>{[location.city, location.state, location.country?.name].filter(Boolean).join(', ')}</p>
          {location.overview ? <p style={{ color: 'var(--slate)', fontSize: 15, marginTop: 12, maxWidth: 640 }}>{location.overview}</p> : null}
        </div>
      </section>
      <div className="wrap" style={{ marginTop: 12 }}>
        <div className="dir-block-head"><span className="eyebrow">Published guidance</span><h2>Consultants in {location.city ?? location.name}</h2></div>
        {consultants.length ? (
          <div className="course-list">
            {consultants.map((consultant) => (
              <article className="card dir-card" key={consultant.id}>
                <div className="dir-card-logo">{initials(consultant.name)}</div>
                <div className="dir-card-body">
                  <h3><Link href={`/study-abroad-consultants/${consultant.slug}`}>{consultant.name}</Link></h3>
                  <p className="dir-desc">{consultant.shortDescription ?? 'Published consultant profile.'}</p>
                </div>
                <div className="dir-card-actions">
                  <Link href={`/study-abroad-consultants/${consultant.slug}`} className="btn btn-secondary btn-sm">View details</Link>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState label="No consultants are currently published at this location" />}
      </div>
      <CatalogFooter />
    </main>
  );
}
