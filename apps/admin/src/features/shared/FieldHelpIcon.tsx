'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FieldHelpContent } from '@/lib/field-help/types';

/** Only one help popover stays open at a time, across the whole admin —
 * opening a new one closes whichever was already open, tracked outside
 * React state so it works across sibling/unrelated form trees. */
let closeCurrentlyOpen: (() => void) | null = null;

const ROWS: Array<[keyof FieldHelpContent, string]> = [
  ['purpose', 'Purpose'],
  ['input', 'Enter'],
  ['dataType', 'Data type'],
  ['required', 'Required'],
  ['format', 'Format'],
  ['example', 'Example'],
  ['dependency', 'Depends on'],
  ['frontendEffect', 'Frontend effect'],
  ['caution', 'Caution'],
];

/** Compact "(!)" info icon shown beside a field label. Opens a small
 * popover with the field's purpose, expected input, type, format, example,
 * dependency and frontend effect on click or Enter/Space; closes on
 * Escape, outside click, or when another popover opens. Purely
 * informational — it never focuses, changes or submits the field/form it
 * sits next to. */
export function FieldHelpIcon({
  fieldLabel,
  help,
}: {
  fieldLabel: string;
  help: FieldHelpContent;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'right' | 'left'>('right');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  function close() {
    setOpen(false);
    if (closeCurrentlyOpen === close) closeCurrentlyOpen = null;
  }

  function toggle(event: React.MouseEvent | React.KeyboardEvent) {
    // Never let this reach a parent form/button and never move focus onto
    // the field this icon sits beside.
    event.preventDefault();
    event.stopPropagation();
    if (open) {
      close();
      return;
    }
    closeCurrentlyOpen?.();
    closeCurrentlyOpen = close;
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return undefined;
    // Reposition to stay inside the viewport instead of overflowing near
    // the right edge of a narrow (mobile) admin panel.
    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const wouldOverflowRight = rect.left + 320 > window.innerWidth;
      setPlacement(wouldOverflowRight ? 'left' : 'right');
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => {
    if (closeCurrentlyOpen === close) closeCurrentlyOpen = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') toggle(event);
        }}
        aria-label={`Information about ${fieldLabel}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        className="ml-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#B7C6E8] bg-[#EEF3FF] text-[10px] font-bold leading-none text-[#1657CF] hover:bg-[#DCE8FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1657CF]"
      >
        !
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={`Information about ${fieldLabel}`}
          className={`absolute top-full z-50 mt-2 w-72 max-w-[90vw] rounded-xl border border-[#D9E0EA] bg-white p-3.5 text-xs leading-5 text-[#48505F] shadow-xl ${
            placement === 'right' ? 'left-0' : 'right-0'
          }`}
        >
          <p className="mb-1.5 text-sm font-semibold text-[#0D1524]">{fieldLabel}</p>
          <dl className="space-y-1.5">
            {ROWS.map(([key, rowLabel]) => {
              const value = help[key];
              if (!value) return null;
              return (
                <div key={key}>
                  <dt className="font-semibold text-[#828B9B]">{rowLabel}</dt>
                  <dd
                    className={`mt-0.5 break-words ${key === 'caution' ? 'text-[#9A5B00]' : ''}`}
                  >
                    {value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}
    </span>
  );
}
