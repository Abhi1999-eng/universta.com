'use client';

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

  function go(next: string[]) {
    const unique = [...new Set(next)].slice(0, MAX);
    router.push(unique.length ? `${pathname}?items=${unique.join(',')}` : pathname);
  }

  const remaining = options.filter((option) => !selected.includes(option.slug));

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
          <label htmlFor="add-university" style={{ fontSize: 14, color: 'var(--muted)' }}>
            Add a university
          </label>
          <select
            id="add-university"
            value=""
            disabled={selected.length >= MAX || remaining.length === 0}
            onChange={(event) => {
              if (event.target.value) go([...selected, event.target.value]);
            }}
          >
            <option value="">
              {selected.length >= MAX
                ? `Maximum of ${MAX} selected`
                : remaining.length
                  ? 'Choose a university…'
                  : 'No more published universities'}
            </option>
            {remaining.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.name}
              </option>
            ))}
          </select>
          {selected.length ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => go([])}>
              Clear all
            </button>
          ) : null}
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
          <div className="cmp-wrap">
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
