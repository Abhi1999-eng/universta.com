'use client';

/* API-selected media can come from approved external asset hosts. */
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type {
  Country,
  CountryPage,
  DirectoryRecord,
  PaginationMeta,
  ProfileSummary,
} from '@/lib/countries';
import type {
  Course,
  PageMeta,
  Subject,
  SubjectDetail,
} from '@/lib/catalog';

type IconName =
  | 'arrow'
  | 'book'
  | 'briefcase'
  | 'calendar'
  | 'cap'
  | 'chart'
  | 'check'
  | 'clock'
  | 'code'
  | 'globe'
  | 'heart'
  | 'home'
  | 'money'
  | 'search'
  | 'shield'
  | 'star'
  | 'users';

const iconPaths: Record<IconName, string> = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  briefcase: 'M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  calendar: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  cap: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5',
  chart: 'M3 3v18h18M18 9l-5 5-3-3-4 4',
  check: 'M20 6 9 17l-5-5',
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',
  code: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
  globe: 'M2 12h20M12 2a15 15 0 0 1 0 20M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  money: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  search: 'm21 21-4.3-4.3M11 18a7 7 0 1 1 0-14a7 7 0 0 1 0 14',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  star: 'm12 2 3 6.5 7 .6-5.3 4.6 1.6 6.8L12 17l-6.3 3.5 1.6-6.8L2 9.1l7-.6z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87',
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

function CatalogHeader({ active }: { active: 'countries' | 'subjects' | 'courses' }) {
  return (
    <header className="nav" id="siteNav">
      <div className="wrap nav-inner">
        <Link href="/" className="logo">Univer<b>sta</b></Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <Link className={active === 'countries' ? 'active' : ''} href="/countries">Countries</Link>
          <Link href="/universities">Universities</Link>
          <Link className={active === 'courses' ? 'active' : ''} href="/courses">Courses</Link>
          <Link href="/scholarships">Scholarships</Link>
          <Link href="/consultants">Consultants</Link>
        </nav>
        <div className="nav-right">
          <Link className="nav-signin" href="/signin">Sign in</Link>
          <Link className="btn btn-primary btn-sm" href="/counselling">Get free counselling</Link>
          <button type="button" className="nav-toggle" aria-label="Open menu">
            <Icon name="users" size={25} />
          </button>
        </div>
      </div>
    </header>
  );
}

