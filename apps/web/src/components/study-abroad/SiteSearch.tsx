'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { hasFlag } from '@/lib/flag-codes';

/**
 * The search box, answering while somebody types.
 *
 * The design's box says it searches countries, courses, universities and
 * scholarships. It was wired to the course listing, because that was the only
 * listing a query could be handed to, so typing "Denmark" -- the most obvious
 * thing to type on a study-abroad site -- found the courses called Denmark, of
 * which there are none.
 *
 * Results arrive grouped by what they are and are shown under their own
 * headings rather than merged into one ranked list. "Computer Science" is a
 * subject, a course, and part of a hundred course names; a single list buries
 * the subject in the middle of them, while a reader scanning headed blocks
 * finds it at once.
 *
 * It stays a form. With no JavaScript, or while the request is in flight, or
 * if the request fails, pressing Enter still goes to the results page with
 * the query on it -- so the box is never a dead end.
 */

type Item = {
  id: string;
  label: string;
  href: string;
  meta: string | null;
  iso2Code?: string | null;
};

type Group = { type: string; label: string; href: string; items: Item[] };

/* Matches the API: two letters match half the catalogue and say nothing. */
const MIN_QUERY = 3;
const DEBOUNCE_MS = 180;

export function SiteSearch({
  placeholder = 'Search countries, courses, universities, scholarships…',
  autoFocus = false,
  defaultValue = '',
}: {
  placeholder?: string;
  autoFocus?: boolean;
  defaultValue?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const suggestions = useRef<HTMLDivElement>(null);
  /* Enter on a highlighted row clicks that row's own link rather than
     pushing the route: the link is already there, Next handles it as a
     client navigation, and the box stays renderable outside a router. */
  const links = useRef(new Map<number, HTMLAnchorElement>());
  /* The results page seeds the box with the query it is already answering.
     Suggesting the same thing in a panel over those results, before the
     reader has touched anything, hides the page they asked for -- so the
     panel waits for a keystroke. */
  const typed = useRef(false);

  const term = query.trim();
  /* Read during render rather than recorded in the effect: clearing the
     results from inside the effect sets state synchronously, which React
     counts as a cascading render -- and there is nothing to record anyway,
     because a query this short simply has no panel. */
  const tooShort = term.length < MIN_QUERY;
  /* One flat run of the grouped items, so the arrow keys can walk the list
     the way it is read rather than group by group. */
  const flat = tooShort ? [] : groups.flatMap((group) => group.items);

  useEffect(() => {
    if (tooShort) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then((response) => response.json())
        .then((body: { data?: { groups?: Group[] } }) => {
          setGroups(body.data?.groups ?? []);
          setActive(-1);
          if (typed.current) setOpen(true);
        })
        .catch((error: unknown) => {
          /* An aborted request is the next keystroke, not a failure. */
          if ((error as { name?: string }).name !== 'AbortError') setOpen(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, tooShort]);

  /* A click anywhere else closes it; a click inside is a result being taken. */
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /* On a phone the search field can sit near the viewport's bottom. Bound
     the panel to the space below it so every result is reachable by scrolling
     the panel, including while the on-screen keyboard resizes the viewport. */
  useEffect(() => {
    if (!open || tooShort) return;
    const panel = suggestions.current;
    if (!panel) return;
    const viewport = window.visualViewport;
    const fit = () => {
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const available = Math.max(120, bottom - panel.getBoundingClientRect().top - 16);
      panel.style.setProperty('--sugg-available-height', `${available}px`);
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('scroll', fit, { passive: true });
    viewport?.addEventListener('resize', fit);
    viewport?.addEventListener('scroll', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('scroll', fit);
      viewport?.removeEventListener('resize', fit);
      viewport?.removeEventListener('scroll', fit);
    };
  }, [open, tooShort]);

  /* Keep the highlighted row in the panel's own scroll frame. Moving the
     page would pull the search field away while the reader uses its keys. */
  useEffect(() => {
    if (!open || tooShort || active < 0) return;
    const panel = suggestions.current;
    const option = links.current.get(active);
    if (!panel || !option) return;
    const frame = panel.getBoundingClientRect();
    const row = option.getBoundingClientRect();
    const top = frame.top + panel.clientTop;
    const bottom = top + panel.clientHeight;
    if (row.top < top) panel.scrollTop -= top - row.top;
    else if (row.bottom > bottom) panel.scrollTop += row.bottom - bottom;
  }, [active, open, tooShort]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') return setOpen(false);
    if (!open || !flat.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current + 1) % flat.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current <= 0 ? flat.length - 1 : current - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      /* Only when something is picked: otherwise the form submits, which is
         what a reader who typed a whole phrase and hit Enter meant. */
      event.preventDefault();
      setOpen(false);
      links.current.get(active)?.click();
    }
  };

  const panel = open && !tooShort;
  const showEmpty = panel && !flat.length;

  return (
    <div className="bigsearch__wrap" ref={box}>
      <form
        className="bigsearch h-bigsearch"
        action="/search"
        method="get"
        role="search"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#667085"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="bigsearch__input"
          type="search"
          name="q"
          value={query}
          placeholder={placeholder}
          aria-label="Search Universta"
          autoComplete="off"
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={panel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={panel && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            typed.current = true;
            setQuery(event.target.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (typed.current && flat.length) setOpen(true);
          }}
        />
        <button className="btn btn--sm" type="submit">
          Search
        </button>
      </form>

      {panel ? (
        <div className="sugg" id={listId} ref={suggestions} role="listbox" aria-label="Suggestions">
          {showEmpty ? (
            <p className="sugg__none">
              Nothing matches <b>{term}</b> yet.
            </p>
          ) : null}
          {groups.map((group) => (
            <div className="sugg__group" key={group.type}>
              <p className="sugg__head">
                <span className="sugg__kind">{group.label}</span>
                <Link className="sugg__all" href={group.href} tabIndex={-1}>
                  See all
                </Link>
              </p>
              <ul className="sugg__list">
                {group.items.map((item) => {
                  const index = flat.indexOf(item);
                  return (
                    <li key={item.id}>
                      <Link
                        id={`${listId}-${index}`}
                        className={`sugg__item${index === active ? ' is-active' : ''}`}
                        href={item.href}
                        ref={(node) => {
                          if (node) links.current.set(index, node);
                          else links.current.delete(index);
                        }}
                        role="option"
                        aria-selected={index === active}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => setOpen(false)}
                      >
                        {hasFlag(item.iso2Code) ? (
                          /* eslint-disable-next-line @next/next/no-img-element --
                             a 700-byte vector the chips already serve. */
                          <img
                            className="sugg__flag"
                            src={`/flags/${item.iso2Code!.toLowerCase()}.svg`}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : null}
                        <span className="sugg__label">{item.label}</span>
                        {item.meta ? (
                          <span className="sugg__meta">{item.meta}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
