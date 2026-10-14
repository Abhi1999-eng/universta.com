'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { compareHref } from '@/lib/record-compare';
import { Crumbs } from './Crumbs';

/**
 * A side-by-side comparison in the approved design: the zip's picker and
 * comparison table, as the university comparison draws them, for records
 * whose columns the page builds on the server -- a country's costs and
 * intakes, a consultant's destinations and services -- so this draws what
 * it is given and keeps the address in step with the selection.
 */
export type CompareColumn = {
  slug: string;
  name: string;
  /** Under the name in the column head: a place, a provider. */
  meta?: string | null;
  href: string;
  /** A mark before the name: a flag, initials. */
  mark?: ReactNode;
};

export type CompareRow = { label: string; cells: ReactNode[] };

export function RecordCompare({
  kind,
  max,
  crumbs,
  eyebrow,
  title,
  lead,
  noun,
  columns,
  rows,
  options,
  selected,
  invalid,
  unavailable = false,
  browse,
  note,
  counselling,
}: {
  kind: string;
  max: number;
  crumbs: Array<{ label: string; href?: string }>;
  eyebrow: string;
  title: string;
  lead: string;
  noun: [string, string];
  columns: CompareColumn[];
  rows: CompareRow[];
  options: Array<{ slug: string; name: string }>;
  selected: string[];
  invalid: string[];
  unavailable?: boolean;
  browse: { href: string; label: string };
  note?: string;
  counselling: { heading: string; body: string; href: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const picked = columns.map((column) => column.slug);
  const addable = options.filter((option) => !picked.includes(option.slug));
  const go = (slugs: string[]) => startTransition(() => router.push(compareHref(kind, slugs, max)));
  const testId = `${kind}-compare`;

  /* The search-and-pick draft the older comparison offered beside the
     picker: a selection built up here and committed to the address at
     once, which a shared link, a reload, and Back and Forward all restore
     from the address. It starts from what the address already holds. */
  const selectedKey = selected.join(',');
  const known = selected.filter((slug) => columns.some((column) => column.slug === slug) || options.some((option) => option.slug === slug));
  const [draft, setDraft] = useState<string[]>(known);
  const [draftFor, setDraftFor] = useState(selectedKey);
  if (draftFor !== selectedKey) {
    setDraft(known);
    setDraftFor(selectedKey);
  }
  const [query, setQuery] = useState('');
  const label = (slug: string) =>
    options.find((option) => option.slug === slug)?.name ?? columns.find((column) => column.slug === slug)?.name ?? slug;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter(
      (option) =>
        !draft.includes(option.slug) &&
        (!needle || option.name.toLowerCase().includes(needle) || option.slug.toLowerCase().includes(needle)),
    );
  }, [options, query, draft]);

  return (
    <>
      <section className="hero hero--compact comparehero">
        <div className="wrap">
          <Crumbs trail={crumbs} />
          <div className="hero__lead">
            <p className="hero__eyebrow">
              {eyebrow}
              <b>·</b>up to {max} {noun[1]}
            </p>
            <h1 className="hero__h1">{title}</h1>
            <p className="hero__sub">{lead}</p>
          </div>
          <div className="comparepick">
            <label className="sr-only" htmlFor={`${testId}-add`}>
              Add a {noun[0]} to the comparison
            </label>
            <select
              className="comparepick__select"
              id={`${testId}-add`}
              data-testid={`${testId}-add`}
              value=""
              disabled={pending || picked.length >= max || addable.length === 0}
              onChange={(event) => {
                if (event.target.value) go([...picked, event.target.value]);
              }}
            >
              <option value="">
                {picked.length >= max
                  ? `${max} ${noun[1]} selected`
                  : options.length
                    ? `Add a ${noun[0]}…`
                    : `No published ${noun[1]} available`}
              </option>
              {addable.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.name}
                </option>
              ))}
            </select>
            {picked.length ? (
              <button className="btn btn--ghost btn--sm" type="button" disabled={pending} onClick={() => { setQuery(''); go([]); }}>
                Clear all
              </button>
            ) : null}
          </div>

          <div className="cmp-picker">
            <div className="cmp-search">
              <label htmlFor={`${testId}-search`}>Search published {kind}</label>
              <input
                id={`${testId}-search`}
                type="search"
                value={query}
                placeholder="Search by name"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {matches.length ? (
              <div className="cmp-options" role="list" aria-label={`Available ${kind}`}>
                {matches.slice(0, 8).map((option) => (
                  <button
                    className="chipbtn"
                    type="button"
                    key={option.slug}
                    disabled={pending || draft.length >= max}
                    onClick={() => {
                      setDraft((current) => (current.includes(option.slug) || current.length >= max ? current : [...current, option.slug]));
                      setQuery('');
                    }}
                  >
                    Add {option.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="cmp-note">{options.length ? `No published ${noun[0]} matches that search.` : `No published ${noun[1]} yet.`}</p>
            )}
            <div className="cmp-chosen" aria-label="Selected comparison items">
              {draft.map((slug) => (
                <span key={slug}>
                  {label(slug)}
                  <button
                    type="button"
                    aria-label={`Remove ${label(slug)} from selection`}
                    disabled={pending}
                    onClick={() => setDraft((current) => current.filter((item) => item !== slug))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <p className="cmp-note" role="status">
              {draft.length}/{max} selected. Choose at least two.
            </p>
            <button className="btn btn--sm" type="button" disabled={pending || draft.length < 2} onClick={() => go(draft)}>
              Compare selected
            </button>
          </div>
        </div>
      </section>

      <section className="sec sec--white" id="comparison">
        <div className="wrap">
          {invalid.length ? (
            <p className="callout" role="status">
              Not published, so left out of the comparison: {invalid.join(', ')}.
            </p>
          ) : null}
          {unavailable ? (
            <p className="callout" role="status">
              The comparison could not be loaded. Please try again.
            </p>
          ) : null}
          {columns.length ? (
            <>
              <div
                className="tablewrap"
                role="region"
                aria-label={`${noun[1][0]!.toUpperCase()}${noun[1].slice(1)} comparison`}
                aria-busy={pending}
                tabIndex={0}
                data-testid={`${testId}-table-wrap`}
              >
                <table
                  className="data comparetable"
                  data-testid={`${testId}-table`}
                  style={{ minWidth: `${Math.max(640, 190 + columns.length * 200)}px` }}
                >
                  <caption className="sr-only">{title}</caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">Field</span>
                      </th>
                      {columns.map((column) => (
                        <th scope="col" key={column.slug}>
                          <span className="cmphead">
                            {column.mark}
                            <Link className="cmphead__name" href={column.href}>
                              {column.name}
                            </Link>
                            {column.meta ? <span className="cmphead__meta">{column.meta}</span> : null}
                            <Link
                              className="cmpremove"
                              href={compareHref(kind, selected.filter((slug) => slug !== column.slug), max)}
                              aria-label={`Remove ${column.name} from the comparison`}
                            >
                              Remove
                            </Link>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        {row.cells.map((cell, index) => (
                          <td key={columns[index]?.slug ?? index}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {note ? <p className="trust__note">{note}</p> : null}
              {columns.length < 2 ? (
                <p className="sec-lead" style={{ marginTop: 14 }}>
                  Add another {noun[0]} above to compare side by side.
                </p>
              ) : null}
            </>
          ) : !unavailable ? (
            <div className="compare-empty" data-testid={`${testId}-empty`}>
              <p className="ov__lead">Nothing selected yet.</p>
              <p className="sec-lead">
                Add up to {max} {noun[1]} above. The address keeps your selection, so you can share it.
              </p>
              <div className="btn-row compare-empty__actions">
                <Link className="btn" href={browse.href}>
                  {browse.label}{' '}
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </Link>
              </div>
            </div>
          ) : null}
          <div className="magnet" style={{ marginTop: 34 }}>
            <div>
              <h2 className="magnet__t">{counselling.heading}</h2>
              <p className="magnet__b">{counselling.body}</p>
            </div>
            <Link className="btn btn--onnavy btn--lg" href={counselling.href}>
              Book free counselling{' '}
              <span className="btn__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
          <p className="h-more">
            <Link className="linkcta" href={browse.href}>
              {browse.label} <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
