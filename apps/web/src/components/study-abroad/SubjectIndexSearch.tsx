'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { SubjectIndexResult } from '@/lib/subject-index-search';

type Branch = { id: string; name: string; slug: string };
type Row = { id: string; name: string; slug: string; subSubjects?: Branch[] | null };

/** How many of each kind the panel lists; the cards below show the rest. */
const SUBJECTS_LISTED = 4;
const SPECIALIZATIONS_LISTED = 6;

type Option = { id: string; label: string; meta: string; href: string };

/**
 * The subjects explorer's search box.
 *
 * It narrows the cards below as you type, and its panel offers the subjects
 * and specializations that answer, each opening its own page -- the same
 * answer the cards give, because both are read from the page's own
 * subjects. It asked the API before, which knows subject names only, so a
 * search for a specialization narrowed the cards correctly while the panel
 * said nothing had been found.
 *
 * Enter puts the term in the address, so a search can be shared and survives
 * a reload; Escape closes the panel, and a second Escape empties the box, as
 * the country search does.
 */
export function SubjectIndexSearch<T extends Row>({
  query,
  onQueryChange,
  onCommit,
  result,
  resultsId,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  /** Puts the term in the address (or takes it out). */
  onCommit: (value: string) => void;
  result: SubjectIndexResult<T>;
  /** Where the cards start, which Enter brings into view. */
  resultsId: string;
}) {
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const links = useRef(new Map<number, HTMLAnchorElement>());
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /* A page opened with ?q= is already showing the answer; a panel over it
     before the reader has touched anything would hide it. */
  const typed = useRef(false);

  const subjectOptions: Option[] = result.subjects.slice(0, SUBJECTS_LISTED).map((subject) => ({
    id: `s-${subject.id}`,
    label: subject.name,
    meta: `${(subject.subSubjects ?? []).length} specializations`,
    href: `/subjects/${subject.slug}`,
  }));
  const specOptions: Option[] = result.specializations
    .slice(0, SPECIALIZATIONS_LISTED)
    .map(({ spec, subject }) => ({
      id: `p-${subject.id}-${spec.id}`,
      label: spec.name,
      meta: `in ${subject.name}`,
      href: `/subjects/${subject.slug}/${spec.slug}`,
    }));
  const flat = [...subjectOptions, ...specOptions];
  const panel = open && result.searching;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (panel) {
        setOpen(false);
        setActive(-1);
      } else if (query) {
        onQueryChange('');
        onCommit('');
      }
      return;
    }
    if (!panel || !flat.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current + 1) % flat.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current <= 0 ? flat.length - 1 : current - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      /* A picked row wins over the half-typed term. */
      event.preventDefault();
      setOpen(false);
      links.current.get(active)?.click();
    }
  };

  const group = (label: string, options: Option[], offset: number) =>
    options.length ? (
      <div className="sugg__group">
        <p className="sugg__head">
          <span className="sugg__kind">{label}</span>
        </p>
        <ul className="sugg__list">
          {options.map((option, index) => {
            const at = offset + index;
            return (
              <li key={option.id}>
                <Link
                  className={`sugg__item${at === active ? ' is-active' : ''}`}
                  href={option.href}
                  id={`${listId}-${at}`}
                  ref={(node) => {
                    if (node) links.current.set(at, node);
                    else links.current.delete(at);
                  }}
                  role="option"
                  aria-selected={at === active}
                  onMouseEnter={() => setActive(at)}
                  onClick={() => setOpen(false)}
                >
                  <span className="sugg__label">{option.label}</span>
                  <span className="sugg__meta">{option.meta}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  return (
    <div className="bigsearch__wrap" ref={box}>
      <form
        className="bigsearch"
        role="search"
        method="get"
        action="/subjects"
        onSubmit={(event) => {
          event.preventDefault();
          setOpen(false);
          onCommit(query);
          /* The answer is the cards, which start below the fold on a
             phone; Search used to change nothing anybody could see. */
          input.current?.blur();
          const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          document
            .getElementById(resultsId)
            ?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#667085"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={input}
          className="bigsearch__input"
          type="search"
          name="q"
          value={query}
          maxLength={100}
          placeholder="Search subjects or specializations"
          aria-label="Search subjects or specializations"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={panel}
          aria-controls={listId}
          aria-activedescendant={panel && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(event) => {
            typed.current = true;
            setOpen(true);
            setActive(-1);
            onQueryChange(event.target.value);
          }}
          onFocus={() => {
            if (typed.current) setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button className="btn btn--sm" type="submit">
          Search{' '}
          <span className="btn__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </form>
      {panel ? (
        <div className="sugg" id={listId} role="listbox" aria-label="Subjects and specializations">
          {flat.length ? (
            <>
              {group('Subjects', subjectOptions, 0)}
              {group('Specializations', specOptions, subjectOptions.length)}
            </>
          ) : (
            <p className="sugg__none">
              No subject or specialization matches <b>{query.trim()}</b>.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
