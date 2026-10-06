'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

/** The search field the approved hero templates draw as a pill with a button.
 *
 * The prototype filtered a hard-coded in-page array and offered no keyboard
 * path through its suggestions. This one asks the real suggestions endpoint,
 * exposes the standard combobox/listbox semantics so the list is reachable
 * without a mouse, and commits the chosen term to the URL through the caller
 * so a filtered listing stays shareable. */

export type SearchComboboxProps = {
  /** Accessible name. The approved hero shows a placeholder, not a visible label. */
  label: string;
  placeholder: string;
  submitLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Called when a term is committed, whether typed or picked from the list. */
  onSubmit: (value: string) => void;
  /** Endpoint answering `?q=` with `{ data: [{ name }] }`. */
  endpoint: string;
  /** Shown when the endpoint answers with nothing, so the silence is explained. */
  emptyMessage: string;
  /** Appended to the form's own class, for the placements that style it --
   * the results band wants `cresults__search`, the heroes want nothing. */
  className?: string;
  style?: CSSProperties;
  /** On a phone, the submit button shrinks to its arrow, so the field keeps
   *  the width a placeholder needs. Off by default. */
  iconSubmit?: boolean;
  /** Where a suggestion that carries its own page goes -- a programme, a
   *  university's programmes. Without it every suggestion is a search term,
   *  as it always was. */
  onFollow?: (href: string) => void;
  /** For a browser without script: the address the form submits to, the
   *  name the field goes under and the most it takes, and `children` --
   *  hidden fields for the filters a list already has, so a search keeps
   *  them. Without these the field draws exactly as it always has. */
  action?: string;
  name?: string;
  maxLength?: number;
  children?: ReactNode;
};

/** A suggestion: the words it puts in the field, and the page it opens
 *  instead when it has one of its own and the caller follows those. */
type Suggestion = { name: string; href: string | null; kind: string | null };

const KIND_LABELS: Record<string, string> = {
  programme: 'Programme',
  code: 'Programme',
  university: 'University',
};

export function SearchCombobox(props: SearchComboboxProps) {
  const { label, placeholder, submitLabel, value, onValueChange, onSubmit } = props;
  const listId = useId();
  const formRef = useRef<HTMLFormElement | null>(null);
  /** What the endpoint last answered, and for which term. Holding the term
   * alongside the results is what lets the list open only once the answer
   * belongs to what is actually in the field -- no flicker between keystrokes,
   * and no stale list under a term that has moved on. */
  const [result, setResult] = useState<{ term: string; items: Suggestion[] } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);

  const term = value.trim();
  /* A list whose suggestions open pages mixes programmes and universities
     with course names, so it shows a few more. */
  const limit = props.onFollow ? 8 : 6;
  const answered = result !== null && result.term === term && term.length >= 2;
  const suggestions = answered ? result.items : [];
  const open = answered && !dismissed;

  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          /* An endpoint may carry a query of its own -- which list to
             suggest from -- and the term joins it. */
          const joiner = props.endpoint.includes('?') ? '&' : '?';
          const response = await fetch(
            `${props.endpoint}${joiner}q=${encodeURIComponent(term)}`,
          );
          if (!response.ok || cancelled) return;
          const body = (await response.json()) as {
            data?: Array<{ name?: string; href?: unknown; kind?: unknown }>;
          };
          if (cancelled) return;
          setResult({
            term,
            items: (body.data ?? [])
              .map((item) => ({
                name: String(item.name ?? ''),
                href: typeof item.href === 'string' ? item.href : null,
                kind: typeof item.kind === 'string' ? item.kind : null,
              }))
              .filter((item) => item.name)
              .slice(0, limit),
          });
          setActive(-1);
        } catch {
          if (!cancelled) setResult({ term, items: [] });
        }
      })();
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, props.endpoint, limit]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!formRef.current?.contains(event.target as Node)) setDismissed(true);
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  function choose(picked: Suggestion) {
    setDismissed(true);
    setActive(-1);
    if (picked.href && props.onFollow) {
      props.onFollow(picked.href);
      return;
    }
    onValueChange(picked.name);
    onSubmit(picked.name);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === 'Escape') setDismissed(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, -1));
    } else if (event.key === 'Enter' && active >= 0) {
      // Stop the implicit form submission: the highlighted suggestion wins
      // over whatever partial term is still in the field.
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === 'Escape') {
      setDismissed(true);
      setActive(-1);
    }
  }

  return (
    <form
      className={[
        'searchwrap',
        props.className,
        props.iconSubmit ? 'searchwrap--iconsubmit' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      ref={formRef}
      style={props.style}
      action={props.action}
      method={props.action ? 'get' : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        setDismissed(true);
        onSubmit(value);
      }}
    >
      <div className="bigsearch searchbar">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#667085"
          strokeWidth="1.7"
          aria-hidden="true"
          className="ic"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="bigsearch__input"
          type="text"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          name={props.name}
          maxLength={props.maxLength}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            setDismissed(false);
            onValueChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="btn btn--sm">
          {props.iconSubmit ? (
            <span className="searchwrap__label">{submitLabel}</span>
          ) : (
            submitLabel
          )}{' '}
          <span className="btn__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
      {props.children}
      {open && suggestions.length ? (
        <ul className="suggest" id={listId} role="listbox" aria-label={label}>
          {suggestions.map((item, index) => (
            <li
              key={`${item.name}-${item.href ?? ''}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'on' : undefined}
              // mousedown rather than click: the field would otherwise lose
              // focus and close the list before the click landed.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(item);
              }}
            >
              {item.name}
              {props.onFollow && item.href && item.kind && KIND_LABELS[item.kind] ? (
                <span className="suggest__kind"> {KIND_LABELS[item.kind]}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {open && answered && suggestions.length === 0 ? (
        <p className="suggest suggest-empty" role="status">
          {props.emptyMessage}
        </p>
      ) : null}
    </form>
  );
}
