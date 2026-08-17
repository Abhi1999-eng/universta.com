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
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#0D1524]/45 p-4" role="presentation">
      <button type="button" aria-hidden="true" tabIndex={-1} className="absolute inset-0 cursor-default" onClick={onClose} />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-dialog-title"
        aria-describedby="catalog-dialog-description"
        tabIndex={-1}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl sm:p-8 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="catalog-dialog-title" className="text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
            <p id="catalog-dialog-description" className="mt-2 text-sm leading-6 text-[#667085]">{description}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg p-2 text-xl text-[#667085] hover:bg-[#F0F4FA] focus:outline-none focus:ring-2 focus:ring-[#1657CF]" aria-label="Close dialog">×</button>
        </div>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}

export function CatalogError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-[#F2C5C5] bg-[#FFF7F7] p-6 text-sm text-[#9D2B2B]">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 rounded-lg border border-[#E8A7A7] px-4 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-[#1657CF]">Retry</button>
    </div>
  );
}

export function CatalogLoading({ label = 'Loading catalog records…' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="rounded-2xl border border-[#E8ECF3] bg-white p-10 text-center text-sm text-[#667085]">{label}</div>;
}
