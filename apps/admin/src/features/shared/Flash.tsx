'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * A one-shot confirmation banner, and the handoff that carries one across a
 * navigation. Publishing a country leaves the editor for the list, so the
 * confirmation has to outlive the page that earned it; every other
 * confirmation stays where it was raised. Both render through the same
 * component so a saved draft and a published country cannot drift apart in
 * wording, colour or timing.
 *
 * The handoff is a module-level store rather than sessionStorage or a query
 * parameter. Admin navigates client-side, so the store survives the hop, and
 * nothing survives a reload -- which is what we want: a refreshed or shared
 * URL must never replay "published successfully" for something that happened
 * minutes ago. The message is also not part of the address of anything.
 */

export type FlashTone = 'success' | 'neutral';
export type Flash = { tone: FlashTone; message: string };

let pending: Flash | null = null;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/** Hands a confirmation to whichever admin page renders next. */
export function queueFlash(flash: Flash) {
  pending = flash;
  announce();
}

/** Reads without consuming. Displaying pages take it through the hook. */
export function peekFlash(): Flash | null {
  return pending;
}

export function clearFlash() {
  if (!pending) return;
  pending = null;
  announce();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    /* The confirmation lives exactly as long as a page is showing it, so
     * navigating away drops it rather than banking it for a later visit. */
    if (listeners.size === 0) pending = null;
  };
}

/** Picks up a confirmation handed over by the previous page. */
export function useHandedOverFlash(): [Flash | null, () => void] {
  const flash = useSyncExternalStore(subscribe, peekFlash, () => null);
  return [flash, clearFlash];
}

const TONES: Record<FlashTone, string> = {
  success: 'border-[#ABEFC6] bg-[#E9F8F0] text-[#18794E]',
  neutral: 'border-[#D9E0EA] bg-[#F8FAFC] text-[#475467]',
};

export function FlashBanner({
  flash,
  onDismiss,
  autoDismissMs = 6000,
  className = 'mt-5',
}: {
  flash: Flash | null;
  onDismiss: () => void;
  autoDismissMs?: number;
  className?: string;
}) {
  /* Keyed on the message so a second save re-arms the timer rather than
   * inheriting what was left of the first one's. */
  const message = flash?.message;
  useEffect(() => {
    if (!message || autoDismissMs <= 0) return;
    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [message, autoDismissMs, onDismiss]);

  if (!flash) return null;
  return (
    <div
      role="status"
      data-flash-tone={flash.tone}
      className={`${className} flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm font-semibold ${TONES[flash.tone]}`}
    >
      <span>{flash.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="shrink-0 rounded-lg px-2 text-base leading-none opacity-70 hover:opacity-100 focus:outline-none focus:underline"
      >
        ×
      </button>
    </div>
  );
}
