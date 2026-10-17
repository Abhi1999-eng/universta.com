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
export type Flash = { tone: FlashTone; message: string; at?: number };

/* A list page shows a handed-over confirmation only if it arrives promptly:
   one left waiting while the operator wandered elsewhere is no longer news. */
const HANDOVER_TTL_MS = 15_000;

let pending: Flash | null = null;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/** Hands a confirmation to whichever admin page renders next. */
export function queueFlash(flash: Flash) {
  pending = { ...flash, at: flash.at ?? Date.now() };
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

/** For list pages that confirm in a toast: publishing from an editor sends
 * the operator back to the list, and this turns the confirmation the editor
 * handed over into the list's corner toast. It is taken once, so a later
 * visit does not replay it. */
export function useHandedOverToast(show: (message: string) => void) {
  useEffect(() => {
    const flash = pending;
    if (!flash) return;
    pending = null;
    announce();
    if (flash.at === undefined || Date.now() - flash.at <= HANDOVER_TTL_MS) show(flash.message);
  }, [show]);
}

/* The reference's own alert tones. `neutral` has no variant there, so it
   stays the base alert: informative rather than coloured. */
const TONES: Record<FlashTone, string> = {
  success: 'p-alert--ok',
  neutral: '',
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
      className={`${className} p-alert ${TONES[flash.tone]}`.trim()}
    >
      <span>{flash.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="p-iconbtn p-iconbtn--sm"
      >
        ×
      </button>
    </div>
  );
}
