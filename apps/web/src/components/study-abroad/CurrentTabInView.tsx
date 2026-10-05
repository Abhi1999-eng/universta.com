'use client';

import { useEffect, useRef } from 'react';

/**
 * Brings a tab strip's marked tab into view when the page opens.
 *
 * On a phone the destination's strip is wider than the screen and scrolls
 * sideways with its scrollbar hidden, so on the Scholarships page the tab
 * it marked as current sat off the right edge, and the strip read as if
 * the page were the guide's. The strip itself stays plain links; this only
 * moves it once.
 */
export function CurrentTabInView() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const inner = mark.current?.parentElement?.querySelector<HTMLElement>('.unitabs__inner');
    const link = inner?.querySelector<HTMLElement>('[aria-current]');
    if (!inner || !link) return;
    const left = link.offsetLeft - inner.offsetLeft;
    if (left + link.offsetWidth > inner.scrollLeft + inner.clientWidth)
      inner.scrollLeft = Math.max(0, left - 16);
  }, []);
  return <span ref={mark} hidden />;
}
