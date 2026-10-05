'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The strip of section links that sticks under the header on a university's
 * page: the zip's `unitabs`, filled the way the behaviour reference fills
 * its "On this page" bar -- with the sections that are actually on the
 * page and nothing else, so no link jumps to a section that stood down.
 *
 * The links are plain anchors and work without script. The script only
 * marks the section being read. It adds `aria-current` and takes it away
 * rather than writing "false", because the stylesheet underlines any link
 * that carries the attribute at all.
 */
export function UniversityTabs({
  tabs,
}: {
  tabs: Array<{ id: string; label: string }>;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const ids = tabs.map((tab) => tab.id).join(' ');

  /* On a phone the strip is wider than the screen and scrolls sideways.
     The marked tab is brought into it, so the strip never marks a section
     the reader cannot see named. */
  useEffect(() => {
    const inner = strip.current;
    const link = current
      ? inner?.querySelector<HTMLElement>(`a[href="#${current}"]`)
      : null;
    if (!inner || !link) return;
    const left = link.offsetLeft - inner.offsetLeft;
    if (left < inner.scrollLeft || left + link.offsetWidth > inner.scrollLeft + inner.clientWidth)
      inner.scrollTo({ left: Math.max(0, left - 16) });
  }, [current]);

  useEffect(() => {
    const sections = ids
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;
    let frame = 0;
    /* The section being read is the last one whose top has passed a line a
       little below this strip -- where a jump from the strip lands it -- so
       a click marks the tab that was clicked, not the section above it. */
    const update = () => {
      frame = 0;
      const strip = document.querySelector('.unitabs--sections');
      const line = (strip?.getBoundingClientRect().bottom ?? 0) + 48;
      let reading: string | null = null;
      for (const section of sections)
        if (section.getBoundingClientRect().top <= line) reading = section.id;
      const last = sections[sections.length - 1]!;
      if (reading === last.id && last.getBoundingClientRect().bottom < line)
        reading = null;
      setCurrent(reading);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ids]);

  if (tabs.length < 2) return null;
  return (
    <nav className="unitabs unitabs--sections" aria-label="University sections">
      <div className="wrap unitabs__inner" ref={strip}>
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            aria-current={current === tab.id ? 'true' : undefined}
          >
            {tab.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
