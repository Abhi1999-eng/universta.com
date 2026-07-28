'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { PageMeta, Subject } from '@/lib/catalog';

export function SubjectsExplorer({ subjects, meta }: { subjects: Subject[]; meta: PageMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const featured = useMemo(() => subjects.filter((subject) => subject.featured), [subjects]);
  const directory = useMemo(() => {
    const groups = new Map<string, Subject[]>();
    for (const subject of subjects) groups.set(subject.name[0]?.toUpperCase() ?? '#', [...(groups.get(subject.name[0]?.toUpperCase() ?? '#') ?? []), subject]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [subjects]);
  function submit(event: React.FormEvent) { event.preventDefault(); const next = new URLSearchParams(params.toString()); if (query.trim()) next.set('q', query.trim()); else next.delete('q'); next.delete('page'); router.push(`${pathname}${next.toString() ? `?${next}` : ''}`); }
  function page(value: number) { const next = new URLSearchParams(params.toString()); next.set('page', String(value)); router.push(`${pathname}?${next}`); }
  return <>
    <section className="catalog-explorer shell" aria-labelledby="subjects-results-heading">
      <div className="catalog-toolbar"><form onSubmit={submit}><label htmlFor="subject-search">Search subjects</label><div className="catalog-search"><input id="subject-search" role="searchbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by subject" /><button className="button" type="submit">Search</button></div></form><span className="result-count" role="status" aria-live="polite">{meta.total} {meta.total === 1 ? 'subject' : 'subjects'}</span></div>
      {subjects.length ? <div className="catalog-card-grid">{subjects.map((subject) => <SubjectCard key={subject.id} subject={subject} />)}</div> : <div className="empty-state"><h2 id="subjects-results-heading">No subjects found</h2><p>Published subject records will appear here when available.</p><Link className="button secondary" href="/subjects">Clear search</Link></div>}
      {meta.totalPages > 1 ? <nav className="pagination" aria-label="Subject pages"><button type="button" disabled={meta.page <= 1} onClick={() => page(meta.page - 1)}>Previous</button><span>Page {meta.page} of {meta.totalPages}</span><button type="button" disabled={meta.page >= meta.totalPages} onClick={() => page(meta.page + 1)}>Next</button></nav> : null}
    </section>
    <section className="parity-section" aria-labelledby="subject-popular-heading"><div className="shell"><div className="section-kicker"><p className="eyebrow">Published pathways</p><span className="result-count">{subjects.length} available</span></div><h2 id="subject-popular-heading">Explore published subjects</h2><p className="section-lede">Browse the same subject-first discovery pattern as the approved reference, using only Admin-managed published records.</p>{subjects.length ? <div className="catalog-card-grid">{subjects.slice(0, 6).map((subject) => <SubjectCard key={`popular-${subject.id}`} subject={subject} />)}</div> : <SafeOmission message="Popular-subject sample cards are omitted until published subject records exist." />}</div></section>
    <section className="parity-section soft-band" aria-labelledby="subject-featured-heading"><div className="shell"><p className="eyebrow">Editorial selection</p><h2 id="subject-featured-heading">Featured subjects</h2><p className="section-lede">Featured placement is controlled by the protected admin catalog.</p>{featured.length ? <div className="catalog-card-grid">{featured.map((subject) => <SubjectCard key={`featured-${subject.id}`} subject={subject} />)}</div> : <SafeOmission message="No featured subjects are published yet; illustrative reference metrics are not shown." />}</div></section>
    <section className="parity-section" aria-labelledby="subject-directory-heading"><div className="shell"><div className="section-kicker"><p className="eyebrow">A–Z directory</p><span className="result-count">Published records only</span></div><h2 id="subject-directory-heading">Browse subjects by name</h2><p className="section-lede">The directory is derived from the current published API response and never embeds sample subjects.</p>{directory.length ? <div className="subject-directory">{directory.map(([letter, items]) => <section className="directory-group" id={`subject-letter-${letter}`} key={letter}><h3>{letter}</h3>{items.map((subject) => <Link key={subject.id} href={`/subjects/${subject.slug}`}>{subject.name}<span aria-hidden="true">→</span></Link>)}</section>)}</div> : <SafeOmission message="The A–Z directory is omitted until published subjects are available." />}</div></section>
  </>;
}

function SubjectCard({ subject }: { subject: Subject }) { return <article className="catalog-card"><div className="catalog-card-visual">{subject.listingMedia ? <img src={subject.listingMedia.url} alt={subject.listingMedia.alt ?? subject.name} /> : <div className="catalog-card-placeholder" aria-hidden="true">{subject.name.slice(0, 1)}</div>}</div><div className="catalog-card-body"><div className="card-badges">{subject.featured ? <span>Featured</span> : null}<span>{subject.publishedCourseCount} published courses</span></div><h3>{subject.name}</h3><p>{subject.shortDescription ?? 'Explore published courses and study pathways.'}</p><div className="catalog-card-facts"><span>{subject.publishedSubSubjectCount} specialisations</span><span>{subject.availableCountryCount} countries</span></div><Link className="card-link" href={`/subjects/${subject.slug}`}>View subject <span aria-hidden="true">→</span></Link></div></article>; }
function SafeOmission(_props: { message: string }) { void _props; return null; }
