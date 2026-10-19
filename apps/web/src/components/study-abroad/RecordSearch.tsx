'use client';

import { useId, useState, type ReactNode } from 'react';

/**
 * A search box over the cards a directory page has already loaded, narrowing
 * them in the browser as the reader types, as the zip's hub directories do
 * with their data-search text. Two of the zip's looks:
 *
 * - `filters` -- the hub row (`.h-filters` with one `.h-filter--q` box) and
 *   its dashed `.h-empty` note, over one grid (success stories);
 * - `directory` -- the directory page's big `.dir__search` box over cards
 *   grouped under `.dir__grouphead` names (careers, by department).
 *
 * The cards themselves are drawn on the server and handed in whole, so the
 * page reads the same with scripts off: every card shows.
 */

export type SearchItem = {
  key: string;
  /** Everything the box matches against: title, names, places. */
  text: string;
  /** The heading the card is grouped under, in the directory look. */
  group?: string | null;
  node: ReactNode;
};

/** Lower case, accents off, so "Zurich" finds "Zürich". */
export const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Every word typed must appear somewhere in the card's text. */
export function matches(text: string, query: string) {
  const haystack = fold(text);
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function RecordSearch({
  items,
  look,
  label,
  placeholder,
  none,
  grid = 'h-grid',
  ungrouped = 'Other',
}: {
  items: SearchItem[];
  look: 'filters' | 'directory';
  label: string;
  placeholder: string;
  /** What to say when nothing matches. */
  none: string;
  grid?: string;
  /** The heading for cards with no group, in the directory look. */
  ungrouped?: string;
}) {
  const [query, setQuery] = useState('');
  const id = useId();
  const shown = query.trim() ? items.filter((item) => matches(item.text, query)) : items;

  const box =
    look === 'filters' ? (
      <div className="h-filters" role="search">
        <label className="h-filter h-filter--q" htmlFor={id}>
          {label}
          <input
            id={id}
            type="search"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
    ) : (
      <div className="dir__search" role="search">
        <input
          className="dir__input"
          type="search"
          value={query}
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
    );

  if (!shown.length) {
    return (
      <>
        {box}
        {look === 'filters' ? (
          <div className="h-empty" role="status">
            <strong>{none}</strong>
            <span>Try a shorter word, or clear the search.</span>
          </div>
        ) : (
          <p className="dir__none" role="status">
            {none}
          </p>
        )}
      </>
    );
  }

  if (look === 'filters') {
    return (
      <>
        {box}
        <div className={grid}>{shown.map((item) => <Slot key={item.key}>{item.node}</Slot>)}</div>
      </>
    );
  }

  /* Groups in the order their first card comes, each card under its name. */
  const groups = new Map<string, SearchItem[]>();
  for (const item of shown) {
    const name = item.group?.trim() || ungrouped;
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return (
    <>
      {box}
      {[...groups].map(([name, members]) => (
        <div className="dir__group" key={name}>
          <div className="dir__grouphead">
            <h3 className="dir__groupname">{name}</h3>
          </div>
          <div className={grid}>{members.map((item) => <Slot key={item.key}>{item.node}</Slot>)}</div>
        </div>
      ))}
    </>
  );
}

/** A card as it was drawn; the key belongs to this wrapper, not the node. */
function Slot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
