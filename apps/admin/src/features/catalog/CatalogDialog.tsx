'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function CatalogDialog({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;

    // A dialog may contain an auto-focused confirmation field. Otherwise,
    // prefer the first editable control rather than its close button.
    if (dialog && !dialog.contains(document.activeElement)) {
      const initialFocus = dialog.querySelector<HTMLElement>(
        '[autofocus], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [data-dialog-initial-focus], button:not([disabled]):not([aria-label="Close dialog"])',
      );
      (initialFocus ?? closeRef.current)?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return (
    <div className="pa p-modal" data-open="true" role="presentation">
      <button type="button" aria-hidden="true" tabIndex={-1} className="p-modal__scrim" onClick={onClose} />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-dialog-title"
        aria-describedby="catalog-dialog-description"
        tabIndex={-1}
        className={`p-modal__panel${wide ? ' p-modal__panel--wide' : ''}`}
      >
        <div className="p-modal__head">
          <div>
            <h2 id="catalog-dialog-title" className="p-modal__title">{title}</h2>
            <p id="catalog-dialog-description" className="p-hint">{description}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="p-iconbtn" aria-label="Close dialog">×</button>
        </div>
        <div className="p-modal__body">{children}</div>
      </section>
    </div>
  );
}

export function CatalogError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="p-alert p-alert--error">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="p-btn p-btn--ghost p-btn--sm">Retry</button>
    </div>
  );
}

export function CatalogLoading({ label = 'Loading catalog records…' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="p-panel p-empty">{label}</div>;
}
