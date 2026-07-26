import Link from 'next/link';
import type { CourseDetail } from '@/lib/catalog';
import { counsellingHref } from '@/lib/counselling-link';

type AvailabilityItem = {
  id: string;
  country?: { name?: string; slug?: string };
  tuition?: { min?: string | null; currencyCode?: string | null; period?: string };
  sourceReference?: string | null;
  verifiedAt?: string | null;
};

function money(value: string | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined || !currency) return null;
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value)); } catch { return `${currency} ${value}`; }
}

function period(value: string | undefined) {
  return ({ PER_YEAR: 'per year', PER_SEMESTER: 'per semester', PER_MONTH: 'per month', TOTAL: 'total' } as Record<string, string>)[value ?? ''] ?? value;
}

function paragraphs(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('paragraphs' in body)) return [];
  const values = (body as { paragraphs?: unknown }).paragraphs;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : [];
}

export function CoursePageView({ course, country }: { course: CourseDetail; country?: string }) {
  const availability = course.availability as AvailabilityItem[];
  const mapping = country ? (availability.find((item) => item.country?.slug === country) ?? null) : null;
  return <main>
    <header className="site-header"><div className="shell header-inner"><Link className="brand" href="/courses">universta<span>.</span></Link><nav aria-label="Primary navigation"><Link href="/subjects">Subjects</Link><Link href="/courses">Courses</Link><Link href="/countries">Countries</Link></nav></div></header>
    <section className="detail-hero"><div className="shell detail-hero-grid"><div><Link className="back-link" href="/courses">← All courses</Link><p className="eyebrow">{course.subject.name}{course.subSubject ? ` · ${course.subSubject.name}` : ''}</p><h1>{course.name}</h1><p className="hero-copy">{course.qualificationName ?? course.shortDescription ?? 'Published course details and verified country availability.'}</p><div className="hero-chips"><span>{course.courseLevel.name}</span>{course.studyModes.map((mode) => <span key={mode.id}>{mode.name}</span>)}<span>{course.duration.min ?? '—'}–{course.duration.max ?? '—'} {course.duration.unit?.toLowerCase() ?? ''}</span></div><div className="hero-actions"><Link className="button" href={counsellingHref({ source: 'course', course: course.slug, ...(country ? { country } : {}), from: `/courses/${course.slug}` })}>Talk to a counsellor</Link></div></div><div className="hero-card">{course.featuredMedia ? <img src={course.featuredMedia.url} alt={course.featuredMedia.alt ?? course.name} /> : <div className="hero-placeholder" aria-hidden="true">{course.name.slice(0, 1)}</div>}<span>{course.availableCountryCount} countries</span><small>{course.credits ? `${course.credits} credits` : 'Structured course data'}</small></div></div></section>
    <section className="detail-content shell"><div className="detail-main">
      <section className="editorial-section" aria-labelledby="course-overview"><p className="eyebrow">Course overview</p><h2 id="course-overview">What you will explore</h2><p>{course.overview ?? course.shortDescription ?? 'Course overview is not available yet.'}</p>{course.careerSummary ? <p>{course.careerSummary}</p> : null}</section>
      <section className="editorial-section" aria-labelledby="course-availability"><p className="eyebrow">Availability</p><h2 id="course-availability">Choose a country</h2><div className="country-choice-grid">{availability.map((item) => <Link className={item.country?.slug === country ? 'country-choice active' : 'country-choice'} href={`/courses/${course.slug}?country=${encodeURIComponent(item.country?.slug ?? '')}`} key={item.id}><strong>{item.country?.name ?? 'Country'}</strong><span>{item.tuition?.min && money(item.tuition.min, item.tuition.currencyCode) ? `${money(item.tuition.min, item.tuition.currencyCode)} ${period(item.tuition.period)}` : 'Indicative tuition unavailable'}</span></Link>)}</div></section>
      {course.contentSections.map((section) => { const content = paragraphs(section.bodyJson); return <section className="editorial-section" id={section.sectionKey} key={section.id}><p className="eyebrow">Course content</p><h2>{section.heading ?? section.sectionKey.replaceAll('-', ' ')}</h2>{section.subheading ? <p>{section.subheading}</p> : null}<div className="editorial-copy">{content.length ? content.map((paragraph) => <p key={paragraph}>{paragraph}</p>) : <p>Structured content is available for this section.</p>}</div></section>; })}
      {course.faqs.length ? <section className="editorial-section" aria-labelledby="course-faqs"><p className="eyebrow">Questions</p><h2 id="course-faqs">Frequently asked questions</h2><div className="faq-list">{course.faqs.map((faq) => <details key={faq.id}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section> : null}
      {course.relatedCourses.length ? <section className="editorial-section"><p className="eyebrow">Related courses</p><h2>Keep exploring</h2><div className="catalog-card-grid">{course.relatedCourses.map((item) => <article className="catalog-card compact" key={item.id}><div className="catalog-card-body"><h3>{item.name}</h3><p>{item.qualificationName ?? item.shortDescription}</p><Link className="card-link" href={`/courses/${item.slug}`}>View course <span aria-hidden="true">→</span></Link></div></article>)}</div></section> : null}
      <p className="source-note">Course-country facts are indicative and require verification with the linked official source where provided. Universta does not guarantee admission, visa outcomes, scholarships, work rights, or career outcomes.</p>
    </div><aside className="facts-panel"><p className="eyebrow">{course.selectedCountry?.name ?? 'Course facts'}</p><h2>{course.selectedTuition?.min && money(course.selectedTuition.min, course.selectedTuition.currencyCode) ? money(course.selectedTuition.min, course.selectedTuition.currencyCode) : 'Tuition not listed'}</h2>{course.selectedTuition?.period ? <div className="fact"><span>Tuition period</span><strong>{period(course.selectedTuition.period)}</strong></div> : null}<div className="fact"><span>Study modes</span><strong>{course.studyModes.map((mode) => mode.name).join(', ') || 'Not listed'}</strong></div><div className="fact"><span>Intakes</span><strong>{course.selectedIntakes.map((item) => item.intake?.shortLabel ?? item.intake?.name).filter(Boolean).join(', ') || 'Not listed'}</strong></div>{mapping?.sourceReference ? <p className="source-note"><a href={mapping.sourceReference} target="_blank" rel="noreferrer">View source</a>{mapping.verifiedAt ? ` · verified ${new Date(mapping.verifiedAt).toLocaleDateString('en-US')}` : ''}</p> : null}<Link className="button" href="/countries">Explore countries</Link></aside></section>
    <footer className="site-footer"><div className="shell footer-grid"><div><Link className="brand" href="/courses">universta<span>.</span></Link><p>Structured, source-aware study guidance.</p></div><p className="footer-note">Information may vary by institution, programme, applicant, and policy.</p></div></footer>
  </main>;
}
