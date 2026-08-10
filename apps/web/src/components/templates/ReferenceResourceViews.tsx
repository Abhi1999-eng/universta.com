import Link from 'next/link';
import { intakeRange } from '@/lib/intake-range';
import { consultantContactActions } from '@/lib/consultant-contact';
import { RichText } from '@/components/phase1/RichText';
import type { AnyRecord, PageMeta } from '@/components/phase1/PhaseOneViews';

function title(row: AnyRecord) {
  return row.name ?? row.title ?? 'Published record';
}

function copy(row: AnyRecord) {
  return row.summary ?? row.shortDescription ?? row.description ?? row.overview ?? 'Published information is available for this record.';
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function Crumbs({ items }: { items: Array<[string, string?]> }) {
  return <nav className="reference-crumbs" aria-label="Breadcrumb"><ol>{items.map(([label, href], index) => <li key={`${label}-${index}`}>{href ? <Link href={href}>{label}</Link> : <span aria-current="page">{label}</span>}</li>)}</ol></nav>;
}

function DetailHero({
  eyebrow,
  title: heading,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="reference-detail-hero">
      <div className="reference-resource-wrap">
        <span>{eyebrow}</span>
        <h1>{heading}</h1>
        <p>{description}</p>
        {children}
      </div>
    </section>
  );
}

function InfoSection({ eyebrow, title: heading, children, soft = false }: { eyebrow: string; title: string; children: React.ReactNode; soft?: boolean }) {
  return <section className={`reference-resource-section${soft ? ' is-soft' : ''}`}><div className="reference-resource-wrap"><div className="reference-resource-heading"><span>{eyebrow}</span><h2>{heading}</h2></div>{children}</div></section>;
}

function FactGrid({ facts }: { facts: Array<[string, string | null | undefined]> }) {
  const present = facts.filter(([, value]) => Boolean(value));
  if (!present.length) return <p className="reference-empty">No additional published details are available.</p>;
  return <div className="reference-detail-facts">{present.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

export function ReferenceUniversityCourses({
  university,
  rows,
  meta,
  universitySlug,
}: {
  university?: { name?: string };
  rows: AnyRecord[];
  meta?: PageMeta;
  universitySlug: string;
}) {
  const universityName = university?.name ?? 'University';
  return (
    <main className="reference-resource-page reference-university-courses-page">
      <div className="reference-resource-wrap"><Crumbs items={[["Home", '/'], ['Universities', '/universities'], [universityName]]} /></div>
      <DetailHero eyebrow="University courses" title={`Courses at ${universityName}`} description="Explore the published programmes, levels, study modes, tuition and intake information available for this university.">
        <div className="reference-detail-actions"><Link href={`/universities/${universitySlug}`}>University overview</Link><Link href="/counselling">Ready to apply?</Link></div>
      </DetailHero>
      <InfoSection eyebrow="All programmes" title="Find the right programme">
        <div className="reference-offering-list">
          {rows.length ? rows.map((row) => <article key={row.id}><div><span className="reference-offering-monogram">{title(row).slice(0, 1)}</span><div><small>{row.genericCourse?.subject?.name ?? 'Published course'}</small><h3>{title(row)}</h3><p>{copy(row)}</p></div></div><FactGrid facts={[["Campus", row.campus?.name], ["Study mode", row.studyMode], ["Tuition", [row.currencyCode, row.tuitionMin, row.tuitionMax].filter(Boolean).join(' ') || null], ["Intakes", row.intakes?.map((intake) => intakeRange(intake.intake ?? {})).filter(Boolean).join(', ') || null]]} /><Link href={`/universities/${universitySlug}/courses/${row.slug ?? row.id}`}>View course →</Link></article>) : <p className="reference-empty">No published university course offerings are available.</p>}
        </div>
        {meta?.totalPages && meta.totalPages > 1 ? <p className="reference-pagination">Page {meta.page} of {meta.totalPages}</p> : null}
      </InfoSection>
      <InfoSection eyebrow="Explore" title={`Browse by faculty at ${universityName}`} soft><p className="reference-resource-copy">Use the published course filters and programme cards above to browse available subjects and study levels without leaving this university’s catalogue.</p></InfoSection>
      <InfoSection eyebrow="Dates" title="Intakes & deadlines"><p className="reference-resource-copy">Every intake shown on a course card is sourced from the currently published offering, including a start-to-end month range where available.</p></InfoSection>
      <section className="reference-resource-final"><div className="reference-resource-wrap"><h2>Find the right programme at {universityName}</h2><p>Shortlist a published course and use the available contact path when you are ready to discuss next steps.</p><Link href="/counselling">Book free counselling</Link></div></section>
    </main>
  );
}

export function ReferenceUniversityCourseDetail({ row, universitySlug }: { row: AnyRecord; universitySlug: string }) {
  const intakes = row.intakes?.map((entry) => intakeRange(entry.intake ?? {})).filter(Boolean).join(', ');
  return (
    <main className="reference-resource-page reference-course-detail-page">
      <div className="reference-resource-wrap"><Crumbs items={[["Home", '/'], ['Universities', '/universities'], ['University courses', `/universities/${universitySlug}/courses`], [title(row)]]} /></div>
      <DetailHero eyebrow={row.genericCourse?.subject?.name ?? 'University course'} title={title(row)} description={copy(row)}>
        <div className="reference-detail-actions"><Link href={`/counselling?source=course&from=${encodeURIComponent(`/universities/${universitySlug}/courses/${row.slug ?? row.id}`)}`}>Talk to a counsellor</Link>{row.applicationUrl ? <a href={row.applicationUrl} target="_blank" rel="noreferrer">Open official link</a> : null}</div>
      </DetailHero>
      <InfoSection eyebrow="Course highlights" title="About this programme"><FactGrid facts={[["University", row.university?.name], ["Campus", row.campus?.name], ["Study mode", row.studyMode], ["Tuition", [row.currencyCode, row.tuitionMin, row.tuitionMax].filter(Boolean).join(' ') || null], ["Intakes", intakes]]} /></InfoSection>
      <InfoSection eyebrow="Overview" title="Learning objectives" soft><RichText value={row.overview ?? row.description ?? 'This published programme has no additional overview.'} /></InfoSection>
      <InfoSection eyebrow="Eligibility" title="Entry requirements"><div className="reference-requirements">{row.requirements?.length ? row.requirements.map((requirement) => <article key={requirement.id}><h3>{requirement.title ?? 'Requirement'}</h3><p>{requirement.description ?? 'Published requirement information.'}</p></article>) : <p className="reference-empty">No entry requirements are published for this offering.</p>}</div></InfoSection>
      <InfoSection eyebrow="Dates" title="Intakes & deadlines" soft><FactGrid facts={[["Available intakes", intakes], ["Application deadline", row.deadline ? formatDate(row.deadline) : null]]} /></InfoSection>
      <section className="reference-resource-final"><div className="reference-resource-wrap"><h2>Ready to take the next step?</h2><p>Use the published course information as a starting point, then confirm requirements and dates with the university.</p><Link href="/counselling">Book free counselling</Link></div></section>
    </main>
  );
}

type ConsultantRecord = AnyRecord & {
  languages?: Array<{ id: string; language?: string | null; languageName?: string | null }>;
};

export function ReferenceConsultantDetail({ row }: { row: ConsultantRecord }) {
  const actions = consultantContactActions(row);
  const locations = row.locations?.map((item) => item.location?.name).filter(Boolean).join(', ');
  const countries = row.countries?.map((item) => item.country?.name).filter(Boolean).join(', ');
  const services = row.services?.map((item) => item.name).filter(Boolean).join(', ');
  const languages = row.languages?.map((item) => item.languageName ?? item.language).filter(Boolean).join(', ');
  return (
    <main className="reference-resource-page reference-consultant-detail-page">
      <div className="reference-resource-wrap"><Crumbs items={[["Home", '/'], ['Consultants', '/study-abroad-consultants'], [title(row)]]} /></div>
      <DetailHero eyebrow={row.verificationStatus ? String(row.verificationStatus).replaceAll('_', ' ') : 'Published consultant'} title={title(row)} description={copy(row)}>
        <div className="reference-detail-actions">{actions.map((action) => <a href={action.href} key={action.label} className={action.primary ? 'is-primary' : ''}>{action.label}</a>)}</div>
      </DetailHero>
      <InfoSection eyebrow="Quick overview" title="Why choose this consultant?"><FactGrid facts={[["Verification", row.verificationStatus], ["Locations", locations], ["Destination countries", countries], ["Services", services], ["Languages", languages]]} /></InfoSection>
      <InfoSection eyebrow="About" title="Consultant overview" soft><RichText value={row.overview ?? row.description ?? row.shortDescription ?? 'No additional consultant overview is published.'} /></InfoSection>
      <InfoSection eyebrow="Support" title="Services offered"><div className="reference-service-list">{row.services?.length ? row.services.map((service) => <span key={service.id}>{service.name ?? 'Published service'}</span>) : <span>No published services</span>}</div></InfoSection>
      <InfoSection eyebrow="Locations" title="Office locations" soft><FactGrid facts={[["Published locations", locations], ["Contact email", row.email], ["Contact phone", row.phone]]} /></InfoSection>
      <section className="reference-resource-final"><div className="reference-resource-wrap"><h2>Need a separate Universta counselling conversation?</h2><p>Consultant contact remains separate. Use this optional Universta path for general platform guidance.</p><Link href="/counselling">Book counselling with Universta</Link></div></section>
    </main>
  );
}