function CatalogFooter() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link href="/" className="logo">Univer<b>sta</b></Link>
            <p>Compare published study destinations, subjects and courses in one place.</p>
          </div>
          {[
            ['Courses', [['All courses', '/courses'], ['Subjects', '/subjects']]],
            ['Destinations', [['All countries', '/countries']]],
            ['Platform', [['Scholarships', '/scholarships'], ['Consultants', '/consultants']]],
            ['Company', [['About', '/about'], ['Contact', '/contact']]],
          ].map(([title, links]) => (
            <div className="foot-col" key={String(title)}>
              <h4>{String(title)}</h4>
              <ul>
                {(links as string[][]).map(([label, href]) => (
                  <li key={label}><Link href={href}>{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          <span>© 2026 Universta · Verify important information with official sources.</span>
          <span>Made for students worldwide</span>
        </div>
      </div>
    </footer>
  );
}

function CountryHeader() {
  return (
    <header id="hdr">
      <div className="wrap nav">
        <Link href="/" className="logo">Univer<span>sta</span></Link>
        <ul className="nav-links">
          <li><Link href="/countries">Countries</Link></li>
          <li><Link href="/universities">Universities</Link></li>
          <li><Link href="/courses">Courses</Link></li>
          <li><Link href="/scholarships">Scholarships</Link></li>
          <li><Link href="/consultants">Consultants</Link></li>
        </ul>
        <div className="nav-r">
          <Link href="/signin" className="sign">Sign in</Link>
          <Link href="/counselling" className="btn btn-p">Get free counselling</Link>
          <button type="button" className="burger" aria-label="Open menu">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

function EmptyTemplateState({ label }: { label: string }) {
  return (
    <div className="template-empty">
      <h3>{label}</h3>
      <p>Published information will appear here when it is available from the catalog.</p>
    </div>
  );
}

function moneyRange(profile: ProfileSummary['cost'] | undefined) {
  if (!profile?.tuitionMin) return null;
  const symbol = profile.currencySymbol ?? profile.currencyCode;
  return `${symbol}${Number(profile.tuitionMin).toLocaleString()}${profile.tuitionMax ? `–${Number(profile.tuitionMax).toLocaleString()}` : '+'}/yr`;
}

function postStudyWork(country: Country) {
  const work = country.profiles?.work;
  if (!work?.postStudyWorkAvailable) return null;
  if (work.postStudyWorkMaxMonths) {
    return work.postStudyWorkMaxMonths % 12 === 0
      ? `Up to ${work.postStudyWorkMaxMonths / 12} yrs`
      : `Up to ${work.postStudyWorkMaxMonths} months`;
  }
  return 'Available';
}

function flagFor(country: Pick<Country, 'flag' | 'name'>) {
  return country.flag
    ? <img src={country.flag.url} alt={country.flag.alt || `${country.name} flag`} />
    : <span aria-hidden="true">{country.name.slice(0, 2).toUpperCase()}</span>;
}

function CountryTemplateCard({ country }: { country: Country }) {
  const statistics = country.profiles?.statistics;
  const tuition = moneyRange(country.profiles?.cost);
  const work = postStudyWork(country);
  const intakes = country.profiles?.intakes.map((item) => item.shortLabel ?? item.name).join(', ');
  return (
    <article className="card">
      {country.profiles?.work?.immigrationPathwayStrength === 'STRONG' ? (
        <span className="pr-badge"><Icon name="home" size={14} />PR friendly</span>
      ) : null}
      <div className="card-head">
        <div className="flag">{flagFor(country)}</div>
        <div>
          <h3>{country.name}</h3>
          <div className="sub">
            {statistics?.universitiesCount != null
              ? `${statistics.universitiesCount.toLocaleString()} universities`
              : country.continent.name}
          </div>
        </div>
      </div>
      <p className="desc">{country.shortDescription}</p>
      <div className="facts">
        <div className="fact"><span><Icon name="money" size={14} />Tuition</span><b>{tuition ?? 'Not published'}</b></div>
        <div className="fact"><span><Icon name="briefcase" size={14} />Post-study work</span><b>{work ?? 'Not published'}</b></div>
        <div className="fact"><span><Icon name="calendar" size={14} />Popular intake</span><b>{intakes || 'Not published'}</b></div>
      </div>
      <Link href={`/countries/${country.slug}`} className="card-cta">
        Explore {country.name}<Icon name="arrow" size={15} />
      </Link>
    </article>
  );
}

export function ApprovedCountriesListing({
  countries,
  meta,
  continents,
  directory,
}: {
  countries: Country[];
  meta: PaginationMeta;
  continents: Array<{ id: string; name: string; slug: string; status: string }>;
  directory: DirectoryRecord[];
}) {
  const universityTotal = countries.reduce(
    (total, country) => total + (country.profiles?.statistics?.universitiesCount ?? 0),
    0,
  );
  const courseTotal = countries.reduce(
    (total, country) => total + (country.profiles?.statistics?.coursesCount ?? 0),
    0,
  );
  const scholarshipTotal = countries.reduce(
    (total, country) => total + (country.profiles?.statistics?.scholarshipsCount ?? 0),
    0,
  );
  const letters = Array.from(new Set(directory.map((item) => item.letter))).sort();
  const [activeLetter, setActiveLetter] = useState('All');
  const displayedDirectory = activeLetter === 'All'
    ? directory
    : directory.filter((item) => item.letter === activeLetter);
  return (
    <main className="visual-countries-page">
      <CountryHeader />
      <section className="hero">
        <div className="wrap center">
          <div className="hero-badge"><Icon name="globe" size={15} /><b>{meta.total}</b> destinations · <b>{universityTotal.toLocaleString()}</b> universities</div>
          <h1>Where will your degree <em>take you?</em></h1>
          <p className="hero-sub">Don&apos;t just browse countries — compare what actually decides your choice, side by side.</p>
          <div className="compare-chips">
            {[
              ['money', 'Tuition fees'],
              ['home', 'Living cost'],
              ['star', 'Scholarships'],
              ['briefcase', 'Post-study work'],
              ['shield', 'PR pathways'],
              ['book', 'English requirements'],
              ['calendar', 'Intakes'],
            ].map(([icon, label]) => <span key={label}><Icon name={icon as IconName} size={14} />{label}</span>)}
          </div>
          <form className="searchbar" action="/countries">
            <Icon name="search" size={19} />
            <input id="q" name="q" type="search" autoComplete="off" placeholder="Search a country (Canada, UK, Australia...)" aria-label="Search a country" />
            <button className="btn btn-p" type="submit">Search</button>
          </form>
          <div className="qf" id="qf">
            <Link href="/countries?budgetBand=BUDGET_FRIENDLY"><Icon name="money" />Budget friendly</Link>
            <Link href="/countries?ieltsOptional=true"><Icon name="book" />IELTS optional</Link>
            <Link href="/countries?intake=winter"><Icon name="calendar" />January intake</Link>
            <Link href="/countries?visaSuccessBand=HIGH"><Icon name="shield" />High visa success</Link>
            <Link href="/countries?pathwayStrength=STRONG"><Icon name="home" />PR friendly</Link>
            <Link href="/countries?hasTopRankedUniversities=true"><Icon name="star" />Top ranked universities</Link>
          </div>
          <div className="stats">
            <div className="stat"><b>{meta.total}</b><span>Destinations</span></div>
            <div className="stat"><b>{universityTotal.toLocaleString()}</b><span>Universities</span></div>
            <div className="stat"><b>{courseTotal.toLocaleString()}</b><span>Courses</span></div>
            <div className="stat"><b>{scholarshipTotal.toLocaleString()}</b><span>Scholarships</span></div>
            <div className="stat"><b>{continents.length}</b><span>Regions</span></div>
            <div className="stat"><b>{countries.filter((item) => item.featured).length}</b><span>Featured</span></div>
          </div>
        </div>
      </section>
      <section className="region-sec" id="regions">
        <div className="wrap">
          <div>
            <div className="eyebrow">Browse by region</div>
            <h2 className="sec-h" style={{ marginTop: 12 }}>Start with the part of the world you&apos;re drawn to.</h2>
            <p className="sec-p">Every published destination with the available tuition, post-study work and intake information.</p>
          </div>
          <div className="tabbar">
            <div className="tabs">
              <Link className="tab on" href="/countries">All destinations <span className="n">{meta.total}</span></Link>
              {continents.map((continent) => (
                <Link className="tab" href={`/countries?region=${continent.slug}`} key={continent.id}>
                  {continent.name} <span className="n">{countries.filter((item) => item.continent.id === continent.id).length}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="res-count">Showing {countries.length} destination{countries.length === 1 ? '' : 's'}</div>
          <div className="cards">
            {countries.length ? countries.map((country) => <CountryTemplateCard country={country} key={country.id} />) : <EmptyTemplateState label="No destinations match these filters" />}
          </div>
        </div>
      </section>
      <div className="wrap">
        <section className="cta-band">
          <div>
            <h2>Confused about choosing the right country?</h2>
            <p>Talk with a counsellor and build a clear plan around the published options.</p>
            <ul className="cta-list">
              {['Profile evaluation', 'University shortlisting', 'Scholarship guidance', 'Visa assistance'].map((item) => <li key={item}><Icon name="check" />{item}</li>)}
            </ul>
            <div className="cta-btns">
              <Link href="/counselling" className="btn btn-w btn-lg">Get free counselling</Link>
              <Link href="/signup" className="btn btn-o btn-lg">Create free account</Link>
            </div>
          </div>
          <div className="cta-art" aria-hidden="true"><Icon name="globe" size={180} /></div>
        </section>
      </div>
      <section className="az-sec" id="az">
        <div className="wrap">
          <div className="eyebrow">Every destination</div>
          <h2 className="sec-h" style={{ marginTop: 12 }}>Browse every destination A–Z</h2>
          <p className="sec-p">Jump straight to a country and see what is currently published.</p>
          <div className="alpha">
            <button type="button" className={activeLetter === 'All' ? 'on' : ''} onClick={() => setActiveLetter('All')}>All</button>
            {Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)).map((letter) => (
              <button type="button" className={activeLetter === letter ? 'on' : ''} disabled={!letters.includes(letter)} onClick={() => setActiveLetter(letter)} key={letter}>{letter}</button>
            ))}
          </div>
          <div className="az-grid">
            {displayedDirectory.length ? displayedDirectory.map((country) => (
              <article className="az-tile" key={country.slug}>
                <div className="t">
                  <span className="fl">{country.flag ? <img src={country.flag.url} alt={country.flag.alt || ''} /> : country.name.slice(0, 2).toUpperCase()}</span>
                  <h3>Study in {country.name}</h3>
                </div>
                <p>{country.shortDescription}</p>
                <div className="progs">
                  {Object.entries(country.programCounts).filter(([, count]) => count != null).map(([label, count]) => <span key={label}>{count} {label.toUpperCase()}</span>)}
                </div>
                {country.isAvailable ? <Link className="go" href={`/countries/${country.slug}`}>Explore <Icon name="arrow" size={13} /></Link> : <span>Coming soon</span>}
              </article>
            )) : <EmptyTemplateState label="No country directory entries are published" />}
          </div>
        </div>
      </section>
      <div className="wrap">
        <section className="cta2">
          <h2>Ready to start your study abroad journey?</h2>
          <p>Create an account to save destinations and continue your planning.</p>
          <div className="cta2-btns">
            <Link href="/signup" className="btn btn-p btn-lg">Create free account</Link>
            <Link href="/counselling" className="btn btn-s btn-lg">Book free consultation</Link>
          </div>
        </section>
      </div>
      <section className="cons-sec" id="consultants">
        <div className="wrap">
          <div className="eyebrow">Study abroad consultants</div>
          <h2 className="sec-h" style={{ marginTop: 12 }}>Guidance from people who know your destination.</h2>
          <p className="sec-p">Connect with guidance once a published consultant profile is available for your destination.</p>
          <div className="cons-grid"><EmptyTemplateState label="Consultant profiles are not yet published" /></div>
        </div>
      </section>
      <section className="final">
        <div className="wrap">
          <div className="eyebrow">Personalised shortlist</div>
          <h2>Not sure which country fits you?</h2>
          <p>Start with the published catalog and get help turning it into a shortlist.</p>
          <div className="final-btns">
            <Link href="/countries" className="btn btn-w btn-lg">Find my best match</Link>
            <Link href="/counselling" className="btn btn-o btn-lg">Talk to a counsellor</Link>
          </div>
          <div className="trust">
            <div><Icon name="shield" />No obligation</div>
            <div><Icon name="clock" />Clear next steps</div>
            <div><Icon name="users" />Published guidance</div>
          </div>
        </div>
      </section>
      <footer>© 2026 Universta · Verify tuition, visa and intake information with official sources.</footer>
    </main>
  );
}

function profileMoney(page: CountryPage, field: 'tuition' | 'living') {
  const cost = page.profiles.cost;
  if (!cost) return 'Not published';
  const symbol = cost.currencySymbol ?? cost.currencyCode;
  const min = field === 'tuition' ? cost.tuitionMin : cost.livingCostMin;
  const max = field === 'tuition' ? cost.tuitionMax : cost.livingCostMax;
  const period = field === 'tuition' ? cost.tuitionPeriod : cost.livingCostPeriod;
  if (!min) return 'Not published';
  return `${symbol}${Number(min).toLocaleString()}${max ? `–${Number(max).toLocaleString()}` : '+'}/${period === 'PER_MONTH' ? 'mo' : 'yr'}`;
}

function CountrySection({
  id,
  eyebrow,
  title,
  children,
  alternate = false,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  alternate?: boolean;
}) {
  return (
    <section className={`sec${alternate ? ' alt' : ''}`} id={id}>
      <div className="wrap">
        <div className="head">
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="sh">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

export function ApprovedCountryDetail({ page }: { page: CountryPage }) {
  const { country, profiles, sections, faqs, consultantCards } = page;
  const work = profiles.work;
  const statistics = profiles.statistics;
  const intakes = profiles.intakes.map((item) => item.intake?.shortLabel ?? item.name ?? item.shortLabel).filter(Boolean);
  const editorial = new Map(sections.map((section) => [section.sectionKey, section]));
  const reasonCards = [
    work?.immigrationPathwayStrength ? ['Immigration pathway', work.immigrationPathwaySummary ?? work.immigrationPathwayStrength.replaceAll('_', ' '), 'home'] : null,
    work?.postStudyWorkAvailable ? ['Post-study work', work.postStudyWorkSummary ?? `${work.postStudyWorkMinMonths ?? 0}–${work.postStudyWorkMaxMonths ?? 0} months`, 'briefcase'] : null,
    profiles.cost?.tuitionMin ? ['Published tuition', profileMoney(page, 'tuition'), 'money'] : null,
    work?.partTimeAllowed ? ['Part-time work', work.partTimeSummary ?? `${work.partTimeHoursPerWeek ?? 'Published'} hours per week`, 'clock'] : null,
    profiles.language?.ieltsRequirement ? ['English requirements', profiles.language.ieltsMinScore ? `IELTS ${profiles.language.ieltsMinScore}` : profiles.language.ieltsRequirement, 'book'] : null,
    intakes.length ? ['Available intakes', intakes.join(' · '), 'calendar'] : null,
  ].filter(Boolean) as string[][];
  return (
    <main className="visual-country-detail-page">
      <CountryHeader />
      <nav className="jump" aria-label="Page sections">
        <div className="wrap jump-in">
          {[
            ['why', `Why ${country.name}`],
            ['unis', 'Universities'],
            ['subjects', 'Subjects'],
            ['intakes', 'Intakes'],
            ['documents', 'Documents'],
            ['cost', 'Cost'],
            ['scholarships', 'Scholarships'],
            ['visa', 'Visa'],
            ['events', 'Events'],
            ['cities', 'Cities'],
            ['living', 'Living cost'],
            ['careers', 'Careers'],
            ['faq', 'FAQ'],
            ['howto', 'How to apply'],
            ['consultants', 'Consultants'],
          ].map(([id, label], index) => <a href={`#${id}`} className={index === 0 ? 'on' : ''} key={id}>{label}</a>)}
        </div>
      </nav>
      <div className="wrap">
        <div className="crumbs">
          <Link href="/">Home</Link><Icon name="arrow" size={13} />
          <Link href="/countries">Countries</Link><Icon name="arrow" size={13} />
          <span style={{ color: 'var(--ink)' }}>{country.name}</span>
        </div>
      </div>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="h-flag">{country.flag ? <img src={country.flag.url} alt={country.flag.alt || `${country.name} flag`} /> : country.name.slice(0, 2).toUpperCase()}</div>
            <h1>{country.pageHeading || `Study in ${country.name}`}</h1>
            <p className="lede">{country.shortDescription}</p>
            <div className="updated"><Icon name="clock" size={15} />Published source-aware country profile</div>
            <div className="hero-btns">
              <Link href="/counselling" className="btn btn-p btn-lg">Get free counselling</Link>
              <Link href="/signup" className="btn btn-s btn-lg">Create account &amp; start application</Link>
            </div>
          </div>
          <aside className="quickfacts">
            <h3>{country.name} at a glance</h3>
            <p className="qf-note">Currently published profile data</p>
            <div className="qf-row"><span><Icon name="money" />Tuition</span><b>{profileMoney(page, 'tuition')}</b></div>
            <div className="qf-row"><span><Icon name="home" />Living cost</span><b>{profileMoney(page, 'living')}</b></div>
            <div className="qf-row"><span><Icon name="briefcase" />Post-study work</span><b>{work?.postStudyWorkAvailable ? `${work.postStudyWorkMinMonths ?? 0}–${work.postStudyWorkMaxMonths ?? 0} months` : 'Not published'}</b></div>
            <div className="qf-row"><span><Icon name="calendar" />Intakes</span><b>{intakes.join(' · ') || 'Not published'}</b></div>
            <div className="qf-row"><span><Icon name="book" />English</span><b>{profiles.language?.ieltsMinScore ? `IELTS ${profiles.language.ieltsMinScore}` : profiles.language?.ieltsRequirement ?? 'Not published'}</b></div>
            <div className="qf-row"><span><Icon name="shield" />Pathway</span><b>{work?.immigrationPathwayStrength?.replaceAll('_', ' ') ?? 'Not published'}</b></div>
          </aside>
        </div>
      </section>
      <div className="wrap"><div className="ad ad-lb"><div className="lab">Advertisement</div><div className="box">Leaderboard · 970×120 desktop / 320×100 mobile</div></div></div>
      <CountrySection id="why" eyebrow={`The case for ${country.name}`} title={`Why study in ${country.name}`}>
        <div className="why-grid">
          {reasonCards.length ? reasonCards.map(([title, body, icon]) => (
            <article className="why" key={title}>
              <div className="ic"><Icon name={icon as IconName} /></div>
              <h3>{title}</h3><p>{body}</p><span className="stat">Published profile information</span>
            </article>
          )) : <EmptyTemplateState label="Country benefits are not yet published" />}
        </div>
      </CountrySection>
      <CountrySection id="unis" eyebrow="Published catalog" title={`Universities in ${country.name}`} alternate>
        <div className="partners"><EmptyTemplateState label={`${statistics?.universitiesCount ?? 0} universities are recorded; profiles are not yet published`} /></div>
      </CountrySection>
      <CountrySection id="subjects" eyebrow="What students choose" title={`Popular subjects in ${country.name}`}>
        <div className="subj-grid"><EmptyTemplateState label="Subject availability is not yet published for this country" /></div>
      </CountrySection>
      <CountrySection id="intakes" eyebrow="Application timing" title={`Study intakes in ${country.name}`} alternate>
        <div className="intakes">
          {profiles.intakes.length ? profiles.intakes.map((item) => (
            <article className="intake" key={item.id}>
              <div className="month">{item.intake?.shortLabel ?? item.name ?? item.shortLabel}</div>
              <h3>{item.intake?.name ?? item.name}</h3>
              <p>{item.notes ?? item.applicationDeadlineNote ?? 'Published as available.'}</p>
              <span>{item.availabilityStatus}</span>
            </article>
          )) : <EmptyTemplateState label="No intake information is published" />}
        </div>
      </CountrySection>
      <CountrySection id="documents" eyebrow="Application checklist" title="Documents required">
        <div className="docs"><EmptyTemplateState label={editorial.get('documents')?.heading ?? 'Document guidance is not yet published'} /></div>
      </CountrySection>
      <CountrySection id="cost" eyebrow="Plan your budget" title={`Cost to study in ${country.name}`} alternate>
        <div className="cost-grid">
          <article className="cost-card"><span>Tuition</span><strong>{profileMoney(page, 'tuition')}</strong><p>{profiles.cost?.disclaimer}</p></article>
          <article className="cost-card"><span>Living cost</span><strong>{profileMoney(page, 'living')}</strong><p>{profiles.cost?.livingCostNotes ?? profiles.cost?.disclaimer}</p></article>
        </div>
      </CountrySection>
      <CountrySection id="scholarships" eyebrow="Funding" title="Scholarships">
        <div className="schols"><EmptyTemplateState label={`${statistics?.scholarshipsCount ?? 0} scholarships are currently published`} /></div>
      </CountrySection>
      <CountrySection id="visa" eyebrow="Student permission" title={`Visa and work information for ${country.name}`} alternate>
        <div className="visa-grid">
          <article className="visa-card"><h3>Visa information</h3><p>{work?.visaInformation ?? 'Visa guidance is not yet published.'}</p></article>
          <article className="visa-card"><h3>Proof of funds</h3><p>{work?.proofOfFundsSummary ?? 'Proof-of-funds guidance is not yet published.'}</p></article>
          <article className="visa-card"><h3>Processing time</h3><p>{work?.visaProcessingTime ?? 'Processing-time guidance is not yet published.'}</p></article>
        </div>
      </CountrySection>
      <CountrySection id="events" eyebrow="Meet institutions" title="Upcoming events">
        <div className="events"><EmptyTemplateState label="No events are currently published" /></div>
      </CountrySection>
      <CountrySection id="cities" eyebrow="Choose your base" title={`Popular cities in ${country.name}`} alternate>
        <div className="cities"><EmptyTemplateState label={`${statistics?.citiesCount ?? 0} cities are recorded; city profiles are not yet published`} /></div>
      </CountrySection>
      <CountrySection id="living" eyebrow="Monthly planning" title="Living costs">
        <div className="living-grid">
          <article className="living-card"><h3>Published range</h3><strong>{profileMoney(page, 'living')}</strong><p>{profiles.cost?.livingCostNotes ?? profiles.cost?.disclaimer}</p></article>
        </div>
      </CountrySection>
      <CountrySection id="careers" eyebrow="After graduation" title="Career opportunities" alternate>
        <div className="careers"><EmptyTemplateState label="Career outcomes are not yet published" /></div>
      </CountrySection>
      <CountrySection id="faq" eyebrow="Questions answered" title="Frequently asked questions">
        <div className="faq">
          {faqs.length ? faqs.map((faq) => <details className="faq-item" key={faq.id}><summary>{faq.question}</summary><p>{faq.answer}</p></details>) : <EmptyTemplateState label="No frequently asked questions are published" />}
        </div>
      </CountrySection>
      <CountrySection id="howto" eyebrow="Application journey" title={`How to study in ${country.name}`} alternate>
        <div className="steps"><EmptyTemplateState label={editorial.get('application-process')?.heading ?? 'Application steps are not yet published'} /></div>
      </CountrySection>
      <CountrySection id="consultants" eyebrow="Destination guidance" title={`Consultants for ${country.name}`}>
        <div className="cons-grid">
          {consultantCards.length ? consultantCards.map((card) => (
            <article className="cons" key={card.id}>
              <h3>{card.title}</h3><p>{card.shortDescription}</p>
              <Link href={card.ctaUrl ?? '/counselling'}>{card.ctaLabel}</Link>
            </article>
          )) : <EmptyTemplateState label="No consultant profiles are currently published" />}
        </div>
      </CountrySection>
      <section className="final-cta">
        <div className="wrap">
          <h2>Ready to study in {country.name}?</h2>
          <p>Use the published destination information and get guidance for your shortlist.</p>
          <Link href="/counselling" className="btn btn-p">Get free guidance</Link>
        </div>
      </section>
      <footer>© 2026 Universta · Verify tuition, visa and immigration information with official sources.</footer>
    </main>
  );
}

function SubjectCard({ subject }: { subject: Subject }) {
  return (
    <Link href={`/subjects/${subject.slug}`} className="card subj-card">
      <div className="subj-img">
        {subject.listingMedia ? <img src={subject.listingMedia.url} alt={subject.listingMedia.alt ?? subject.name} /> : <div className="si"><Icon name="book" /></div>}
      </div>
      <div className="subj-body">
        <h3>{subject.name}</h3>
        <p>{subject.shortDescription ?? 'Published subject pathway'}</p>
        <div className="subj-meta">
          <span><b>{subject.publishedCourseCount}</b> courses</span>
          <span><b>{subject.publishedSubSubjectCount}</b> specializations</span>
        </div>
        <div className="subj-foot"><span>{subject.availableCountryCount} countries</span><span className="go">Explore <Icon name="arrow" size={14} /></span></div>
      </div>
    </Link>
  );
}

export function ApprovedSubjectsListing({ subjects, meta }: { subjects: Subject[]; meta: PageMeta }) {
  const directory = useMemo(
    () => subjects.reduce<Record<string, Subject[]>>((groups, subject) => {
      const letter = subject.name.slice(0, 1).toUpperCase();
      groups[letter] = [...(groups[letter] ?? []), subject];
      return groups;
    }, {}),
    [subjects],
  );
  return (
    <main className="visual-subjects-page">
      <CatalogHeader active="subjects" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li>Subjects</li></ol></nav></div>
      <section className="hero">
        <div className="wrap hero-inner">
          <span className="hero-pill"><Icon name="book" size={14} /><b>{meta.total}</b> published subjects</span>
          <h1>Explore Subjects to<br /><span>Study Abroad</span></h1>
          <p className="lede">Find the subject that fits your interests, strengths and future plans. Compare published courses, specializations and destinations.</p>
          <form className="search-shell" action="/subjects">
            <div className="search-box"><Icon name="search" /><input name="q" placeholder="Search subjects..." aria-label="Search subjects" /><button className="btn btn-primary" type="submit">Find Subjects</button></div>
          </form>
          <div className="hero-stats">
            <div className="hstat"><span className="num">{meta.total}</span><span className="lbl">Subjects</span></div>
            <div className="hstat"><span className="num">{subjects.reduce((sum, item) => sum + item.publishedCourseCount, 0)}</span><span className="lbl">Courses</span></div>
            <div className="hstat"><span className="num">{subjects.reduce((sum, item) => sum + item.availableCountryCount, 0)}</span><span className="lbl">Country pathways</span></div>
          </div>
        </div>
      </section>
      <div className="wrap layout">
        <div className="main">
          <section className="section" id="popular" style={{ paddingTop: 0 }}>
            <div className="section-head row-between"><div><span className="eyebrow">Start here</span><h2>Popular subjects</h2><p className="sub">Featured subjects from the published catalog.</p></div></div>
            <div className="grid g3">{subjects.length ? subjects.filter((item) => item.featured).concat(subjects).slice(0, 6).map((subject) => <SubjectCard subject={subject} key={subject.id} />) : <EmptyTemplateState label="No subjects are currently published" />}</div>
          </section>
          <section className="section" id="categories">
            <div className="section-head"><span className="eyebrow">Explore fields</span><h2>Browse by subject category</h2></div>
            <div className="grid g3">{subjects.length ? subjects.map((subject) => <SubjectCard subject={subject} key={subject.id} />) : <EmptyTemplateState label="Subject categories will appear with published records" />}</div>
          </section>
          <section className="section" id="directory">
            <div className="section-head"><span className="eyebrow">A–Z directory</span><h2>All subjects</h2></div>
            <div className="az-wrap">
              {Object.keys(directory).length ? Object.entries(directory).sort().map(([letter, items]) => (
                <section className="az-group" key={letter}><h3>{letter}</h3>{items.map((subject) => <Link href={`/subjects/${subject.slug}`} key={subject.id}>{subject.name}<Icon name="arrow" size={14} /></Link>)}</section>
              )) : <EmptyTemplateState label="The subject directory is empty" />}
            </div>
          </section>
          {[
            ['degrees', 'Study by degree level'],
            ['careers', 'Explore subjects by career'],
            ['featured', 'Featured subject pathways'],
            ['destinations', 'Best destinations by subject'],
            ['universities', 'Universities by subject'],
            ['courses', 'Popular courses by subject'],
            ['scholarships', 'Scholarships by subject'],
            ['outcomes', 'Career outcomes'],
            ['why', 'Why choose a subject first?'],
            ['resources', 'Resources & guides'],
            ['stories', 'Student stories'],
            ['faq', 'Frequently asked questions'],
            ['explore', 'Explore more'],
          ].map(([id, title]) => (
            <section className="section" id={id} key={id}>
              <div className="section-head"><span className="eyebrow">Published catalog</span><h2>{title}</h2></div>
              <div className="grid g3">{subjects.length ? subjects.slice(0, 3).map((subject) => <SubjectCard subject={subject} key={`${id}-${subject.id}`} />) : <EmptyTemplateState label={`${title} will appear when subject data is published`} />}</div>
            </section>
          ))}
        </div>
        <aside className="side">
          <div className="side-card"><span className="eyebrow">Find your direction</span><h3>Choose the right subject</h3><p>Start with published subjects and compare the available pathways.</p><Link href="/counselling" className="btn btn-primary btn-block">Get guidance</Link></div>
        </aside>
      </div>
      <section className="section wrap"><div className="final-cta"><h2>Find the subject that fits your future</h2><p>Explore published pathways and continue into the course catalog.</p><div className="cta-row"><Link href="/courses" className="btn btn-secondary">Explore courses</Link><Link href="/counselling" className="btn btn-outline">Get guidance</Link></div></div></section>
      <CatalogFooter />
    </main>
  );
}

function SubjectSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return <section className="block" id={id}><div className="block-head"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{children}</section>;
}

function CourseMiniCard({ course }: { course: Course }) {
  return (
    <Link href={`/courses/${course.slug}`} className="card course-card">
      <span className="cc-lvl">{course.courseLevel.name}</span>
      <h3>{course.name}</h3>
      <div className="cc-uni">{course.subject.name}</div>
      <div className="cc-facts">
        <div><b>{course.duration.min ? `${course.duration.min} ${course.duration.unit ?? ''}` : 'Varies'}</b>Duration</div>
        <div><b>{course.availableCountryCount}</b>Countries</div>
      </div>
    </Link>
  );
}

export function ApprovedSubjectDetail({ subject }: { subject: SubjectDetail }) {
  return (
    <main className="visual-subject-page">
      <CatalogHeader active="subjects" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li><Link href="/subjects">Subjects</Link></li><li className="sep">/</li><li>{subject.name}</li></ol></nav></div>
      <section className="hero">
        <div className="wrap">
          <div className="hero-banner">
            <span className="hero-parent"><Icon name="cap" size={14} />Published subject</span>
            <h1>{subject.name}</h1>
            <p className="lede">{subject.shortDescription ?? subject.overview ?? 'Explore the published pathways for this subject.'}</p>
            <div className="hero-metrics">
              <div className="hm"><div className="v">{subject.publishedCourseCount}</div><div className="k">Courses</div></div>
              <div className="hm"><div className="v">{subject.publishedSubSubjectCount}</div><div className="k">Specializations</div></div>
              <div className="hm"><div className="v">{subject.availableCountryCount}</div><div className="k">Countries</div></div>
            </div>
            <div className="hero-cta"><Link href={`/courses?subject=${subject.slug}`} className="btn btn-white">Explore Courses</Link><Link href={`/subjects/${subject.slug}/specializations`} className="btn btn-glass">View Specializations</Link></div>
          </div>
        </div>
      </section>
      <nav className="toc" aria-label="On this page"><div className="wrap toc-inner">{['glance', 'about', 'why', 'skills', 'curriculum', 'specializations', 'careers', 'countries', 'courses', 'faq'].map((id) => <a href={`#${id}`} key={id}>{id === 'glance' ? 'At a glance' : id}</a>)}</div></nav>
      <div className="wrap layout">
        <div className="main">
          <SubjectSection id="glance" eyebrow="Snapshot" title={`${subject.name} at a glance`}>
            <div className="kpi-grid">
              <div className="kpi"><span className="kk">Courses</span><strong className="kv">{subject.publishedCourseCount}</strong></div>
              <div className="kpi"><span className="kk">Specializations</span><strong className="kv">{subject.publishedSubSubjectCount}</strong></div>
              <div className="kpi"><span className="kk">Countries</span><strong className="kv">{subject.availableCountryCount}</strong></div>
            </div>
          </SubjectSection>
          <SubjectSection id="about" eyebrow="Overview" title={`About ${subject.name}`}><div className="prose"><p>{subject.overview ?? subject.shortDescription ?? 'A detailed overview is not yet published.'}</p></div></SubjectSection>
          <SubjectSection id="why" eyebrow="Make the case" title={`Why study ${subject.name}?`}><div className="grid g3"><EmptyTemplateState label="Subject benefits are not yet published" /></div></SubjectSection>
          <SubjectSection id="skills" eyebrow="Capabilities" title="Skills you’ll learn"><div className="grid g2"><EmptyTemplateState label="Skills are not yet published" /></div></SubjectSection>
          <SubjectSection id="curriculum" eyebrow="What you’ll study" title="Subjects you’ll study"><div className="grid g2"><EmptyTemplateState label="Curriculum information is not yet published" /></div></SubjectSection>
          <SubjectSection id="specializations" eyebrow="Focus areas" title="Specializations">
            <div className="grid g2">
              {subject.subSubjects.length ? subject.subSubjects.map((item) => <Link className="card spec-card" href={`/subjects/${subject.slug}/specializations#${item.slug}`} key={item.id}><span className="spec-ic"><Icon name="code" /></span><span><span className="sn">{item.name}</span><span className="sd">{item.shortDescription ?? 'Published specialization'}</span></span><Icon name="arrow" /></Link>) : <EmptyTemplateState label="No specializations are currently published" />}
            </div>
          </SubjectSection>
          <SubjectSection id="careers" eyebrow="Where it leads" title="Career opportunities"><div className="grid g3"><EmptyTemplateState label="Career outcomes are not yet published" /></div></SubjectSection>
          <SubjectSection id="countries" eyebrow="Where to study" title={`Best countries to study ${subject.name}`}><div className="grid g3"><EmptyTemplateState label="Country availability is not yet published" /></div></SubjectSection>
          <SubjectSection id="universities" eyebrow="Institutions" title="Top universities"><div className="grid g2"><EmptyTemplateState label="University availability is not yet published" /></div></SubjectSection>
          <SubjectSection id="courses" eyebrow="Programs" title="Popular courses"><div className="grid g3">{subject.featuredCourses.length ? subject.featuredCourses.map((course) => <CourseMiniCard course={course} key={course.id} />) : <EmptyTemplateState label="No featured courses are currently published" />}</div></SubjectSection>
          {[
            ['scholarships', 'Scholarships'],
            ['admissions', 'Admission requirements'],
            ['cost', 'Cost to study'],
            ['dashboard', 'Career outlook dashboard'],
            ['future', 'Future scope'],
            ['stories', 'Student success stories'],
            ['match', `Is ${subject.name} right for you?`],
            ['related', 'Related subjects'],
            ['resources', 'Resources & guides'],
            ['consultants', 'Find a study abroad consultant'],
            ['faq', 'Frequently asked questions'],
            ['explore', 'Explore more'],
          ].map(([id, title]) => <SubjectSection id={id} eyebrow="Published guidance" title={title} key={id}><EmptyTemplateState label={`${title} are not yet published`} /></SubjectSection>)}
        </div>
        <aside className="side"><div className="side-card"><span className="eyebrow">At a glance</span><h3>{subject.name}</h3><p>{subject.publishedCourseCount} published courses</p><Link href={`/courses?subject=${subject.slug}`} className="btn btn-primary btn-block">Browse courses</Link></div></aside>
      </div>
      <section className="section wrap"><div className="final-cta"><h2>Ready to study {subject.name} abroad?</h2><p>Explore published courses and compare your available options.</p><div className="cta-row"><Link href={`/courses?subject=${subject.slug}`} className="btn btn-secondary">Explore courses</Link><Link href="/counselling" className="btn btn-outline">Get guidance</Link></div></div></section>
      <CatalogFooter />
    </main>
  );
}

export function ApprovedSpecializations({ subject }: { subject: SubjectDetail }) {
  const [query, setQuery] = useState('');
  const filtered = subject.subSubjects.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <main className="visual-specializations-page">
      <CatalogHeader active="subjects" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li><Link href="/subjects">Subjects</Link></li><li className="sep">/</li><li><Link href={`/subjects/${subject.slug}`}>{subject.name}</Link></li><li className="sep">/</li><li>Specializations</li></ol></nav></div>
      <section className="hero"><div className="wrap hero-inner"><span className="parent-pill">{subject.name} · Specializations</span><h1>Explore {subject.name} <span>Specializations</span></h1><p className="lede">Choose from the focused pathways currently published for this subject.</p><div className="search-shell"><div className="search-box"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search specializations..." aria-label="Search specializations" /><button type="button" className="btn btn-primary">Find specializations</button></div></div><div className="hero-stats"><div className="hstat"><span className="num">{subject.publishedSubSubjectCount}</span><span className="lbl">Specializations</span></div><div className="hstat"><span className="num">{subject.availableCountryCount}</span><span className="lbl">Countries</span></div><div className="hstat"><span className="num">{subject.publishedCourseCount}</span><span className="lbl">Courses</span></div></div></div></section>
      <div className="wrap layout">
        <div className="main">
          {[
            ['popular', 'Popular specializations'],
            ['all', 'All specializations'],
          ].map(([id, title]) => <section className="section" id={id} key={id}><div className="section-head"><span className="eyebrow">Published pathways</span><h2>{title}</h2></div><div className="grid g3">{filtered.length ? filtered.map((item) => <article className="card spec-card" id={item.slug} key={`${id}-${item.id}`}><div className="spec-band" /><div className="spec-body"><div className="spec-top"><div className="spec-ic">{item.iconMedia ? <img src={item.iconMedia.url} alt={item.iconMedia.alt ?? ''} /> : <Icon name="code" />}</div><div><h3>{item.name}</h3></div></div><p className="spec-desc">{item.shortDescription ?? item.overview ?? 'Published specialization pathway'}</p><div className="spec-foot"><Link href={`/courses?subSubject=${item.slug}`} className="go">Explore courses <Icon name="arrow" size={14} /></Link></div></div></article>) : <EmptyTemplateState label="No specializations match this search" />}</div></section>)}
          {[
            ['categories', 'Browse by category'],
            ['careers', 'Career opportunities'],
            ['universities', 'Top universities'],
            ['courses', 'Popular courses'],
            ['scholarships', 'Scholarships'],
            ['best-countries', 'Best countries'],
            ['skills', 'Skills you’ll learn'],
            ['trends', 'Industry trends'],
            ['stories', 'Student success stories'],
            ['resources', 'Resources & guides'],
            ['faq', 'Frequently asked questions'],
            ['explore', 'Explore more'],
          ].map(([id, title]) => <section className="section" id={id} key={id}><div className="section-head"><span className="eyebrow">Published guidance</span><h2>{title}</h2></div><div className="grid g3"><EmptyTemplateState label={`${title} are not yet published`} /></div></section>)}
        </div>
        <aside className="side"><div className="side-card"><span className="eyebrow">Find your specialization</span><h3>Choose the right {subject.name} path</h3><p>Compare the currently published specializations.</p><Link href="/counselling" className="btn btn-primary btn-block">Get guidance</Link></div></aside>
      </div>
      <section className="section wrap"><div className="final-cta"><h2>Choose your {subject.name} specialization</h2><p>Continue from a published specialization into the course catalog.</p><div className="cta-row"><Link href={`/subjects/${subject.slug}`} className="btn btn-secondary">Back to subject</Link><Link href="/courses" className="btn btn-outline">Explore courses</Link></div></div></section>
      <CatalogFooter />
    </main>
  );
}

function CourseTemplateCard({
  course,
  selected,
  onCompare,
}: {
  course: Course;
  selected: boolean;
  onCompare: () => void;
}) {
  const tuition = course.selectedTuition;
  const duration = course.duration.min
    ? `${course.duration.min}${course.duration.max && course.duration.max !== course.duration.min ? `–${course.duration.max}` : ''} ${course.duration.unit ?? ''}`
    : 'Varies';
  const intake = course.selectedIntakes[0]?.intake?.shortLabel ?? course.selectedIntakes[0]?.intake?.name ?? 'Not published';
  return (
    <article className="course">
      <button type="button" className="save-btn" aria-label={`Save ${course.name}`}><Icon name="heart" /></button>
      <div className="course-top">
        <div className="uni-logo">{course.featuredMedia ? <img src={course.featuredMedia.url} alt={course.featuredMedia.alt ?? course.name} /> : course.name.slice(0, 2).toUpperCase()}</div>
        <div className="course-head">
          <div className="course-badges"><span className="badge badge-lvl"><Icon name="cap" size={12} />{course.courseLevel.name}</span>{course.scholarshipAvailable ? <span className="badge badge-sch"><Icon name="star" size={12} />Scholarships</span> : null}</div>
          <h3><Link href={`/courses/${course.slug}`}>{course.name}</Link></h3>
          <div className="uni">{course.subject.name}{course.selectedCountry ? ` · ${course.selectedCountry.name}` : ''}</div>
        </div>
      </div>
      <div className="course-facts">
        <div className="fact"><div className="k"><Icon name="clock" size={13} />Duration</div><div className="v">{duration}</div></div>
        <div className="fact"><div className="k"><Icon name="money" size={13} />Tuition</div><div className="v">{tuition?.min ? `${tuition.currencyCode ?? ''} ${Number(tuition.min).toLocaleString()}` : 'Not published'}</div></div>
        <div className="fact"><div className="k"><Icon name="calendar" size={13} />Next intake</div><div className="v">{intake}</div></div>
        <div className="fact"><div className="k"><Icon name="globe" size={13} />Countries</div><div className="v">{course.availableCountryCount}</div></div>
      </div>
      <div className="course-foot"><label className="cmp-check"><input type="checkbox" checked={selected} onChange={onCompare} /> Compare</label><div className="spacer" /><Link href={`/courses/${course.slug}`} className="btn btn-primary btn-sm">View course <Icon name="arrow" size={15} /></Link></div>
    </article>
  );
}

export function ApprovedCoursesListing({
  courses,
  meta,
  subjects,
  levels,
  modes,
  countries,
}: {
  courses: Course[];
  meta: PageMeta;
  subjects: Subject[];
  levels: Array<{ id: string; code: string; name: string; description: string | null }>;
  modes: Array<{ id: string; code: string; name: string; description: string | null }>;
  countries: Array<{ id: string; name: string; slug: string }>;
}) {
  const [compare, setCompare] = useState<string[]>([]);
  const toggle = (id: string) => setCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current);
  return (
    <main className="visual-courses-page">
      <CatalogHeader active="courses" />
      <div className="wrap crumbs"><nav aria-label="Breadcrumb"><ol><li><Link href="/">Home</Link></li><li className="sep">/</li><li>Courses</li></ol></nav></div>
      <section className="hero"><div className="wrap hero-inner"><span className="hero-pill"><span className="dot" /><b>{meta.total}</b> published programs</span><h1>Find the Perfect Course<br />to <span>Study Abroad</span></h1><p className="lede">Explore published programs and compare duration, tuition, intakes and destination availability.</p><form className="search-shell" action="/courses"><div className="search-box"><Icon name="search" /><input name="q" placeholder="Search courses, subjects or qualifications..." aria-label="Search courses" /><button type="submit" className="btn btn-primary">Find Courses</button></div></form><div className="chips">{levels.slice(0, 6).map((level) => <Link href={`/courses?level=${level.code}`} className="chip" key={level.id}><Icon name="cap" size={14} />{level.name}</Link>)}</div><div className="hero-ctas"><a href="#discovery" className="btn btn-primary">Find Courses</a><a href="#discovery" className="btn btn-secondary">Compare Courses</a><Link href="/signup" className="btn btn-outline">Create Free Account</Link></div></div></section>
      <section className="wrap" style={{ paddingBottom: 8 }}><div className="stats-grid"><div className="stat"><div className="num">{meta.total}</div><div className="lbl">Programs</div></div><div className="stat"><div className="num">{subjects.length}</div><div className="lbl">Subjects</div></div><div className="stat"><div className="num">{countries.length}</div><div className="lbl">Destinations</div></div><div className="stat"><div className="num">{levels.length}</div><div className="lbl">Degree levels</div></div><div className="stat"><div className="num">{modes.length}</div><div className="lbl">Study modes</div></div><div className="stat"><div className="num">{courses.filter((item) => item.scholarshipAvailable).length}</div><div className="lbl">Scholarship options</div></div></div></section>
      <section className="section wrap" id="subjects"><div className="section-head row-between"><div><span className="eyebrow">Explore</span><h2>Browse courses by popular subjects</h2></div><Link href="/subjects" className="link-more">All subjects <Icon name="arrow" size={16} /></Link></div><div className="grid g4">{subjects.length ? subjects.map((subject) => <Link href={`/courses?subject=${subject.slug}`} className="card subj-card" key={subject.id}><span className="subj-ic"><Icon name="book" /></span><h3>{subject.name}</h3><span className="subj-meta"><span><b>{subject.publishedCourseCount}</b> programs</span><span><b>{subject.availableCountryCount}</b> countries</span></span><span className="subj-foot"><span className="cnt">Explore</span><span className="go"><Icon name="arrow" size={15} /></span></span></Link>) : <EmptyTemplateState label="No subjects are currently published" />}</div></section>
      <section className="section wrap" id="discovery" style={{ paddingTop: 20 }}><div className="section-head"><span className="eyebrow">Discover → Filter → Compare</span><h2>Featured courses</h2><p className="sub">Search and compare the currently published programs.</p></div><div className="discovery"><aside className="filters"><div className="filters-head"><h3><Icon name="search" />Filters</h3></div><div className="filters-body"><form action="/courses">{[
        ['Degree level', 'level', levels.map((item) => [item.code, item.name])],
        ['Destination', 'country', countries.map((item) => [item.slug, item.name])],
        ['Subject', 'subject', subjects.map((item) => [item.slug, item.name])],
        ['Study mode', 'studyMode', modes.map((item) => [item.code, item.name])],
      ].map(([label, name, options]) => <div className="fgroup open" key={String(name)}><div className="fgroup-btn">{String(label)}</div><div className="fgroup-panel">{(options as string[][]).map(([value, option]) => <label className="fopt" key={value}><input type="radio" name={String(name)} value={value} /><span>{option}</span></label>)}</div></div>)}<button className="btn btn-primary btn-sm" type="submit">Apply filters</button></form></div></aside><div><div className="results-bar"><div className="results-count"><b>{meta.total}</b> courses match your search</div></div><div className="course-list">{courses.length ? courses.map((course) => <CourseTemplateCard course={course} selected={compare.includes(course.id)} onCompare={() => toggle(course.id)} key={course.id} />) : <EmptyTemplateState label="No courses are currently published" />}</div></div></div></section>
      {[
        ['degree-level', 'Browse courses by degree level', levels.map((item) => item.name)],
        ['destinations', 'Browse courses by study destination', countries.map((item) => item.name)],
        ['careers', 'Browse courses by career', []],
        ['categories', 'Explore by subject category', subjects.map((item) => item.name)],
        ['duration', 'Courses by duration', []],
        ['tuition', 'Courses by tuition fee', []],
        ['scholarships', 'Courses with scholarships', courses.filter((item) => item.scholarshipAvailable).map((item) => item.name)],
        ['outcomes', 'High career outcomes', []],
        ['why', 'Everything you need to choose with confidence', []],
        ['tools', 'Study abroad tools', []],
        ['events', 'Upcoming events', []],
        ['resources', 'Resources & guides', []],
        ['faq', 'Frequently asked questions', []],
      ].map(([id, title, items]) => <section className="section wrap" id={String(id)} key={String(id)}><div className="section-head"><span className="eyebrow">Published catalog</span><h2>{String(title)}</h2></div><div className="grid g4">{(items as string[]).length ? (items as string[]).map((item) => <Link href="/courses" className="card mini-card" key={item}><span className="mini-ic"><Icon name="book" /></span><span><h3>{item}</h3></span><span className="go"><Icon name="arrow" /></span></Link>) : <EmptyTemplateState label={`${String(title)} will appear when supporting data is published`} />}</div></section>)}
      <section className="section wrap"><div className="final-cta"><h2>Discover the right course for your future</h2><p>Explore the published catalog and compare your available options.</p><div className="cta-row"><a href="#discovery" className="btn btn-secondary">Find Courses</a><Link href="/counselling" className="btn btn-outline">Get guidance</Link></div></div></section>
      <CatalogFooter />
      {compare.length ? <div className="compare-bar"><strong>{compare.length} course{compare.length === 1 ? '' : 's'} selected</strong><button type="button" className="btn btn-primary btn-sm">Compare courses</button></div> : null}
    </main>
  );
}
