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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /** Set once a request for the current term has answered, so the empty state
   * appears instead of flashing between every keystroke. */
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setAnswered(false);
      setOpen(false);
      return;
    }
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
          setSuggestions(
            (body.data ?? [])
              .map((item) => String(item.name ?? ''))
              .filter(Boolean)
              .slice(0, 6),
          );
          setAnswered(true);
          setActive(-1);
          setOpen(true);
        } catch {
          if (!cancelled) setSuggestions([]);
        }
      })();
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, props.endpoint]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!formRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  function choose(term: string) {
    onValueChange(term);
    setOpen(false);
    setActive(-1);
    onSubmit(term);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === 'Escape') setOpen(false);
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
      setOpen(false);
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
        setOpen(false);
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
          onChange={(event) => onValueChange(event.target.value)}
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
