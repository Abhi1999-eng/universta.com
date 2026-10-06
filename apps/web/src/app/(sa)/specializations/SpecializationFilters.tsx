'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

/** How long typing rests before the list follows it. */
const TYPING_PAUSE_MS = 350;

/**
 * The specializations filter bar, applied as it changes.
 *
 * The design's bar filters the moment a subject or level is picked and as
 * the search is typed, and writes all three into the address. Ours is a
 * real GET form underneath -- the fields and the Search button are the
 * server's, and without JavaScript they submit as they always did -- and
 * this wrapper only presses it sooner. It moves with a soft navigation, so
 * the field being typed in keeps its focus and its caret.
 */
export function SpecializationFilters({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const apply = () => {
    const node = form.current;
    if (!node) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(node).entries()) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }
    /* A new filter starts at the first page of what it finds. */
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <form
      ref={form}
      className="h-filters"
      method="get"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        window.clearTimeout(timer.current);
        apply();
      }}
      onChange={(event) => {
        /* The change bubbled up from one of the fields; a pick applies at
           once, typing once it pauses. */
        const field = event.target as EventTarget;
        window.clearTimeout(timer.current);
        if (field instanceof HTMLSelectElement) apply();
        else timer.current = window.setTimeout(apply, TYPING_PAUSE_MS);
      }}
    >
      {children}
    </form>
  );
}
