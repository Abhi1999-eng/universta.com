'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDate, formatNumber } from '@/lib/format';
import { universityCoursesHref } from '@/lib/university-links';
import { universityInitials } from '@/lib/university-initials';
import {
  UNIVERSITY_COMPARE_LIMIT as MAX,
  universityCompareHref,
  universityCompareSlugs,
  type CompareUniversity,
} from '@/lib/university-compare';
import { Crumbs } from '@/components/study-abroad/Crumbs';

export type { CompareUniversity } from '@/lib/university-compare';

export type UniversityCompareReferenceProps = {
  items: CompareUniversity[];
  invalid: string[];
  options: Array<{ slug: string; name: string }>;
  selected: string[];
  unavailable?: boolean;
};

const humanise = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (character) => character.toUpperCase());
const coursesHref = (item: CompareUniversity) => item.countrySlug
  ? universityCoursesHref(item.countrySlug, item.slug) : `/universities/${item.slug}/courses`;

/** The final ZIP's comparison, with recorded fields and a shareable address. */
export function UniversityCompareReference({ items, options, selected, invalid, unavailable = false }: UniversityCompareReferenceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const selectedKey = selected.join(',');
  const picked = items.map((item) => item.slug);
  const [direct, setDirect] = useState<string[]>(picked);
  const [directFor, setDirectFor] = useState(selectedKey);
  const queued = useRef<{ key: string; slugs: string[] } | null>(null);
  useEffect(() => {
    queued.current = null;
  }, [selectedKey]);
  if (directFor !== selectedKey) {
    setDirect(picked);
    setDirectFor(selectedKey);
  }
  const validSelection = universityCompareSlugs(selected.filter((slug) => items.some((item) => item.slug === slug) || options.some((option) => option.slug === slug)));
  const [draft, setDraft] = useState<string[]>(validSelection);
  const [draftFor, setDraftFor] = useState(selectedKey);
  if (draftFor !== selectedKey) {
    setDraft(validSelection);
    setDraftFor(selectedKey);
  }
  const [query, setQuery] = useState('');
  function commit(next: string[]) {
    const slugs = universityCompareSlugs(next);
    queued.current = { key: selectedKey, slugs };
    setDirect(slugs);
    setDraft(slugs);
    startTransition(() => router.push(universityCompareHref(slugs)));
  }

  const label = (slug: string) => options.find((option) => option.slug === slug)?.name ?? items.find((item) => item.slug === slug)?.name ?? slug;
  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => !draft.includes(option.slug) && (!needle || option.name.toLowerCase().includes(needle) || option.slug.toLowerCase().includes(needle)));
  }, [options, query, draft]);
  const dropdownOptions = options.filter((option) => !direct.includes(option.slug));
  const rows: Array<[string, (item: CompareUniversity) => ReactNode]> = [
    ['Location', (item) => [...(item.cities ?? []), item.country].filter(Boolean).join(', ') || 'Not listed'],
    ['Destination', (item) => item.country ?? 'Not listed'],
    ['Institution type', (item) => item.institutionType ? humanise(item.institutionType) : 'Not listed'],
    ['QS ranking', (item) => item.qsRanking ? `#${formatNumber(item.qsRanking)}` : 'Not listed'],
    ['Tuition', (item) => <><span className="uc-none">Not listed at university level</span>{item.offerings > 0 ? <Link className="cmpnote textlink" href={coursesHref(item)}>View programme fees</Link> : null}</>],
    ['Published programmes', (item) => item.offerings > 0 ? <Link className="textlink" href={coursesHref(item)}><b>{formatNumber(item.offerings)}</b></Link> : '0'],
    ['Campuses', (item) => formatNumber(item.campuses)],
    ['Accreditations', (item) => item.accreditations.length ? item.accreditations.join(', ') : 'Not listed'],
    ['Record verified', (item) => formatDate(item.verifiedAt) || 'Not verified'],
    ['Summary', (item) => item.shortDescription ?? 'Not listed'],
  ];

  return (
    <div className="universitycompare">
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'Universities', href: '/universities' }, { label: 'Compare' }]} />
          <div className="hero__lead">
            <p className="hero__eyebrow">Comparison<b>·</b>up to {MAX} universities</p>
            <h1 className="hero__h1">Compare universities side by side</h1>
            <p className="hero__sub">Compare published institutions on location, programmes, campuses and the information each record provides.</p>
          </div>
          <div className="comparepick">
            <label className="sr-only" htmlFor="compare-add-universities">Add a university to the comparison</label>
            <select
              className="comparepick__select"
              id="compare-add-universities"
              data-testid="university-compare-add"
              value=""
              disabled={pending || direct.length >= MAX || dropdownOptions.length === 0}
              onChange={(event) => {
                const value = event.target.value;
                if (value) {
                  // A second pick can arrive before the first page read.
                  // Carry the queued selection, independently of the search draft.
                  const current = queued.current?.key === selectedKey ? queued.current.slugs : picked;
                  commit([...current, value]);
                }
              }}
            >
              <option value="">{direct.length >= MAX ? 'Five universities selected' : options.length ? 'Add a university…' : 'No published universities available'}</option>
              {dropdownOptions.map((option) => <option key={option.slug} value={option.slug}>{option.name}</option>)}
            </select>
            <button className="btn btn--ghost btn--sm" type="button" data-testid="university-compare-clear" disabled={pending} onClick={() => { setQuery(''); commit([]); }}>Clear all</button>
          </div>

          {/* The existing search-and-pick flow remains available, without
              displacing the reference's direct comparison picker. */}
          <details className="uni-comparison-search">
            <summary>Search published universities</summary>
            <div className="cmp-picker">
              <div className="cmp-search">
                <label htmlFor="compare-search-universities">Search published universities</label>
                <input id="compare-search-universities" type="search" value={query} placeholder="Search by name" onChange={(event) => setQuery(event.target.value)} />
              </div>
              {available.length ? (
                <div className="cmp-options" role="list" aria-label="Available universities">
                  {available.slice(0, 8).map((option) => <button className="chipbtn" type="button" key={option.slug} disabled={pending || draft.length >= MAX} onClick={() => { setDraft((current) => universityCompareSlugs([...current, option.slug])); setQuery(''); }}>Add {option.name}</button>)}
                </div>
              ) : <p className="cmp-note">{options.length ? 'No published university matches that search.' : 'No published universities yet.'}</p>}
              <div className="cmp-chosen" aria-label="Selected comparison items">
                {draft.map((slug) => <span key={slug}>{label(slug)}<button type="button" aria-label={`Remove ${label(slug)} from selection`} disabled={pending} onClick={() => setDraft((current) => current.filter((item) => item !== slug))}>×</button></span>)}
              </div>
              <p className="cmp-note" role="status">{draft.length}/{MAX} selected. Choose at least two.</p>
              <button className="btn btn--sm" type="button" disabled={pending || draft.length < 2} onClick={() => commit(draft)}>Compare selected</button>
            </div>
          </details>
        </div>
      </section>

      <section className="sec sec--white" id="comparison">
        <div className="wrap">
          {invalid.length ? <p className="callout uni-comparison-notice">Not published, so left out of the comparison: {invalid.join(', ')}.</p> : null}
          {unavailable ? <p className="callout uni-comparison-notice" role="status">The university comparison could not be loaded. Please try again.</p> : null}
          {items.length ? (
            <>
              <div className="tablewrap uni-comparison-table" role="region" aria-label="University comparison" aria-busy={pending} tabIndex={0} data-testid="compare-table-wrap">
                <table className="data comparetable" data-testid="compare-table" style={{ minWidth: `${Math.max(720, 190 + items.length * 190)}px` }}>
                  <caption className="sr-only">University comparison</caption>
                  <thead><tr><th scope="col"><span className="sr-only">Field</span></th>{items.map((item) => <th scope="col" key={item.slug}>
                    <span className="cmphead">
                      <span className="unimark unimark--xs" aria-hidden="true">{universityInitials(item.name)}</span>
                      <Link className="cmphead__name" href={`/universities/${item.slug}`}>{item.name}</Link>
                      <span className="cmphead__meta">{[...(item.cities ?? []), item.country].filter(Boolean).join(', ') || 'Location not listed'}</span>
                      <Link className="cmpremove" href={universityCompareHref(selected.filter((slug) => slug !== item.slug))} aria-label={`Remove ${item.name} from the comparison`} aria-disabled={pending || undefined} tabIndex={pending ? -1 : undefined} onClick={(event) => { if (pending) event.preventDefault(); }}>Remove</Link>
                    </span>
                  </th>)}</tr></thead>
                  <tbody>{rows.map(([field, render]) => <tr key={field}><th scope="row">{field}</th>{items.map((item) => <td key={item.slug}>{render(item)}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <p className="trust__note">Tuition and entry requirements vary by programme. Open a university’s published programmes for its listed fees and requirements.</p>
              <details className="uni-comparison-cards">
                <summary>Read universities as individual cards</summary>
                <div className="uni-comparison-cardgrid">{items.map((item) => <article className="uni-comparison-card" key={item.slug}>
                  <h3><Link href={`/universities/${item.slug}`}>{item.name}</Link></h3>
                  <dl>{rows.map(([field, render]) => <div key={field}><dt>{field}</dt><dd>{render(item)}</dd></div>)}</dl>
                </article>)}</div>
              </details>
              <div className="priorities">
                <p className="eyebrow eyebrow--plain">Your priorities</p>
                <h2 className="sec-title">There is no universal winner</h2>
                <p className="sec-lead">Your programme, marks, budget and target intake shape the choice. Compare the published information here, then check the requirements of the courses you want to study.</p>
              </div>
            </>
          ) : !unavailable ? (
            <div className="compare-empty" data-testid="compare-empty">
              <p className="ov__lead">Nothing selected yet.</p>
              <p className="sec-lead">Add up to {MAX} universities above, or use the Compare button on a university card. The address keeps your selection so you can share it.</p>
              <div className="btn-row"><Link className="btn" href="/universities">Browse universities <span className="btn__arrow" aria-hidden="true">→</span></Link></div>
            </div>
          ) : null}
          <div className="magnet uni-comparison-counselling">
            <div><h3 className="magnet__t">Need a second opinion on the shortlist?</h3><p className="magnet__b">A counsellor can weigh these institutions against your marks, budget and target intake.</p></div>
            <Link className="btn btn--onnavy btn--lg" href="/counselling">Book free counselling <span className="btn__arrow" aria-hidden="true">→</span></Link>
          </div>
          <div className="btn-row uni-comparison-browse"><Link className="linkcta" href="/universities">Browse universities <span className="linkcta__arrow" aria-hidden="true">→</span></Link></div>
        </div>
      </section>
    </div>
  );
}
