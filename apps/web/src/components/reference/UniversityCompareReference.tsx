'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { formatDate, formatNumber } from '@/lib/format';

/** The client-approved university comparison page.
 *
 * The template compares on rankings, tuition by level, acceptance rate, cost
 * of living, accommodation, campus facilities, student life and career
 * outcomes, and closes with a "best fit" recommendation scored from those
 * numbers. Universta records none of them, and a recommendation computed from
 * data that does not exist would be the least honest thing on the site — so
 * the table carries the fields the university record actually holds, and the
 * scoring, dashboard and pros/cons blocks are omitted. */

export type CompareUniversity = {
  name: string;
  slug: string;
  country: string | null;
  institutionType: string | null;
  shortDescription: string | null;
  campuses: number;
  offerings: number;
  accreditations: string[];
  verifiedAt: string | null;
  featured: boolean;
};

export type UniversityCompareReferenceProps = {
  items: CompareUniversity[];
  /** Slugs requested that matched no published record. */
  invalid: string[];
  options: Array<{ slug: string; name: string }>;
  selected: string[];
};

const MAX = 3;

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

export function UniversityCompareReference(props: UniversityCompareReferenceProps) {
  const { items, options, selected } = props;
  const router = useRouter();
  const pathname = usePathname();

  /** A shortlist is built up, then compared. Navigating on every pick would
   * reload the page two or three times on the way to a comparison, and would
   * publish half-finished shortlists into the visitor's history. */
  const selectedKey = selected.join(',');
  const [draft, setDraft] = useState<string[]>(() => selected.slice(0, MAX));
  const [draftFor, setDraftFor] = useState(selectedKey);
  if (draftFor !== selectedKey) {
    setDraft(selected.slice(0, MAX));
    setDraftFor(selectedKey);
  }
  const [query, setQuery] = useState('');

  function go(next: string[]) {
    const unique = [...new Set(next)].slice(0, MAX);
    router.push(unique.length ? `${pathname}?items=${unique.join(',')}` : pathname);
  }

  function label(slug: string) {
    return options.find((option) => option.slug === slug)?.name ?? slug;
  }

  const available = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => {
      if (draft.includes(option.slug)) return false;
      if (!needle) return true;
      return (
        option.name.toLowerCase().includes(needle) ||
        option.slug.toLowerCase().includes(needle)
      );
    });
  }, [options, query, draft]);

  const rows: Array<[string, (item: CompareUniversity) => React.ReactNode]> = [
    ['Destination', (item) => item.country ?? '—'],
    ['Institution type', (item) => (item.institutionType ? humanise(item.institutionType) : '—')],
    [
      'Published programmes',
      (item) =>
        item.offerings ? (
          <Link href={`/universities/${item.slug}/courses`} style={{ color: 'var(--blue)' }}>
            <b>{formatNumber(item.offerings)}</b>
          </Link>
        ) : (
          '—'
        ),
    ],
    ['Campuses', (item) => (item.campuses ? <b>{formatNumber(item.campuses)}</b> : '—')],
    [
      'Accreditations',
      (item) => (item.accreditations.length ? item.accreditations.join(', ') : '—'),
    ],
    [
      'Record verified',
      (item) => (item.verifiedAt ? formatDate(item.verifiedAt) : 'Not verified'),
    ],
    ['Summary', (item) => item.shortDescription ?? '—'],
  ];

  return (
    <div className="cref cref-dest">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <Link href="/universities">Universities</Link> ›{' '}
          <span aria-current="page">Compare</span>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap hero-in">
          <h1>
            Compare <span className="b">universities</span>
          </h1>
          <p className="lead">
            Line up to {MAX} published institutions side by side on the fields the catalogue
            records. Nothing here is scored or ranked.
          </p>
        </div>
      </section>

      <section className="sec wrap" style={{ paddingTop: 8 }}>
        <div className="cmp-picker">
          <div className="cmp-search">
            <label htmlFor="compare-search-universities">Search published universities</label>
            <input
              id="compare-search-universities"
              type="text"
              value={query}
              placeholder="Search by name"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {available.length ? (
            <div className="cmp-options" role="list" aria-label="Available universities">
              {available.slice(0, 8).map((option) => (
                <button
                  type="button"
                  key={option.slug}
                  className="chip"
                  disabled={draft.length >= MAX}
                  onClick={() => {
                    setDraft((current) => [...current, option.slug]);
                    setQuery('');
                  }}
                >
                  Add {option.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="cmp-note">
              {options.length ? 'No published university matches that search.' : 'No published universities yet.'}
            </p>
          )}

          <div className="cmp-chosen" aria-label="Selected comparison items">
            {draft.map((slug) => (
              <span key={slug}>
                {label(slug)}
                <button
                  type="button"
                  aria-label={`Remove ${label(slug)}`}
                  onClick={() => setDraft((current) => current.filter((item) => item !== slug))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <p className="cmp-note" role="status">
            {draft.length}/{MAX} selected. Choose at least two.
          </p>

          <div className="cmp-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={draft.length < 2}
              onClick={() => go(draft)}
            >
              Compare selected
            </button>
            {draft.length ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDraft([]);
                  go([]);
                }}
              >
                Clear all
              </button>
            ) : null}
          </div>
        </div>

        {props.invalid.length ? (
          <p className="disclaimer" style={{ marginBottom: 18 }}>
            Not published, so left out of the comparison: {props.invalid.join(', ')}.
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="cref-empty" data-testid="compare-empty">
            <h3>Nothing selected yet</h3>
            <p>Add up to {MAX} universities above to compare them side by side.</p>
            <Link className="btn btn-primary" href="/universities">
              Browse universities
            </Link>
          </div>
        ) : (
          <>
          <div className="cmp-wrap phase1-compare-desktop">
            <table className="cmp" data-testid="compare-table">
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  {items.map((item) => (
                    <th scope="col" key={item.slug}>
                      <div className="cmp-head">
                        <span className="lg" aria-hidden="true">
                          {initials(item.name)}
                        </span>
                        <div>
                          <Link href={`/universities/${item.slug}`}>{item.name}</Link>
                          <div>
                            <button
                              type="button"
                              className="btn-clear"
                              style={{
                                color: 'var(--muted)',
                                fontSize: 12.5,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                              onClick={() =>
                                go(selected.filter((slug) => slug !== item.slug))
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, render]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {items.map((item) => (
                      <td key={item.slug}>{render(item)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="phase1-compare-mobile">
            {items.map((item) => (
              <article className="card cmp-card" key={item.slug}>
                <h3>{item.name}</h3>
                {rows.map(([field, render]) => (
                  <div className="fact" key={field}>
                    <span>{field}</span>
                    <strong>{render(item)}</strong>
                  </div>
                ))}
              </article>
            ))}
          </div>
          </>
        )}
      </section>

      <section className="sec wrap">
        <div className="cta2">
          <h2>Need a second opinion on the shortlist?</h2>
          <p>
            A counsellor can weigh these institutions against your marks, budget and target intake.
          </p>
          <div className="cta2-btns">
            <Link href="/counselling" className="btn btn-primary btn-lg">
              Book free counselling
            </Link>
            <Link href="/universities" className="btn btn-ghost btn-lg">
              Browse universities
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
