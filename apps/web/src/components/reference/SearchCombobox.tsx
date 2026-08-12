'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

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
  style?: CSSProperties;
};

export function SearchCombobox(props: SearchComboboxProps) {
  const { label, placeholder, submitLabel, value, onValueChange, onSubmit } = props;
  const listId = useId();
  const formRef = useRef<HTMLFormElement | null>(null);
  /** What the endpoint last answered, and for which term. Holding the term
   * alongside the results is what lets the list open only once the answer
   * belongs to what is actually in the field -- no flicker between keystrokes,
   * and no stale list under a term that has moved on. */
  const [result, setResult] = useState<{ term: string; items: string[] } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);

  const term = value.trim();
  const answered = result !== null && result.term === term && term.length >= 2;
  const suggestions = answered ? result.items : [];
  const open = answered && !dismissed;

  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `${props.endpoint}?q=${encodeURIComponent(term)}`,
          );
          if (!response.ok || cancelled) return;
          const body = (await response.json()) as { data?: Array<{ name?: string }> };
          if (cancelled) return;
          setResult({
            term,
            items: (body.data ?? [])
              .map((item) => String(item.name ?? ''))
              .filter(Boolean)
              .slice(0, 6),
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
  }, [term, props.endpoint]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!formRef.current?.contains(event.target as Node)) setDismissed(true);
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  function choose(picked: string) {
    onValueChange(picked);
    setDismissed(true);
    setActive(-1);
    onSubmit(picked);
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
      className="searchwrap"
      ref={formRef}
      style={props.style}
      onSubmit={(event) => {
        event.preventDefault();
        setDismissed(true);
        onSubmit(value);
      }}
    >
      <div className="searchbar">
        <span className="ic" aria-hidden="true">
          🔍
        </span>
        <input
          type="text"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            setDismissed(false);
            onValueChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
      {open && suggestions.length ? (
        <ul className="suggest" id={listId} role="listbox" aria-label={label}>
          {suggestions.map((item, index) => (
            <li
              key={item}
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
              {item}
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
