'use client';

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  findVariableTrigger,
  insertVariableToken,
  type DynamicVariable,
  type VariableTrigger,
} from './variable-autocomplete';
import { VariableSuggestionMenu } from './VariableSuggestionMenu';

type InputElement = HTMLInputElement | HTMLTextAreaElement;

export function VariableAutocompleteTextControl({
  id,
  value,
  onChange,
  variables,
  multiline = false,
  rows,
  maxLength,
  className,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  variables: readonly DynamicVariable[];
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const inputRef = useRef<InputElement | null>(null);
  const changeVersion = useRef(0);
  const [trigger, setTrigger] = useState<VariableTrigger | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleVariables = useMemo(() => {
    const query = trigger?.query.trim().toLowerCase() ?? '';
    return variables.filter(
      (variable) =>
        !query ||
        variable.key.toLowerCase().includes(query) ||
        variable.label.toLowerCase().includes(query),
    );
  }, [trigger?.query, variables]);

  function change(event: ChangeEvent<InputElement>) {
    changeVersion.current += 1;
    const next = event.target.value;
    const cursor = event.target.selectionStart ?? next.length;
    onChange(next);
    const nextTrigger = findVariableTrigger(next, cursor);
    setTrigger(nextTrigger);
    setActiveIndex(0);
  }

  function insert(variable: DynamicVariable) {
    if (!trigger) return;
    // Read the live control value: React may still be committing the final
    // keystroke when a pointer selects a suggestion.
    const current = inputRef.current?.value ?? value;
    const liveTrigger = findVariableTrigger(
      current,
      inputRef.current?.selectionStart ?? current.length,
    ) ?? trigger;
    const next = insertVariableToken(current, liveTrigger, variable);
    const versionAtInsert = changeVersion.current;
    onChange(next.value);
    setTrigger(null);
    requestAnimationFrame(() => {
      if (changeVersion.current !== versionAtInsert) return;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.cursor, next.cursor);
    });
  }

  function keyDown(event: KeyboardEvent<InputElement>) {
    if (!trigger) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setTrigger(null);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!visibleVariables.length) return;
      const changeBy = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(
        (current) =>
          (current + changeBy + visibleVariables.length) %
          visibleVariables.length,
      );
      return;
    }
    if (event.key === 'Enter') {
      const variable = visibleVariables[activeIndex];
      if (!variable) return;
      event.preventDefault();
      insert(variable);
    }
  }

  const menuId = id ? `${id}-variables` : undefined;
  const inputProps = {
    id,
    ref: (element: InputElement | null) => {
      inputRef.current = element;
    },
    value,
    onChange: change,
    onKeyDown: keyDown,
    maxLength,
    className,
    'aria-label': ariaLabel,
    'aria-autocomplete': 'list' as const,
    'aria-controls': trigger ? menuId : undefined,
    'aria-expanded': Boolean(trigger),
  };

  return (
    <div className="relative">
      {multiline ? <textarea {...inputProps} rows={rows} /> : <input {...inputProps} />}
      {trigger ? <VariableSuggestionMenu id={menuId} variables={visibleVariables} activeIndex={activeIndex} onSelect={insert} /> : null}
    </div>
  );
}
