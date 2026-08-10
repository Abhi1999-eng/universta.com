import Link from 'next/link';

type Named = { name?: string | null; slug?: string | null };
type ListingRow = {
  id: string;
  name?: string | null;
  title?: string | null;
  slug?: string | null;
  shortDescription?: string | null;
  summary?: string | null;
  country?: Named | null;
  provider?: Named | null;
  university?: Named | null;
  services?: Array<{ name?: string | null; serviceName?: string | null }> | null;
  countries?: Array<{ country?: Named | null }> | null;
};

type DirectoryItem = { name: string; slug: string };

function recordTitle(row: ListingRow) {
  return row.name ?? row.title ?? 'Published record';
}

function recordSummary(row: ListingRow) {
  return row.shortDescription ?? row.summary ?? 'View the published record and its available details.';
}

function Section({
  eyebrow,
  title,
  description,
  soft = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  soft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`reference-section${soft ? ' reference-section-soft' : ''}`}>
      <div className="reference-wrap">
        <div className="reference-section-head">
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function DirectoryGrid({
  items,
  href,
  empty,
}: {
  items: DirectoryItem[];
  href: (item: DirectoryItem) => string;
  empty: string;
}) {
  if (!items.length) return <p className="reference-empty">{empty}</p>;
  return (
    <div className="reference-directory-grid">
      {items.map((item) => (
        <Link href={href(item)} key={item.slug} className="reference-directory-card">
          <span aria-hidden="true">↗</span>
          <strong>{item.name}</strong>
          <small>Explore published options</small>
        </Link>
      ))}
    </div>
  );
}

function FeatureCards({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <div className="reference-feature-grid">
      {items.map((item) => (
        <article className="reference-feature-card" key={item.title}>
          <span aria-hidden="true">✦</span>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

function Faq({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <div className="reference-faq">
      {items.map((item, index) => (
        <details key={item.question} open={index === 0}>
          <summary>{item.question}<span aria-hidden="true">+</span></summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function UniversityListingIntro({
  countries,
  rows,
}: {
  countries: DirectoryItem[];
  rows: ListingRow[];
}) {
  return (
    <div className="reference-listing-sections reference-universities">
      <Section
        eyebrow="Study destinations"
        title="Browse universities by study destination"
        description="Start with a published destination, then review the universities and courses currently available."
      >
        <DirectoryGrid
          items={countries.slice(0, 6)}
          href={(country) => `/universities?country=${encodeURIComponent(country.slug)}`}
          empty="Published destinations will appear here when available."
        />
      </Section>
      <Section
        eyebrow="Featured"
        title="Featured universities"
        description="These are real published university records from the Universta catalogue."
        soft
      >
        <div className="reference-record-grid">
          {rows.slice(0, 3).map((row) => (
            <Link href={`/universities/${row.slug ?? row.id}`} className="reference-record-card" key={row.id}>
              <span className="reference-record-monogram">{recordTitle(row).slice(0, 1)}</span>
              <small>{row.country?.name ?? 'Published university'}</small>
              <h3>{recordTitle(row)}</h3>
              <p>{recordSummary(row)}</p>
              <b>View university →</b>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

export function UniversityListingOutro({
  countries,
  subjects,
}: {
  countries: DirectoryItem[];
  subjects: DirectoryItem[];
}) {
  return (
    <div className="reference-listing-sections reference-universities">
      <Section eyebrow="Explore" title="Browse universities by study level" description="Use the available filters to narrow the published catalogue by the course level that suits your plan.">
        <FeatureCards items={[
          { title: 'Foundation pathways', body: 'Review universities with published foundation-level offerings.' },
          { title: 'Undergraduate study', body: 'Explore published bachelor-level course options.' },
          { title: 'Postgraduate study', body: 'Compare published graduate and professional programmes.' },
          { title: 'Research pathways', body: 'Review published doctoral and research-oriented offerings.' },
        ]} />
      </Section>
      <Section eyebrow="By subject" title="Browse universities by subject" description="Every link keeps the real public university filters connected to the URL." soft>
        <DirectoryGrid items={subjects.slice(0, 8)} href={(subject) => `/universities?subject=${encodeURIComponent(subject.slug)}`} empty="Published subjects will appear here when available." />
      </Section>
      <Section eyebrow="By country" title="Universities by country" description="Open a country-specific university directory without losing the available search and filter behaviour.">
        <DirectoryGrid items={countries.slice(0, 8)} href={(country) => `/universities?country=${encodeURIComponent(country.slug)}`} empty="Published destinations will appear here when available." />
      </Section>
      <Section eyebrow="Why Universta" title="Compare published university information in one place" soft>
        <FeatureCards items={[
          { title: 'Structured records', body: 'University, campus and course information is presented from published catalogue data.' },
          { title: 'Useful filters', body: 'Filter by destination, subject and location with shareable URLs.' },
          { title: 'Course connections', body: 'Move from a university profile to its published course offerings.' },
          { title: 'Clear next steps', body: 'Use the public catalogue as a starting point for a counselling conversation.' },
        ]} />
      </Section>
      <section className="reference-final-cta">
        <div className="reference-wrap">
          <h2>Find your dream university today</h2>
          <p>Use the published catalogue to shortlist destinations, universities and available courses.</p>
          <div><Link href="/countries">Explore destinations</Link><Link href="/counselling">Book free counselling</Link></div>
        </div>
      </section>
    </div>
  );
}

export function ScholarshipListingOutro({
  countries,
  subjects,
}: {
  countries: DirectoryItem[];
  subjects: DirectoryItem[];
}) {
  return (
    <div className="reference-listing-sections reference-scholarships">
      <Section eyebrow="Explore" title="Browse scholarships by category" description="Start with a real destination or subject filter and keep the public results shareable." soft>
        <div className="reference-category-columns">
          <div><h3>By country</h3>{countries.slice(0, 6).map((country) => <Link href={`/scholarships?country=${encodeURIComponent(country.slug)}`} key={country.slug}>Scholarships in {country.name}</Link>)}</div>
          <div><h3>By subject</h3>{subjects.slice(0, 6).map((subject) => <Link href={`/scholarships?subject=${encodeURIComponent(subject.slug)}`} key={subject.slug}>{subject.name} scholarships</Link>)}</div>
          <div><h3>By degree</h3>{['Foundation', 'Bachelor’s', 'Master’s', 'MBA', 'PhD'].map((level) => <Link href={`/scholarships?degreeLevel=${encodeURIComponent(level)}`} key={level}>{level} scholarships</Link>)}</div>
          <div><h3>By funding type</h3>{['Fully funded', 'Merit-based', 'Need-based', 'University awards'].map((type) => <Link href="/scholarships" key={type}>{type}</Link>)}</div>
        </div>
      </Section>
      <Section eyebrow="Why Universta" title="Why use the Universta Scholarship Finder?">
        <FeatureCards items={[
          { title: 'Published scholarship records', body: 'Review opportunities that have been published through the catalogue.' },
          { title: 'Smart search and filters', body: 'Narrow the live listing using destination, level, subject and funding filters.' },
          { title: 'Structured details', body: 'See the provider, benefit, eligibility and deadline information that is available.' },
          { title: 'Direct next steps', body: 'Open an official application link only where the provider has supplied one.' },
        ]} />
      </Section>
      <Section eyebrow="Answers" title="Frequently asked questions" soft>
        <Faq items={[
          { question: 'What is a fully funded scholarship?', answer: 'Funding terms are set by the provider. Review each published scholarship record for its stated benefit and eligibility details.' },
          { question: 'Who can apply for international scholarships?', answer: 'Eligibility varies by scholarship. Check the provider’s published conditions and official application information.' },
          { question: 'How do I find scholarships for my course?', answer: 'Use the destination, degree and subject filters to narrow the currently published opportunities.' },
          { question: 'When should I apply?', answer: 'Review the deadline shown on the published record and confirm timing directly with the provider.' },
        ]} />
      </Section>
      <section className="reference-final-cta">
        <div className="reference-wrap"><h2>Discover scholarships that match your goals</h2><p>Use published information to build a shortlist, then confirm all details with the funding provider.</p><div><Link href="/scholarships">Browse scholarships</Link><Link href="/counselling">Book free counselling</Link></div></div>
      </section>
    </div>
  );
}

export function ConsultantListingIntro({ countries }: { countries: DirectoryItem[] }) {
  return (
    <div className="reference-listing-sections reference-consultants">
      <Section eyebrow="Study destinations" title="Popular study destinations" description="Choose a published destination to find consultants with the relevant destination-country relationship.">
        <DirectoryGrid items={countries.slice(0, 8)} href={(country) => `/study-abroad-consultants?country=${encodeURIComponent(country.slug)}`} empty="Published destination countries will appear here when available." />
      </Section>
      <section className="reference-callout"><div className="reference-wrap"><div><span>Need help choosing the right consultant?</span><p>Review services, languages, locations and published destination-country relationships before you contact a consultant.</p></div><Link href="/counselling">Book free counselling</Link></div></section>
    </div>
  );
}

export function ConsultantListingOutro({
  countries,
  services,
}: {
  countries: DirectoryItem[];
  services: string[];
}) {
  return (
    <div className="reference-listing-sections reference-consultants">
      <Section eyebrow="How it works" title="Why work with a study abroad consultant?" soft>
        <FeatureCards items={[
          { title: 'Compare published services', body: 'Review each consultant’s services, languages and listed destinations.' },
          { title: 'Contact the right organisation', body: 'Consultant pages show their own contact actions when that data is available.' },
          { title: 'Keep the choice clear', body: 'Consultant contact and Universta counselling remain separate flows.' },
          { title: 'Use real locations', body: 'Open published consultant locations to make the local context clear.' },
        ]} />
      </Section>
      <Section eyebrow="Browse every destination" title="Study abroad consultants by continent">
        <DirectoryGrid items={countries.slice(0, 8)} href={(country) => `/study-abroad-consultants?country=${encodeURIComponent(country.slug)}`} empty="Published destination countries will appear here when available." />
      </Section>
      <Section eyebrow="Services" title="What a consultant can help with" soft>
        <div className="reference-service-list">{services.slice(0, 10).map((service) => <span key={service}>{service}</span>)}</div>
      </Section>
      <Section eyebrow="Answers" title="Frequently asked questions">
        <Faq items={[
          { question: 'How do I choose a consultant?', answer: 'Review the published destination countries, locations, services and languages, then contact the organisation directly.' },
          { question: 'What is the difference between a consultant and Universta counselling?', answer: 'A consultant is an independent listed organisation. Universta counselling is a separate platform service.' },
          { question: 'Can I contact a consultant directly?', answer: 'Where contact details are published, the consultant profile provides direct contact actions.' },
        ]} />
      </Section>
      <section className="reference-final-cta"><div className="reference-wrap"><h2>Start your global education journey today</h2><p>Explore destinations, compare published consultant profiles and choose a clear next step.</p><div><Link href="/countries">Explore destinations</Link><Link href="/counselling">Book free counselling</Link></div></div></section>
    </div>
  );
}
